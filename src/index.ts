import { TRADER_REFRESH_INTERVAL } from "./constants";
import { insertTrades } from "./services/crons";
import { initWebSocketTraderMemory } from "./services/websocket";
import { fetchAndCachePairs, startPairRefresh } from "./utils/symbols";
import { getTraders } from "./utils/trading";

let cachedTraders = new Set<string>();
let socketSubscriptions = new Map();

/**
 * Function to start the periodic refresh of traders
 * subscriptions
 */
const startTradersRefresh = () => {
  setInterval(async () => {
    await connectToTraders();
  }, TRADER_REFRESH_INTERVAL);
};

async function connectToTraders() {
  try {
    // Fetch new traders
    const traders = await getTraders();
    const newTraders = new Set(traders.map((p) => p.address));

    // Unsubscribe traders no longer active
    socketSubscriptions.forEach(async (_, trader) => {
      if (!newTraders.has(trader)) {
        let socket = socketSubscriptions.get(trader);
        await socket.closeConnection();
        socketSubscriptions.delete(trader);
      }
    });

    // Subscribe new trader
    traders.forEach(async (trader) => {
      if (!socketSubscriptions.has(trader.address)) {
        let socket = await initWebSocketTraderMemory(
          trader.address,
          trader.user
        );
        socketSubscriptions.set(trader.address, socket);
      }
    });
    return;
  } catch (error) {
    console.log("Error connecting to traders", error);
    throw error;
  }
}

/**
 * Initiates the application by establishing WebSocket connections.
 *
 * This function is the entry point for starting up the application. It calls the `initWebSocket`
 * function to establish WebSocket connections necessary for real-time data communication. Including
 * error handling within this startup process ensures that any issues encountered during WebSocket
 * initialization are caught and logged, preventing unhandled promise rejections and allowing for
 * potential recovery actions.
 */
const startApp = async () => {
  console.log("Initializing application...");
  await fetchAndCachePairs(); // Fetch and cache trading pairs at startup
  startPairRefresh(); // Periodic refresh of cached pairs

  await connectToTraders();
  startTradersRefresh(); // Periodic refresh of traders pairs
  await insertTrades.start();
};

// Execute the startApp function to start the application.
startApp();
