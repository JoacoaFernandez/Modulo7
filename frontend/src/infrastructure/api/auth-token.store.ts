// API clients: HTTP setup and calls to the backend, isolated from the rest of the app.
// Guarda el access token de CORE (solo en memoria, nunca en localStorage) para que los clientes
// HTTP lo manden como Bearer sin depender de React, y avisa a la sesión cuando el backend lo
// rechaza (vencido o inválido).
let token: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const authTokenStore = {
  get: () => token,

  set: (value: string | null) => {
    token = value;
  },

  // La sesión se registra acá para cerrar sesión cuando una respuesta vuelve con 401.
  onUnauthorized: (handler: (() => void) | null) => {
    unauthorizedHandler = handler;
  },

  notifyUnauthorized: () => unauthorizedHandler?.(),
};
