// Instancias únicas de los gateways hacia otros módulos. Con la URL del módulo configurada
// (ver config.ts y .env.example) se usa la implementación HTTP; sin ella, el mock. El resto del
// backend no cambia.
import { config } from "../config";
import { AcademicPeriodsGatewayHttp } from "./academic.gateway.http";
import { AcademicPeriodsGatewayMock } from "./academic-periods.gateway.mock";
import { BackofficeSitesGatewayHttp, BackofficeUsersGatewayHttp } from "./backoffice.gateway.http";
import { BackofficeSitesGatewayMock } from "./backoffice-sites.gateway.mock";
import { BackofficeUsersGatewayMock } from "./backoffice-users.gateway.mock";
import { CoreAuthGatewayMock } from "./core-auth.gateway.mock";
import { CoreServiceAuthGatewayHttp } from "./core-service-auth.gateway";
import { CoreServiceAuthGatewayMock } from "./core-service-auth.gateway.mock";

export const coreAuthGateway = new CoreAuthGatewayMock();

export const coreServiceAuthGateway =
  config.coreBaseUrl && config.clientSecret
    ? new CoreServiceAuthGatewayHttp(config.coreBaseUrl, config.clientId, config.clientSecret)
    : new CoreServiceAuthGatewayMock(config.clientId);

export const backofficeSitesGateway = config.backofficeUrl
  ? new BackofficeSitesGatewayHttp(config.backofficeUrl, coreServiceAuthGateway)
  : new BackofficeSitesGatewayMock();

export const backofficeUsersGateway = config.backofficeUrl
  ? new BackofficeUsersGatewayHttp(config.backofficeUrl, coreServiceAuthGateway)
  : new BackofficeUsersGatewayMock();

export const academicPeriodsGateway = config.academicUrl
  ? new AcademicPeriodsGatewayHttp(config.academicUrl, coreServiceAuthGateway)
  : new AcademicPeriodsGatewayMock();
