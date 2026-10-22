// Gateways: contratos hacia otros módulos de UADEnet. La implementación real habla HTTP con
// ese módulo; hoy hay un mock en infrastructure/integrations.

// Ficha de una persona (GET /api/v1/users/{userId} de Backoffice). CORE no es un directorio:
// el nombre a mostrar sale de acá.
export interface BackofficeUser {
  userId: string;
  firstName: string;
  lastName: string;
  roles: string[];
  status: "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED" | "DISABLED";
  siteId: string;
}

// Backoffice Administrativo (módulo 8): dueño de la identidad de las personas.
export interface BackofficeUsersGateway {
  // null si el userId no existe.
  getUser(userId: string): Promise<BackofficeUser | null>;
}
