// Domain entities: core business objects, independent of frameworks and infrastructure.

export interface EventStats {
  eventName: string;
  frequency: number;
  attendeesCount: number;
  capacity: number;
  attendanceRate: number;
}
