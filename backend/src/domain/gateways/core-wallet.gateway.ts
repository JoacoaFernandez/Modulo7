// CORE: agregados de wallet (GET /internal/v1/wallets/aggregates). Sin identificadores de personas.
export type WalletGroupType = "CREDIT" | "DEBIT" | "REVERSAL";

export interface WalletAggregateGroup {
  // TOP_UP, PAYROLL, SCHOLARSHIP, STORE_PURCHASE, DINING_RESERVATION, LIBRARY_FINE, EVENT_REGISTRATION, REFUND...
  key: string;
  type: WalletGroupType;
  count: number;
  // Sólo con groupBy=month: mes calendario argentino ("2026-11") al que pertenece el grupo.
  month?: string;
  // Decimal como texto ("6120000.00"): nunca número.
  total: string;
}

export interface WalletAggregates {
  // Lo que se pidió (null en lo no enviado). Con `to`, outstandingBalance y walletCount son a esa fecha.
  range?: { from: string | null; to: string | null };
  currency: string;
  outstandingBalance: string;
  walletCount: number;
  groups: WalletAggregateGroup[];
}

// `from` y `to` en ISO-8601 (`from` incluido, `to` excluido); ver walletMonthsQuery para armarlos por mes argentino.
export interface WalletAggregatesQuery {
  from: string;
  to: string;
  // "month": cada grupo trae `month`. Sin él, los grupos se suman por concepto en todo el rango.
  groupBy?: "month";
}

export interface CoreWalletGateway {
  // fecha inválida, from >= to o groupBy distinto de "month": GatewayError 400 WALLET_AGGREGATES_INVALID_QUERY.
  getAggregates(query: WalletAggregatesQuery): Promise<WalletAggregates>;
}
