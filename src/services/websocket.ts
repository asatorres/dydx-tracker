import WebSocket from "ws";
import {
  DYDX_SUBACCOUNTS_CHANNEL,
  DYDX_WEBSOCKET_URI,
  RECONNECT_INTERVAL,
} from "../constants";
import { DATA_TYPE, PING_INTERVAL, SUBSCRIPTION_TYPE } from "../constants/dydx";
import { processSubscriptions, updatePosition } from "../utils/trading";
import { TradeInterface } from "../constants/interfaces";
import async from "async";

/**
 * Resets the heartbeat timer for WebSocket connection.
 * Ensures reconnection if no ping or messages are received within the PING_INTERVAL.
 * @param {WebSocket} websocket - The WebSocket connection to reset the timer for.
 */
let heartbeatTimer: NodeJS.Timeout;
function resetHeartbeatTimer(websocket: WebSocket) {
  clearTimeout(heartbeatTimer);
  heartbeatTimer = setTimeout(() => {
    console.log("No ping or messages received for 30 seconds, reconnecting...");
    websocket.close(); // Close the existing connection to trigger the 'close' event handler, which should handle reconnection
  }, PING_INTERVAL);
}

/**
 * Initializes and manages a WebSocket connection to dYdX.
 * @param {string} address_ - The address to subscribe to.
 * @param {number} user_ - The user ID associated with the address.
 */
export async function initWebSocketTraderMemory(
  address_: string,
  user_: number
) {
  let intervalId: any = null;
  let websocket: any = null;
  let shouldReconnect = true; // Flag to control reconnection

  /**
   * Establishes a WebSocket connection and sets up event listeners.
   * It handles connection initialization, message handling, errors,
   * and reconnections.
   */
  function connect() {
    websocket = new WebSocket(DYDX_WEBSOCKET_URI);
    const channel = DYDX_SUBACCOUNTS_CHANNEL;
    const address = address_;
    const user = user_;
    let TRADER_POSITIONS: Map<string, TradeInterface> = new Map();

    /**
     * Creates a queue object with concurrency 1.
     * Ensures that messages are processed sequentially.
     */
    let messageQueue = async.queue(async (task: any, callback: any) => {
      try {
        // Parse the incoming message, assuming it's in JSON format.
        const parsedMessage = JSON.parse(task.data.toString());
        const account = parsedMessage.id?.split("/")[0];
        const formattedMessage = JSON.stringify(parsedMessage, null, 4);

        // Force reconnection if account is undefined
        if (
          parsedMessage.account === "undefined" ||
          parsedMessage.account === null
        ) {
          console.error(
            "Message for undefined account received, forcing reconnection."
          );
          websocket.close(); // Close the connection to trigger the 'close' event
          return;
        }

        // TYPE 1 --> subscription
        if (parsedMessage.type == SUBSCRIPTION_TYPE) {
          await processSubscriptions(
            user,
            TRADER_POSITIONS,
            account,
            parsedMessage?.contents?.subaccount?.openPerpetualPositions
          );
          return callback();
        }
        // TYPE 2 --> data (some change on position)
        if (parsedMessage.type == DATA_TYPE) {
          await updatePosition(
            user,
            TRADER_POSITIONS,
            account,
            parsedMessage?.contents?.perpetualPositions,
            parsedMessage?.contents?.fills
          );
          return callback();
        }
      } catch (error) {
        // Log any errors that occur during message processing.
        console.error("Error processing incoming WebSocket message:", error);
        setTimeout(connect, RECONNECT_INTERVAL);
      }
      callback(); // Indicate that the task has completed
    }, 1);

    /**
     * Handles the WebSocket 'open' event by subscribing active traders to the dYdX subaccounts channel.
     * Once the WebSocket connection to the dYdX server is established, this handler fetches a list of
     * active traders from the database. It then constructs a subscription message for each trader and
     * sends it over the WebSocket connection.
     */
    websocket.on("open", async () => {
      console.log("Connected to the dYdX server.");
      try {
        const subscriptionMessage = {
          type: "subscribe",
          channel: channel,
          id: `${address}/0`, // Assumed subscription ID format
        };
        websocket.send(JSON.stringify(subscriptionMessage));
        resetHeartbeatTimer(websocket);
        console.log(`Subscribed to trader: ${address} (user ${user})`);
      } catch (error) {
        console.error("Failed to subscribe traders to dYdX updates:", error);
      }
    });

    /**
     * Handles incoming WebSocket messages from the dYdX server.
     * This event listener is triggered whenever a new message is received over the WebSocket connection.
     * It assumes that the incoming message is in JSON format and contains information about transfers
     * related to a trader's subaccount.
     */
    websocket.on("message", async (data: any) => {
      messageQueue.push({ data }, (err) => {
        if (err) {
          console.error("Failed to process message", err);
        }
      });
    });

    /**
     * WebSocket Event Handler: 'error'
     * This handler is activated upon encountering an error with the WebSocket connection.
     * @param {Error} error - The error object representing the issue encountered.
     */
    websocket.on("error", (error: any) => {
      console.log("Failed to connect properly, received error:", error);
      setTimeout(connect, RECONNECT_INTERVAL);
    });

    /**
     * WebSocket Event Handler: 'close'
     * This handler is triggered when the WebSocket connection is closed by the server.
     */
    websocket.on("close", (code: any, reason: any) => {
      console.log(
        `WebSocket closed ${address}. Code: ${code}, Reason: ${reason}`
      );
      if (shouldReconnect) {
        console.log("Attempting to reconnect...");
        setTimeout(connect, RECONNECT_INTERVAL);
      } else {
        console.log("Disconnection was intentional, not reconnecting.");
      }
    });

    websocket.on("ping", () => {
      // console.log("PING RECEIVED! ", address);
      resetHeartbeatTimer(websocket);
    });
  }

  connect();

  // Methods to manage the WebSocket connection
  return {
    closeConnection: async function () {
      clearInterval(intervalId); // Clear the interval
      clearInterval(heartbeatTimer);
      shouldReconnect = false; // Prevent reconnection
      if (websocket) {
        websocket.close(); // Close the WebSocket
        console.log(`Closed WebSocket connection for ${address_}`);
      }
    },
  };
}
