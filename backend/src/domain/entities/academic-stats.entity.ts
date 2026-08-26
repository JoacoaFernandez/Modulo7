// Domain entities: core business objects, independent of frameworks and infrastructure.

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
