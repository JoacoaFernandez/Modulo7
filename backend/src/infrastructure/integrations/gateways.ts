// Instancias únicas de los gateways hacia otros módulos, elegidas por flag (docs/INTEGRACION.md, sección 2).
// *_MOCK=true: implementación que lee backend/mocks/ en cada llamada (sin caché). *_MOCK=false: HTTP real,
// envuelta en caché TTL. El resto del backend sólo conoce las interfaces de domain/gateways.
import { AccessTokenVerifier } from "../../domain/gateways/access-token-verifier";
import { AcademicGateway } from "../../domain/gateways/academic.gateway";
import { BackofficeGateway } from "../../domain/gateways/backoffice.gateway";
import { CoreAuthGateway } from "../../domain/gateways/core-auth.gateway";
import { CoreEventsGateway } from "../../domain/gateways/core-events.gateway";
import { CoreWalletGateway } from "../../domain/gateways/core-wallet.gateway";
import { config } from "../../shared/config";
import { AcademicGatewayHttp } from "./academic/academic.gateway.http";
import { AcademicGatewayMock } from "./academic/academic.gateway.mock";
import { BackofficeGatewayHttp } from "./backoffice/backoffice.gateway.http";
import { BackofficeGatewayMock } from "./backoffice/backoffice.gateway.mock";
import { CachedAcademicGateway, CachedBackofficeGateway, CachedWalletGateway } from "./cache/cached-gateways";
import { CoreAuthGatewayHttp } from "./core/core-auth.gateway.http";
import { CoreAuthGatewayMock } from "./core/core-auth.gateway.mock";
import { CoreEventsGatewayHttp } from "./core/core-events.gateway.http";
import { CoreWalletGatewayHttp } from "./core/core-wallet.gateway.http";
import { CoreWalletGatewayMock } from "./core/core-wallet.gateway.mock";
import { JwksTokenVerifier } from "./core/jwks-token-verifier";
import { MockTokenVerifier } from "./core/mock-token-verifier";
import { HttpClient } from "./http/http-client";
import { CoreServiceTokenProvider, MockServiceTokenProvider, ServiceTokenProvider } from "./http/service-token.provider";
import { MockFileStore } from "./mock/mock-file-store";

const store = new MockFileStore(config.mocks.dir);
const common = { timeoutMs: config.gateway.timeoutMs, maxConcurrency: config.gateway.maxConcurrency, serviceName: config.serviceName };

// CORE sin token de servicio (login de usuario y token de servicio) y con él (wallets, eventos).
const coreBaseUrl = config.core.baseUrl ?? "";
const coreAnonymous = new HttpClient({ ...common, service: "core", baseUrl: coreBaseUrl });

export const serviceTokens: ServiceTokenProvider = config.mocks.core
  ? new MockServiceTokenProvider()
  : new CoreServiceTokenProvider(coreAnonymous, { clientId: config.core.clientId, clientSecret: config.core.clientSecret ?? "" });

const coreAuthenticated = new HttpClient({ ...common, service: "core", baseUrl: coreBaseUrl, tokens: () => serviceTokens });

export const coreAuthGateway: CoreAuthGateway = config.mocks.core
  ? new CoreAuthGatewayMock(store, config.core.jwtAudience)
  : new CoreAuthGatewayHttp(coreAnonymous);

export const accessTokenVerifier: AccessTokenVerifier = config.mocks.core
  ? new MockTokenVerifier(config.core.jwtAudience)
  : new JwksTokenVerifier(config.core.jwksUrl ?? "", config.core.jwtIssuer ?? "", config.core.jwtAudience);

export const coreWalletGateway: CoreWalletGateway = config.mocks.core
  ? new CoreWalletGatewayMock(store)
  : new CachedWalletGateway(new CoreWalletGatewayHttp(coreAuthenticated), config.cacheTtlSeconds);

// Sólo existe con CORE real (el script de backfill lo exige).
export const coreEventsGateway: CoreEventsGateway | null = config.mocks.core ? null : new CoreEventsGatewayHttp(coreAuthenticated);

export const backofficeGateway: BackofficeGateway = config.mocks.backoffice
  ? new BackofficeGatewayMock(store)
  : new CachedBackofficeGateway(
      new BackofficeGatewayHttp(new HttpClient({ ...common, service: "backoffice", baseUrl: config.backoffice.baseUrl ?? "", tokens: () => serviceTokens })),
      config.cacheTtlSeconds,
    );

export const academicGateway: AcademicGateway = config.mocks.academic
  ? new AcademicGatewayMock(store)
  : new CachedAcademicGateway(
      new AcademicGatewayHttp(new HttpClient({ ...common, service: "academic", baseUrl: config.academic.baseUrl ?? "", tokens: () => serviceTokens })),
      config.cacheTtlSeconds,
    );

// Modo de cada servicio, para /health/ready.
export const gatewayModes = {
  core: config.mocks.core ? "mock" : "http",
  backoffice: config.mocks.backoffice ? "mock" : "http",
  academic: config.mocks.academic ? "mock" : "http",
} as const;
