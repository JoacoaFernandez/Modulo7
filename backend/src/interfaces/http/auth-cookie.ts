// Cookie de refresh: CORE la fija con Path=/api/v1/auth; nuestro proxy la reescribe a Path=/api/auth (mismo sitio
// que el SPA) conservando HttpOnly, Secure y Max-Age/Expires, y con SameSite según AUTH_COOKIE_SAMESITE.
import { config } from "../../shared/config";

const AUTH_COOKIE_PATH = "/api/auth";

export function rewriteRefreshCookie(setCookie: string): string {
  const [pair, ...attributes] = setCookie.split(";").map((part) => part.trim());
  const kept = attributes.filter((attribute) => /^(max-age|expires)=/i.test(attribute));
  const coreSecure = attributes.some((attribute) => attribute.toLowerCase() === "secure");
  const sameSite = config.authCookieSameSite;
  const secure = coreSecure || config.production || sameSite === "none";

  return [pair, ...kept, `Path=${AUTH_COOKIE_PATH}`, "HttpOnly", `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`, ...(secure ? ["Secure"] : [])].join("; ");
}

// Set-Cookie que borra las cookies indicadas (por nombre) en nuestro path.
export function clearCookies(names: string[]): string[] {
  return names.map((name) => rewriteRefreshCookie(`${name}=; Max-Age=0`));
}

export function cookieNames(cookieHeader: string | undefined): string[] {
  return (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter(Boolean);
}
