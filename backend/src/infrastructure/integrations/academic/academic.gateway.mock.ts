// Académica mock: mocks/academic/** (un archivo por clave; el contenido es literalmente el body). Ver docs/INTEGRACION.md, 5.1.
import {
  AcademicCareer, AcademicCourse, AcademicCourseDetail, AcademicGateway, AcademicPeriod, AcademicPlan, AcademicSite, AcademicSubject,
} from "../../../domain/gateways/academic.gateway";
import { GatewayError } from "../../../domain/gateways/gateway-error";
import { MockFileStore } from "../mock/mock-file-store";

export class AcademicGatewayMock implements AcademicGateway {
  constructor(private readonly store: MockFileStore) {}

  async listPeriods(): Promise<AcademicPeriod[]> {
    return this.requiredList("periodos.json");
  }
  async listSites(): Promise<AcademicSite[]> {
    return this.requiredList("sedes.json");
  }
  async listCareers(): Promise<AcademicCareer[]> {
    return this.requiredList("carreras.json");
  }
  async listPlans(careerId: number | string): Promise<AcademicPlan[]> {
    const content = await this.store.readOrNotFound("academic", `planes/${this.store.key("academic", careerId)}.json`, "Carrera");
    return asList(content, `planes/${careerId}.json`);
  }
  async listSubjects(planId: number | string): Promise<AcademicSubject[]> {
    const content = await this.store.readOptional("academic", `asignaturas/${this.store.key("academic", planId)}.json`);
    return content === undefined ? [] : asList(content, `asignaturas/${planId}.json`);
  }
  async listCourses(periodId: number | string): Promise<AcademicCourse[]> {
    const content = await this.store.readOptional("academic", `cursos/${this.store.key("academic", periodId)}.json`);
    return content === undefined ? [] : asList(content, `cursos/${periodId}.json`);
  }
  async getCourse(courseId: number | string): Promise<AcademicCourseDetail> {
    const content = await this.store.readOrNotFound("academic", `curso-detalle/${this.store.key("academic", courseId)}.json`, "Curso");
    return content as AcademicCourseDetail;
  }

  private async requiredList<T>(file: string): Promise<T[]> {
    return asList(await this.store.readRequired("academic", file), file);
  }
}

function asList<T>(content: unknown, file: string): T[] {
  if (!Array.isArray(content)) {
    throw new GatewayError("academic", 500, "MOCK_INVALID_JSON", `mocks/academic/${file} debe ser una lista.`);
  }
  return content as T[];
}
