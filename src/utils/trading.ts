import { SERVER_GROUP } from "../constants";
import { CLOSED_STATUS, OPEN_STATUS } from "../constants/dydx";
import {
  SQL_TRADES_DEX,
  SQL_USERS,
  SQL_USERS_WALLETS,
} from "../constants/tables";
import { sqlQuery } from "./database";
import {
  closePosition,
  createNewPosition,
  flipPosition,
  updateExistingPosition,
} from "./functions";
import { isTrackedSymbol } from "./symbols";

/**
 * Fetches a list of active traders from the database filtered by the server group.
 *
 * @returns {Promise<any[]>} A promise that resolves to an array of objects, each representing an active trader.
 * @throws {Error} Throws an error if the database query fails, to be handled by the caller.
 */
export const getTraders = async (): Promise<any[]> => {
  try {
    const result = await sqlQuery(
      `
        SELECT user, address FROM ${SQL_USERS_WALLETS} 
        WHERE trader_type=3 AND server_group=? AND is_active=1`,
      [SERVER_GROUP]
    );

    return result;
  } catch (error) {
    console.error("Error fetching traders: ", error);
    throw error;
  }
};

/**
 * Processes new subscription data for a dYdX trader, initializing their trading positions.
 * This function takes the current state of trader positions and updates it based on incoming data,
 * ensuring that only new and tracked symbols are added to the trader's portfolio.
 *
 * @param {number} user - The id corresponding the user for the given trader.
 * @param {Map} TRADER_POSITIONS - A map containing the current state of trader positions.
 * @param {string} traderAddress - The blockchain address of the trader.
 * @param {Object} positions - The positions data from the subscription, keyed by symbol.
 * @returns {Promise<Object>} Returns an object containing the updated trader positions and an array of new positions to be created.
 */
export const processSubscriptions = async (
  user: number,
  TRADER_POSITIONS: any,
  traderAddress: string,
  positions: any
): Promise<any> => {
  if (!positions || Object.keys(positions).length === 0) return;

  try {
    // Iterate over all the positions
    for (const symbol_ in positions) {
      try {
        // Get trader position
        const symbol = symbol_.replace(/-/g, "");
        if (!(await isTrackedSymbol(symbol))) continue;
        if (TRADER_POSITIONS.get(symbol)) continue;
        const position = positions[symbol_];

        // Fill trade position
        const new_position = await createNewPosition(
          user,
          position,
          traderAddress,
          position?.createdAtHeight,
          position?.createdAt,
          "update"
        );

        TRADER_POSITIONS.set(symbol, new_position);
      } catch (error) {
        console.log(
          `Error generation subscription for ${traderAddress}: `,
          error
        );
        continue;
      }
    }

    return;
  } catch (error) {
    console.error("Error processing subscription: ", error);
    throw error;
  }
};

/**
 * Updates or initializes trading positions based on the latest trading data.
 * This function handles creating new positions, updating existing ones, changing position bias,
 * and closing positions entirely.
 *
 * @param {number} user - The id corresponding the user for the given trader.
 * @param {Map} TRADER_POSITIONS - A map containing the current state of trader positions.
 * @param {string} traderAddress - The blockchain address of the trader.
 * @param {Array} positions - Array of current positions for the trader.
 * @param {Array} fills - Array of fill data that might affect position calculations.
 * @returns {Promise<Object>} Returns an object containing maps and arrays of updates to process.
 */
export const updatePosition = async (
  user: number,
  TRADER_POSITIONS: any,
  traderAddress: string,
  positions: any,
  fills: any
) => {
  if (!fills) return;
  if (!positions) return;

  try {
    // Iterate over all the positions
    for (const position of positions) {
      try {
        const symbol = position.market.replace(/-/g, "");
        const bias = position.side == "LONG" ? 1 : 0;
        if (!(await isTrackedSymbol(symbol))) continue;
        let trader_position = !TRADER_POSITIONS.has(symbol)
          ? {}
          : TRADER_POSITIONS.get(symbol);

        // CASE 1: create completely new position
        if (!TRADER_POSITIONS.has(symbol)) {
          console.log("CASE 1 --> new position: ", traderAddress);
          trader_position = await createNewPosition(
            user,
            position,
            traderAddress,
            fills[0].createdAtHeight,
            fills[0].createdAt
          );
        }

        // CASE 2: update existing position
        else if (
          position.status == OPEN_STATUS &&
          trader_position.bias === bias
        ) {
          console.log("CASE 2 --> update position: ", traderAddress);
          trader_position = await updateExistingPosition(
            trader_position,
            position
          );
        }

        // CASE 3: change direction of the position
        else if (
          position.status == OPEN_STATUS &&
          trader_position.bias !== bias
        ) {
          console.log("CASE 3 --> change position: ", traderAddress);
          await flipPosition(trader_position, position, fills[0].createdAt);
          trader_position = await createNewPosition(
            user,
            position,
            traderAddress,
            fills[0].createdAtHeight,
            fills[0].createdAt
          );
        }

        // CASE 4: close completely the position
        else if (position.status == CLOSED_STATUS) {
          console.log("CASE 4 --> close position: ", traderAddress);
          await closePosition(trader_position, position, fills[0].createdAt);
          trader_position = null;
        } else throw "Unrecognised case";

        if (!trader_position) TRADER_POSITIONS.delete(symbol);
        else TRADER_POSITIONS.set(symbol, trader_position);
      } catch (error) {
        console.log(
          `Error updating position for ${traderAddress} and: `,
          error
        );
      }
    }
    return;
  } catch (error) {
    console.error(
      `Error processing updates of position of ${traderAddress}`,
      error
    );
    throw error;
  }
};
