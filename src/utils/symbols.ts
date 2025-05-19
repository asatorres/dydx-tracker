import { REFRESH_INTERVAL } from "../constants";
import { SQL_TOKENS } from "../constants/tables";
import { sqlQuery } from "./database";

let cachedPairs: Map<string, boolean> = new Map();

/**
 * Function to start the periodic refresh of trading pairs
 */
export const startPairRefresh = () => {
  setInterval(async () => {
    await fetchAndCachePairs();
  }, REFRESH_INTERVAL);
};

/**
 * Function to fetch trading pairs from the database and cache them
 */
export const fetchAndCachePairs = async (): Promise<void> => {
  try {
    console.log("REFRESHING CACHE PAIRS");
    const query = `
       SELECT symbol FROM ${SQL_TOKENS} WHERE is_active=1`;
    const result = await sqlQuery(query);
    let newCachedPairs: Map<string, boolean> = new Map();
    result.forEach((pair: any) => newCachedPairs.set(pair.symbol, true));
    cachedPairs = newCachedPairs;
  } catch (error) {
    console.error("Error fetching trading pairs:", error);
    throw error;
  }
};

/**
 *  Function to get the cached trading pairs
 */
export const isTrackedSymbol = async (symbol: string): Promise<boolean> => {
  return cachedPairs.has(symbol);
};
