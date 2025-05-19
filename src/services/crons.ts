import cron from "node-cron";
import { TO_PROCESS, clearQueue } from "./processor";
import { processPositions } from "../utils/functions";
import { UDPATE_INTERVAL } from "../constants";

let is_processing = false;

/**
 * Schedules a cron job to insert or update trades in the database.
 * The job runs every 10 seconds, processes the trades to be inserted or updated,
 * clears the to_create queue, and logs the processing status.
 * If an error occurs during processing, it logs the error message.
 *
 * @returns {CronJob} - The scheduled cron job.
 */
export const insertTrades = cron.schedule(
  `*/${UDPATE_INTERVAL} * * * * *`, // Runs every 10 secs
  async () => {
    if (is_processing) return;
    is_processing = true;
    // Clear the queue before processing new trades
    let to_process = TO_PROCESS;
    await clearQueue();
    console.log("PROCESSING TRADES... ", to_process.length);
    try {
      // Process the positions to be inserted or updated in the database
      await processPositions(to_process);
    } catch (error) {
      console.log("Error on insertTrades cron job: ", error);
    } finally {
      is_processing = false;
    }
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);
