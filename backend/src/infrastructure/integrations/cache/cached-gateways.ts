// Decoradores con caché TTL para las implementaciones HTTP (docs/INTEGRACION.md, sección 2). Los mocks nunca se envuelven.
import { AcademicGateway, AcademicCourse, AcademicPeriod } from "../../../domain/gateways/academic.gateway";
import { BackofficeGateway } from "../../../domain/gateways/backoffice.gateway";
import { CoreWalletGateway, WalletAggregates } from "../../../domain/gateways/core-wallet.gateway";
import { currentMonthYm } from "../../../domain/services/period-catalog.service";
import { TtlCache } from "./ttl-cache";

export interface CacheTtls {
  static: number;
  users: number;
  courses: number;
  aggregates: number;
}

const CLOSED_MONTH_TTL_SECONDS = 86_400;
const COURSE_DETAIL_TTL_SECONDS = 1_800;

export class CachedWalletGateway implements CoreWalletGateway {
  private readonly cache = new TtlCache();

  constructor(
    private readonly inner: CoreWalletGateway,
    private readonly ttls: CacheTtls,
  ) {}

  getAggregates(from: string, to: string): Promise<WalletAggregates> {
    // Mes cerrado: 24 h fijo; mes en curso: CACHE_TTL_SECONDS_AGGREGATES.
    const closed = from.slice(0, 7) < currentMonthYm(new Date());
    return this.cache.wrap(`${from}|${to}`, closed ? CLOSED_MONTH_TTL_SECONDS : this.ttls.aggregates, () => this.inner.getAggregates(from, to));
  }
}

export class CachedBackofficeGateway implements BackofficeGateway {
  private readonly cache = new TtlCache();

  constructor(
    private readonly inner: BackofficeGateway,
    private readonly ttls: CacheTtls,
  ) {}

  listSites() {
    return this.cache.wrap("sites", this.ttls.static, () => this.inner.listSites());
  }

  getUserDisplayName(userId: string) {
    return this.cache.wrap(`user:${userId}`, this.ttls.users, () => this.inner.getUserDisplayName(userId));
  }

  invalidateUser(userId: string): void {
    this.cache.delete(`user:${userId}`);
    this.inner.invalidateUser(userId);
  }
}

export class CachedAcademicGateway implements AcademicGateway {
  private readonly cache = new TtlCache();

  constructor(
    private readonly inner: AcademicGateway,
    private readonly ttls: CacheTtls,
  ) {}

  listPeriods() {
    return this.cache.wrap("periods", this.ttls.static, () => this.inner.listPeriods());
  }
  listSites() {
    return this.cache.wrap("sites", this.ttls.static, () => this.inner.listSites());
  }
  listCareers() {
    return this.cache.wrap("careers", this.ttls.static, () => this.inner.listCareers());
  }
  listPlans(careerId: number | string) {
    return this.cache.wrap(`plans:${careerId}`, this.ttls.static, () => this.inner.listPlans(careerId));
  }
  listSubjects(planId: number | string) {
    return this.cache.wrap(`subjects:${planId}`, this.ttls.static, () => this.inner.listSubjects(planId));
  }

  // Cursos de un período cerrado: TTL estático; del período en curso: CACHE_TTL_SECONDS_COURSES.
  async listCourses(periodId: number | string): Promise<AcademicCourse[]> {
    const periods = await this.listPeriods().catch((): AcademicPeriod[] => []);
    const period = periods.find((candidate) => String(candidate.id) === String(periodId));
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    const closed = period !== undefined && period.fechaFin < today;
    return this.cache.wrap(`courses:${periodId}`, closed ? this.ttls.static : this.ttls.courses, () => this.inner.listCourses(periodId));
  }

  getCourse(courseId: number | string) {
    return this.cache.wrap(`course:${courseId}`, COURSE_DETAIL_TTL_SECONDS, () => this.inner.getCourse(courseId));
  }
}
