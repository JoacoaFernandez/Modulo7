// Mock de Backoffice (módulo 8): ficha de usuario con el shape de GET /api/v1/users/{userId}.
import { BackofficeUser, BackofficeUsersGateway } from "../../domain/gateways/backoffice-users.gateway";
import { DEMO_USERS } from "./demo-users.mock";

export class BackofficeUsersGatewayMock implements BackofficeUsersGateway {
  async getUser(userId: string): Promise<BackofficeUser | null> {
    const user = DEMO_USERS.find((candidate) => candidate.userId === userId);
    if (!user) return null;

    return {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      status: "ACTIVE",
      siteId: user.siteId,
    };
  }
}
