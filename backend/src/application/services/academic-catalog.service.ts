// Services: lógica de aplicación compartida entre casos de uso.
import { AcademicGateway } from "../../domain/gateways/academic.gateway";

export interface SubjectInfo {
  codigo: string;
  nombre: string;
  facultad: string;
}

export interface AcademicCatalog {
  // asignaturaId (como texto) → código, nombre y facultad de su carrera.
  subjects: Map<string, SubjectInfo>;
  // Facultades distintas, ordenadas.
  faculties: string[];
}

// Recorre carreras → planes → asignaturas y arma el catálogo. La materia se agrupa por `codigo` (varios planes
// repiten asignaturas con ids distintos). Con `ttlSeconds` > 0 lo recorre una vez por TTL; con 0 (modo mock) lo
// rearma en cada llamada para que editar los .json se vea de inmediato.
export class AcademicCatalogService {
  private cached: { catalog: AcademicCatalog; expiresAt: number } | null = null;
  private pending: Promise<AcademicCatalog> | null = null;

  constructor(
    private readonly academic: AcademicGateway,
    private readonly ttlSeconds: number,
  ) {}

  async get(): Promise<AcademicCatalog> {
    if (this.ttlSeconds > 0 && this.cached && this.cached.expiresAt > Date.now()) return this.cached.catalog;

    this.pending ??= this.build()
      .then((catalog) => {
        if (this.ttlSeconds > 0) this.cached = { catalog, expiresAt: Date.now() + this.ttlSeconds * 1000 };
        return catalog;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }

  private async build(): Promise<AcademicCatalog> {
    const careers = await this.academic.listCareers();
    const subjects = new Map<string, SubjectInfo>();

    for (const career of careers) {
      const plans = await this.academic.listPlans(career.id);
      for (const plan of plans) {
        for (const subject of await this.academic.listSubjects(plan.id)) {
          subjects.set(String(subject.id), { codigo: subject.codigo, nombre: subject.nombre, facultad: career.facultad });
        }
      }
    }

    const faculties = [...new Set(careers.map((career) => career.facultad).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    return { subjects, faculties };
  }
}
