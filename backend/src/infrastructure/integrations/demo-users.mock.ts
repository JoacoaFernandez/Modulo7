// Personal administrativo de demo, compartido por los mocks de CORE (identidad y login) y de
// Backoffice (ficha). En el ecosistema real el userId lo genera Backoffice y CORE lo replica.
import { ANALYTICS_PERMISSIONS } from "../../domain/entities/role.entity";
import { SITE_IDS } from "./backoffice-sites.gateway.mock";

// Contraseña de las cuentas de demo. Es un mock local: en el ecosistema real la valida CORE.
export const DEMO_PASSWORD = "uadenet2026";

export interface DemoUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  siteId: string;
}

// Cada cuenta tiene los permisos de un tablero (o los dos), igual que los que Backoffice
// asignaría a Dirección Académica y Dirección Financiera.
export const DEMO_USERS: DemoUser[] = [
  {
    userId: "6b1f2c3d-4e5a-4b6c-8d7e-9f0a1b2c3d4e",
    email: "direccion.academica@uade.edu.ar",
    firstName: "Lucía",
    lastName: "Fernández",
    roles: ["ADMIN_STAFF"],
    permissions: [ANALYTICS_PERMISSIONS.academic],
    siteId: SITE_IDS.centro,
  },
  {
    userId: "7c2a3d4e-5f6b-4c7d-9e8f-0a1b2c3d4e5f",
    email: "direccion.financiera@uade.edu.ar",
    firstName: "Martín",
    lastName: "Herrera",
    roles: ["ADMIN_STAFF"],
    permissions: [ANALYTICS_PERMISSIONS.finance],
    siteId: SITE_IDS.centro,
  },
  {
    userId: "8d3b4e5f-6a7c-4d8e-8f9a-1b2c3d4e5f60",
    email: "direccion.general@uade.edu.ar",
    firstName: "Carolina",
    lastName: "Ruiz",
    roles: ["ADMIN_STAFF"],
    permissions: [ANALYTICS_PERMISSIONS.academic, ANALYTICS_PERMISSIONS.finance],
    siteId: SITE_IDS.centro,
  },
];
