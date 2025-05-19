import dotenv from "dotenv";
dotenv.config();

export const DYDX_WEBSOCKET_URI = process.env.DYDX_WEBSOCKET_URI as string;
export const DYDX_SUBACCOUNTS_CHANNEL = process.env
  .DYDX_SUBACCOUNTS_CHANNEL as string;
export const SERVER_GROUP = process.env.SERVER_GROUP;

// Refreshing jobs
export const RECONNECT_INTERVAL = 1000;
export const REFRESH_INTERVAL = 600000; // Refresh interval of cached trading pairs
export const UDPATE_INTERVAL = 10; // Process all positions interval (in seconds)
export const TRADER_REFRESH_INTERVAL = 300000; // Refresh interval of cached trading pairs

// Page sizes
export const PAGE_SIZE_TRADES = 100; // For transversing trades

// Precision
export const AMOUNT_DECIMALS = 6;
export const PRICE_DECIMALS = 18;

export const DUMMY_DATE = "2024-03-31 09:08:12";
