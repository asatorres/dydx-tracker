import { parseUnits } from "ethers/lib/utils";
import { getSqlDate, sqlBatchQuery } from "./database";
import { SQL_TRADES_DEX, SQL_USERS_STATS } from "../constants/tables";
import { AMOUNT_DECIMALS, PRICE_DECIMALS } from "../constants";
import { PoolConnection } from "mysql2/promise";
import Decimal from "decimal.js";
import { aggregatePositions } from "../services/processor";
import { sendMessage } from "./messaging";
import { TG_NOTIFICATION_DURATION, TG_TRADES_QUEUE } from "../constants/queues";

/**
 * Converts a string representation of a number into its decimal form based on
 * a specified number of decimals.
 *
 * @param {string} amount - The amount to convert, represented as a string to avoid precision loss.
 * @param {number} decimals - The number of decimal places to include in the converted amount.
 * @returns {Promise<string>} A promise that resolves to the amount in its decimal form, as a string.
 */

export const convertToDecimal = async (amount: string, decimals: number) => {
  if (amount === null) return null;

  // Convert the number to a decimal with 18 decimal places max
  let parts = amount.toString().split(".");
  if (parts.length > 1 && parts[1].length > decimals) {
    parts[1] = parts[1].substring(0, decimals);
  }
  const adjustedAmount = parts.join(".");
  return await parseUnits(adjustedAmount, decimals).toString();
};

/**
 * Creates a new trader position object based on market transaction data and prepares it for database insertion.
 * This function handles the computation of the trade ID, realized PnL, and other relevant trading parameters
 * and returns structured data ready for database operations.
 *
 * @param {number} user - The id corresponding the user for the given trader.
 * @param {Object} position - The market position data containing details like market, entry/exit prices, etc.
 * @param {string} address - The trader's blockchain address.
 * @param {string} [blockHeight=null] - The block height at which the position was created, if not provided, uses position.createdAtHeight.
 * @param {string} [createdAt=null] - The creation time of the position, if not provided, defaults to the current time.
 * @returns {Object} - An object containing arrays for database insertion and the newly created position object.
 */
export async function createNewPosition(
  user: number,
  position: any,
  address: string | any,
  blockHeight: string | any = null,
  createdAt: string | any = null,
  type = "open"
) {
  const symbol = position.market.replace(/-/g, "");
  blockHeight = blockHeight ? blockHeight : position.createdAtHeight;
  createdAt = createdAt ? createdAt : position.createdAt;

  // Calculate realized PnL if exit price and entry price are available
  let realised_pnl =
    position.exitPrice && position.entryPrice
      ? position.sumClose *
        (Number(position.exitPrice) - Number(position.entryPrice))
      : 0;
  realised_pnl = position.side === "LONG" ? realised_pnl : -realised_pnl;

  // Prepare trader position data for database insertion
  const trader_position = {
    user,
    trade_id: `${address}-${symbol}-${position.side}-${blockHeight}`,
    trader_address: address,
    token: symbol,
    bias: position.side === "LONG" ? 1 : 0,
    size: position.size,
    sum_open: position.sumOpen,
    sum_close: position.sumClose,
    limit_price: position.entryPrice,
    exit_price: position.exitPrice,
    start_date: createdAt,
    end_date: null,
    funding: position.netFunding,
    realised_pnl: realised_pnl.toString(),
    pnl: "0",
    is_profitable: 0,
    type,
  };

  await aggregatePositions(trader_position);
  return trader_position;
}

/**
 * Updates the trading position object with new trading data,
 * recalculating the profit and loss (PnL) based on exit and entry prices.
 * The function adjusts the trading metrics such as size, open sum, limit price, exit price,
 * and funding based on the updated position data.
 *
 * @param {any} trader_position - The current trader position object to be updated.
 * @param {any} position - The new trading data that includes details like prices, size, and funding.
 * @returns {Promise<any>} - The updated trader position object with recalculated metrics.
 */
export async function updateExistingPosition(
  trader_position: any,
  position: any
) {
  let realised_pnl =
    position.exitPrice && position.entryPrice
      ? position.sumClose *
        (Number(position.exitPrice) - Number(position.entryPrice))
      : 0;
  realised_pnl = position.side === "LONG" ? realised_pnl : -realised_pnl;

  // Update data on trader position
  trader_position.size = position.size;
  trader_position.sum_open = position.sumOpen;
  trader_position.sum_close = position.sumClose;
  trader_position.limit_price = position.entryPrice;
  trader_position.exit_price = position.exitPrice;
  trader_position.funding = position.netFunding;
  trader_position.realised_pnl = realised_pnl.toString();
  trader_position.pnl = "0";
  trader_position.is_profitable = 0;
  trader_position.type = "update";

  await aggregatePositions(trader_position);
  return trader_position;
}

