// Domain entities: core business objects, independent of frameworks and UI.

export interface SubjectApprovalRate {
  subjectName: string;
  quarter: string;
  approvalRate: number;
}

export interface TeacherApprovalRate {
  teacherName: string;
  subjectName: string;
  approvalRate: number;
}

export interface ApprovalRateHistoryPoint {
  quarter: string;
  approvalRate: number;
}

export interface AcademicStats {
  activeSubjectsCount: number;
  activeSubjectsTrend: string;
  overallApprovalRate: number;
  overallApprovalRateTrend: string;
  evaluatedTeachersCount: number;
  subjectsWithoutDataCount: number;
  subjectApprovalRates: SubjectApprovalRate[];
  teacherApprovalRates: TeacherApprovalRate[];
  approvalRateHistory: ApprovalRateHistoryPoint[];
}

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

export interface EventStats {
  eventName: string;
  frequency: number;
  attendeesCount: number;
  capacity: number;
  attendanceRate: number;
}
