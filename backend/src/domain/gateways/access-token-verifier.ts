// Verifica el access token (JWT RS256 de CORE) sin llamar a CORE: contra el JWKS en modo real, contra la
// clave pública local en modo mock.
export interface AccessTokenClaims {
  // `sub`: id del usuario en CORE.
  userId: string;
  sessionId: string | null;
  email: string;
  // Roles de CORE (ACADEMIC_ADMIN, FINANCE_ADMIN, ADMIN...).
  roles: string[];
  permissions: string[];
  careerIds: string[];
  // Segundos desde epoch.
  expiresAt: number;
}

export interface AccessTokenVerifier {
  // null si la firma, el emisor, la audiencia o el vencimiento no son válidos.
  verify(token: string): Promise<AccessTokenClaims | null>;
}
