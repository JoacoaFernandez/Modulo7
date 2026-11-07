// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
// Guarda el access token de CORE sólo en memoria (nunca en localStorage) para que los clientes HTTP lo
// manden como Bearer sin depender de React, y avisa a la sesión cuando el token se renueva o cuando ya
// no se puede renovar.
import type { AuthSession } from "../../domain/entities/auth.entity";

let token: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let refreshedHandler: ((session: AuthSession) => void) | null = null;

export const authTokenStore = {
  get: () => token,

  set: (value: string | null) => {
    token = value;
  },

  // La sesión se registra acá para cerrarse cuando el refresh falla.
  onUnauthorized: (handler: (() => void) | null) => {
    unauthorizedHandler = handler;
  },

  notifyUnauthorized: () => unauthorizedHandler?.(),

  // La sesión se registra acá para actualizar su estado cuando un refresh silencioso renueva el token.
  onRefreshed: (handler: ((session: AuthSession) => void) | null) => {
    refreshedHandler = handler;
  },

  notifyRefreshed: (session: AuthSession) => refreshedHandler?.(session),
};
