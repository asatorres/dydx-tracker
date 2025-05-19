/**
 * Structure for a DEX trade
 */
export interface TradeInterface {
  user: number;
  trade_id: string | any;
  trader_address: string | any;
  token: string | any;
  bias: number;
  size: string;
  sum_open: string;
  sum_close: string;
  limit_price: string;
  exit_price: string;
  start_date: string;
  end_date: string | any;
  funding: string;
  realised_pnl: string;
  pnl: string;
  is_profitable: number;
}
