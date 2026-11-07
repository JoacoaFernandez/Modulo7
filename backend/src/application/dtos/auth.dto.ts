// DTOs: shapes used to move data in and out of use cases, decoupled from domain entities.

// Cuerpo de POST /api/auth/login.
export interface LoginDto {
  email: string;
  password: string;
}
