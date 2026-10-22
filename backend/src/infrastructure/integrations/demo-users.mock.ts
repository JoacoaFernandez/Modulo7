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

// Roles del catálogo de CORE: Backoffice asigna el rol y CORE pone en el JWT los permisos de
// ese rol. Los permisos analytics:* son un supuesto nuestro: se los pedimos a CORE para
// ACADEMIC_ADMIN (Dirección Académica) y FINANCE_ADMIN (Dirección Financiera).
const ACADEMIC_ADMIN_PERMISSIONS = ["wallet:read:self", "wallet:credit:self", "academic:manage", ANALYTICS_PERMISSIONS.academic];
const FINANCE_ADMIN_PERMISSIONS = [
  "wallet:read:self",
  "wallet:credit:self",
  "wallet:read:any",
  "wallet:read:aggregates",
  "wallet:credit:any",
  "wallet:admin",
  ANALYTICS_PERMISSIONS.finance,
];
export const DEMO_USERS: DemoUser[] = [
  {
    userId: "6b1f2c3d-4e5a-4b6c-8d7e-9f0a1b2c3d4e",
    email: "direccion.academica@uade.edu.ar",
    firstName: "Lucía",
    lastName: "Fernández",
    roles: ["ACADEMIC_ADMIN"],
    permissions: ACADEMIC_ADMIN_PERMISSIONS,
    siteId: SITE_IDS.centro,
  },
  {
    userId: "7c2a3d4e-5f6b-4c7d-9e8f-0a1b2c3d4e5f",
    email: "direccion.financiera@uade.edu.ar",
    firstName: "Martín",
    lastName: "Herrera",
    roles: ["FINANCE_ADMIN"],
    permissions: FINANCE_ADMIN_PERMISSIONS,
    siteId: SITE_IDS.centro,
  },
  {
    userId: "8d3b4e5f-6a7c-4d8e-8f9a-1b2c3d4e5f60",
    email: "direccion.general@uade.edu.ar",
    firstName: "Carolina",
    lastName: "Ruiz",
    // Con varios roles, CORE une los permisos de todos.
    roles: ["ACADEMIC_ADMIN", "FINANCE_ADMIN"],
    permissions: [...new Set([...ACADEMIC_ADMIN_PERMISSIONS, ...FINANCE_ADMIN_PERMISSIONS])],
    siteId: SITE_IDS.centro,
  },
];
