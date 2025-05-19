import async from "async";
import { convertToDecimal } from "../utils/functions";
import { convertToSqlDate, getSqlDate } from "../utils/database";
import { AMOUNT_DECIMALS, PRICE_DECIMALS } from "../constants";
import { TradeInterface } from "../constants/interfaces";

export let TO_PROCESS: any[] = [];

/**
 * Processor queue to handle the processing of trader positions.
 * The queue processes tasks asynchronously, converting and pushing the trader position data
 * into the TO_PROCESS array for further processing.
 *
 * @param {object} task - The task object containing the trader position to be processed.
 * @param {function} callback - The callback function to be called after processing the task.
 */
const processorQueue = async.queue(async (task: any, callback: any) => {
  try {
    // Convert trader position data to the required format and push it to TO_PROCESS
    let trader_position = task.trader_position;
    TO_PROCESS.push([
      trader_position.user,
      trader_position.trade_id,
      trader_position.trader_address,
      trader_position.token,
      trader_position.bias,
      await convertToDecimal(trader_position.size, AMOUNT_DECIMALS),
      await convertToDecimal(trader_position.sum_open, AMOUNT_DECIMALS),
      await convertToDecimal(trader_position.limit_price, PRICE_DECIMALS),
      await convertToDecimal(trader_position.exit_price, PRICE_DECIMALS),
      await convertToSqlDate(trader_position.start_date),
      trader_position.end_date === null
        ? null
        : await convertToSqlDate(trader_position.end_date),
      await convertToDecimal(trader_position.funding, AMOUNT_DECIMALS),
      await convertToDecimal(trader_position.realised_pnl, AMOUNT_DECIMALS),
      await convertToDecimal(trader_position.pnl, AMOUNT_DECIMALS),
      trader_position.is_profitable,
      await getSqlDate(),
      trader_position.type,
    ]);
    console.log(
      `NEW position for ${trader_position.trader_address} ===> `,
      TO_PROCESS.length
    );
    callback(); // Indicate task completion
  } catch (error) {
    console.log("Error on processorQueue: ", error);
    callback(error); // Indicate task failure
  }
}, 1);

/**
 * Function to aggregate trading positions by pushing them to the processor queue.
 * @param {TradeInterface} trader_position - The trader position object to be aggregated.
 */
export async function aggregatePositions(trader_position: TradeInterface) {
  processorQueue.push({ trader_position });
}

/**
 * Function to clear the processing queue by emptying the TO_PROCESS array.
 */
export async function clearQueue() {
  TO_PROCESS = [];
}
