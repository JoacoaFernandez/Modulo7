// CORE: agregados de wallet (GET /internal/v1/wallets/aggregates). Sin identificadores de personas.
export type WalletGroupType = "CREDIT" | "DEBIT" | "REVERSAL";

export interface WalletAggregateGroup {
  // TOP_UP, PAYROLL, SCHOLARSHIP, STORE_PURCHASE, DINING_RESERVATION, LIBRARY_FINE, EVENT_REGISTRATION, REFUND...
  key: string;
  type: WalletGroupType;
  count: number;
  // Decimal como texto ("6120000.00"): nunca número.
  total: string;
}

export interface WalletAggregates {
  range: { from: string; to: string };
  currency: string;
  outstandingBalance: string;
  walletCount: number;
  groups: WalletAggregateGroup[];
}

export interface CoreWalletGateway {
  // `from` y `to` en AAAA-MM-DD; se pide un mes por llamada.
  getAggregates(from: string, to: string): Promise<WalletAggregates>;
}
