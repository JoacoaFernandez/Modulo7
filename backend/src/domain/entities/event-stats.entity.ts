// Domain entities: core business objects, independent of frameworks and infrastructure.
import { SourceModule } from "./event-source.entity";

export interface EventTypeStats {
  // Se agrupa por tipo de evento, no por evento puntual.
  eventType: string;
  // Eventos por mes de ese tipo.
  frequency: number;
  // Concurrencia promedio por evento.
  attendeesCount: number;
  attendanceRate: number;
}

export interface EventMonthlyPoint {
  month: string;
  shortMonth: string;
  eventsCount: number;
  attendeesCount: number;
  attendanceRate: number;
}

export interface EventAttendanceHighlight {
  eventType: string;
  attendanceRate: number;
}

export interface EventStats {
  siteName: string;
  month: string;
  totalEvents: number;
  totalAttendees: number;
  totalRegistered: number;
  averageAttendanceRate: number;
  // Concurrencia sobre el cupo ofrecido.
  capacityOccupancy: number;
  bestAttendance: EventAttendanceHighlight;
  worstAttendance: EventAttendanceHighlight;
  // Hasta seis meses, terminando en el seleccionado: barras de frecuencia y área de concurrencia.
  monthlySeries: EventMonthlyPoint[];
  eventTypes: EventTypeStats[];
  sourceModules: SourceModule[];
  // Último evento recibido de cualquier módulo (ISO 8601); null si no hay ninguno.
  lastIngestionAt: string | null;
}
