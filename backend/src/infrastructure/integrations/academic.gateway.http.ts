// Gateway real hacia Gestión Académica (módulo 9). Se consulta directo a su backend, sin pasar
// por el gateway de CORE, con el token de servicio. Las rutas y los nombres de campo son los
// que G9 expone hoy (/api/planificacion/*, en castellano); acá se traducen a los nuestros.
import { AcademicPeriod, AcademicPeriodsGateway } from "../../domain/gateways/academic-periods.gateway";
import { CoreServiceAuthGateway } from "../../domain/gateways/core-service-auth.gateway";
import { getAsService } from "./service-http";

// Los períodos cambian pocas veces por año: se cachean unos minutos.
const PERIODS_TTL_MS = 5 * 60 * 1000;

interface PeriodoDto {
  id: number | string;
  anio: number;
  numero: number;
  fechaInicio: string;
  fechaFin: string;
}

export class AcademicPeriodsGatewayHttp implements AcademicPeriodsGateway {
  private cached: { periods: AcademicPeriod[]; expiresAt: number } | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly serviceAuth: CoreServiceAuthGateway,
  ) {}

  async listPeriods(): Promise<AcademicPeriod[]> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.periods;

    const periodos = await getAsService<PeriodoDto[]>(this.serviceAuth, `${this.baseUrl}/api/planificacion/periodos`);
    const periods = (periodos ?? []).map((periodo) => ({
      id: String(periodo.id),
      year: periodo.anio,
      number: periodo.numero,
      startDate: periodo.fechaInicio,
      endDate: periodo.fechaFin,
    }));

    this.cached = { periods, expiresAt: Date.now() + PERIODS_TTL_MS };
    return periods;
  }
}