/**
 * Computes and prepares changes to a trader's position during a flip from one bias to another.
 * This function adjusts the trading position parameters such as size, open sum, price limits, and PnL
 * based on the closure of one position and the opening of an opposite one.
 *
 * @param {Object} trader_position - The current position object of the trader before the flip.
 * @param {Object} position - The new position details including entry price, sum open, etc.
 * @param {string} end_date - The date at which the position is considered flipped.
 * @returns {Array} - An array of updated parameters ready to be used in SQL queries or further processing.
 * @throws {Error} - Throws an error if the calculation fails, to be caught by the caller.
 */
export async function flipPosition(
  trader_position: any,
  position: any,
  end_date: string
) {
  try {
    // Compute the amount moved to the other position
    let last_position = new Decimal(position.sumOpen)
      .minus(new Decimal(position.size).abs())
      .minus(position.sumClose); // This is the amount moved the other position
    let avg_close;
    if (trader_position.exit_price) {
      avg_close = last_position
        .times(position.entryPrice)
        .add(
          new Decimal(trader_position.sum_close).times(
            trader_position.exit_price
          )
        )
        .div(new Decimal(trader_position.sum_close).add(last_position));
    } else {
      avg_close = new Decimal(position.entryPrice);
    }

    // Compute the adjusted size
    let adjusted_size = new Decimal(trader_position.sum_close).add(
      last_position
    ); // Add the closing size
    adjusted_size =
      trader_position.bias == 0
        ? new Decimal(-adjusted_size)
        : new Decimal(adjusted_size);

    // Compute pnl
    let pnl = adjusted_size
      .times(avg_close.minus(trader_position.limit_price))
      .add(trader_position.funding);

    trader_position.size = adjusted_size.toString();
    trader_position.exit_price = avg_close.toString();
    trader_position.end_date = end_date;
    trader_position.realised_pnl = "0";
    trader_position.pnl = pnl.toString();
    trader_position.is_profitable = pnl.greaterThan(0) ? 1 : 0;
    trader_position.type = "close";

    await aggregatePositions(trader_position);
    return;
  } catch (error) {
    console.error(`Error updating position during flip: ${error}`);
    throw error;
  }
}

/**
 * Closes an existing trading position by updating its status and calculating the final profit or loss (PnL).
 * This function updates the position's size, open sum, prices, and sets the end date, marking it as closed.
 *
 * @param {PoolConnection} connection - Database connection to perform SQL queries within a transaction.
 * @param {any} trader_position - Current details of the trader's position.
 * @param {any} position - Details of the trading position to be closed.
 * @param {string} end_date - The date when the position is officially closed.
 */
export async function closePosition(
  trader_position: any,
  position: any,
  end_date: string
) {
  try {
    // Calculate the size and pnl based on the trading direction
    let size =
      position.side === "LONG"
        ? new Decimal(position.sumClose)
        : new Decimal(-position.sumClose);
    let pnl = size.times(
      new Decimal(position.exitPrice).minus(position.entryPrice)
    );

    trader_position.size = size.toString();
    trader_position.limit_price = position.entryPrice;
    trader_position.exit_price = position.exitPrice;
    trader_position.end_date = end_date;
    trader_position.realised_pnl = "0";
    trader_position.pnl = pnl.toString();
    trader_position.is_profitable = pnl.greaterThan(0) ? 1 : 0;
    trader_position.type = "close";

    await aggregatePositions(trader_position);
    return;
  } catch (error) {
    console.error(`Error updating position during close: ${error}`);
    throw error; // Ensure error is propagated
  }
}

/**
 * Processes new positions in the database.
 * Inserts provided positions into the database.
 * @param {any} positions - Positions to be created.
 * @param {number} user - User ID associated with the positions.
 */
export async function processPositions(positions: any) {
  if (!positions || positions.length < 1) return;
  const newPositions = positions.map((position: any) => {
    if (
      position[position.length - 1] === "open" ||
      position[position.length - 1] === "close"
    ) {
      const message = JSON.stringify({
        trade_id: position[1],
        type: "dydx",
      });
      console.log(message);
      sendMessage(TG_TRADES_QUEUE, message, TG_NOTIFICATION_DURATION);
    }
    return position.slice(0, -1);
  });

  await sqlBatchQuery(
    `
      INSERT INTO ${SQL_TRADES_DEX} (
        user,
        trade_id,
        trader_address,
        token,
        bias,
        size,
        sum_open,
        limit_price,
        exit_price,
        start_date,
        end_date,
        funding,
        realised_pnl,
        pnl,
        is_profitable,
        timestamp
      ) 
      VALUES ?
      ON DUPLICATE KEY UPDATE 
        size = VALUES(size),
        sum_open = VALUES(sum_open),
        limit_price = VALUES(limit_price),
        exit_price = VALUES(exit_price),
        start_date = VALUES(start_date),
        end_date = VALUES(end_date),
        funding = VALUES(funding),
        realised_pnl = VALUES(realised_pnl),
        pnl = VALUES(pnl),
        is_profitable = VALUES(is_profitable),
        timestamp = VALUES(timestamp)
    `,
    newPositions
  );
}
