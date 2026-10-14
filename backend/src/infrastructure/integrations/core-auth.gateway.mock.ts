// Mock de CORE (módulo 10) para login y validación de tokens, hasta que exista el real.
import { randomUUID } from "node:crypto";
import { AuthenticatedUser, AuthSession } from "../../domain/entities/user.entity";
import { CoreAuthGateway } from "../../domain/gateways/core-auth.gateway";

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

// Contraseña de las cuentas de demo. Es un mock local: en producción la valida CORE.
const DEMO_PASSWORD = "uadenet2026";

interface DirectoryEntry extends AuthenticatedUser {
  password: string;
}

// Personal administrativo con acceso a Analítica. Cada mail determina los roles (y por lo
// tanto qué tableros se ven), igual que los roles que CORE asigna desde Backoffice.
const DIRECTORY: DirectoryEntry[] = [
  {
    email: "direccion.academica@uade.edu.ar",
    name: "Dirección Académica",
    roles: ["academica"],
    password: DEMO_PASSWORD,
  },
  {
    email: "direccion.financiera@uade.edu.ar",
    name: "Dirección Financiera",
    roles: ["financiera"],
    password: DEMO_PASSWORD,
  },
  {
    email: "direccion.general@uade.edu.ar",
    name: "Dirección General",
    roles: ["academica", "financiera"],
    password: DEMO_PASSWORD,
  },
];

interface StoredSession {
  user: AuthenticatedUser;
  expiresAt: number;
}

export class CoreAuthGatewayMock implements CoreAuthGateway {
  private readonly sessions = new Map<string, StoredSession>();

  async login(email: string, password: string): Promise<AuthSession | null> {
    const entry = DIRECTORY.find(
      (candidate) => candidate.email === email.trim().toLowerCase() && candidate.password === password,
    );
    if (!entry) return null;

    const user: AuthenticatedUser = { email: entry.email, name: entry.name, roles: entry.roles };
    const token = randomUUID();
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    this.sessions.set(token, { user, expiresAt });

    return { token, expiresAt: new Date(expiresAt).toISOString(), user };
  }

  async validateToken(token: string): Promise<AuthenticatedUser | null> {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }

    return session.user;
  }
}
