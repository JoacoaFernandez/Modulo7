// Domain entities: core business objects, independent of frameworks and infrastructure.

export interface InstitutionalBalance {
  siteName: string;
  balance: number;
}

export interface AdministrativeExpense {
  category: string;
  amount: number;
}

export interface TopSellingProduct {
  productName: string;
  unitsSold: number;
  revenue: number;
}

export interface DiningRevenue {
  siteName: string;
  revenue: number;
}

export interface FinancialStats {
  institutionalBalances: InstitutionalBalance[];
  administrativeExpenses: AdministrativeExpense[];
  topSellingProducts: TopSellingProduct[];
  diningRevenues: DiningRevenue[];
}
