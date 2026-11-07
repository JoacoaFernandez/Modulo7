// Gestión Académica real (G9): rutas en academic.routes.ts, sin paginación.
import {
  AcademicCareer, AcademicCourse, AcademicCourseDetail, AcademicGateway, AcademicPeriod, AcademicPlan, AcademicSite, AcademicSubject,
} from "../../../domain/gateways/academic.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { HttpClient } from "../http/http-client";
import { ACADEMIC_ROUTES } from "./academic.routes";

export class AcademicGatewayHttp implements AcademicGateway {
  constructor(private readonly http: HttpClient) {}

  listPeriods(): Promise<AcademicPeriod[]> {
    return this.list(ACADEMIC_ROUTES.periods());
  }
  listSites(): Promise<AcademicSite[]> {
    return this.list(ACADEMIC_ROUTES.sites());
  }
  listCareers(): Promise<AcademicCareer[]> {
    return this.list(ACADEMIC_ROUTES.careers());
  }
  listPlans(careerId: number | string): Promise<AcademicPlan[]> {
    return this.list(ACADEMIC_ROUTES.plans(careerId));
  }
  listSubjects(planId: number | string): Promise<AcademicSubject[]> {
    return this.list(ACADEMIC_ROUTES.subjects(planId));
  }
  listCourses(periodId: number | string): Promise<AcademicCourse[]> {
    return this.list(ACADEMIC_ROUTES.courses(), { periodoId: periodId });
  }
  async getCourse(courseId: number | string): Promise<AcademicCourseDetail> {
    return this.http.request<AcademicCourseDetail>({ path: ACADEMIC_ROUTES.course(courseId) });
  }

  private async list<T>(path: string, query?: Record<string, string | number>): Promise<T[]> {
    const body = await this.http.request<T[]>({ path, query });
    if (!Array.isArray(body)) {
      throw new GatewayError("academic", 502, "INVALID_RESPONSE", `Gestión Académica devolvió algo que no es una lista en ${path}.`);
    }
    return body;
  }
}
