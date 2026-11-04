# Plan de implementación — Base de datos y cola (Etapa 3)

## Objetivo

Reemplazar el dataset mock por una base de datos Postgres real, de forma que el flujo
completo quede así:

```
Postman (simula cola CORE)          Cola real (RabbitMQ, futuro)
    ↓ POST /api/analytics/events         ↓ consumer amqplib
         Backend — valida y guarda en Postgres
                       ↑ queries de agregación
         Backend — sirve dashboards calculados
                       ↑ GET /api/analytics/dashboard/*
         Frontend — renderiza los gráficos
```

Cuando CORE tenga la cola disponible, **solo cambia el primer paso** (POST → consumer).
Todo lo demás — schema, queries, use cases — queda intacto.

---

## Estado actual del repo

- **Rama:** `main` (partir de acá con rama nueva, ej. `feature/db-postgres`)
- **Backend:** `backend/` — Node / Express 5 / TypeScript, corre con `tsx watch index.ts`
- **Frontend:** `frontend/` — React 19 / Vite / TypeScript
- **Mock actual:** `backend/src/infrastructure/data/analytics.dataset.ts` — dataset fijo con
  todos los datos de los tres tableros. Los use cases leen de acá a través del repositorio.
- **Repositorio actual:** `backend/src/infrastructure/repositories/` — implementación
  en memoria, sin persistencia.
- **Interfaz del repositorio:** `backend/src/domain/repositories/analytics.repository.ts` —
  no tocar, es el contrato que la nueva implementación tiene que cumplir.
- **Ingesta:** `POST /api/analytics/events` ya valida el schema contra
  `backend/src/domain/entities/event-schemas.ts` y guarda en memoria. La validación no cambia.
- **Dashboards:** los tres use cases (`get-academic-dashboard`, `get-financial-dashboard`,
  `get-events-stats`) ya existen y llaman al repositorio. No cambian.

---

## Stack a agregar

- **Postgres** vía Docker local (ver sección Docker más abajo)
- **Prisma** ORM — `prisma` + `@prisma/client` (instalar en `backend/`)
- **Variable de entorno:** `DATABASE_URL` en `backend/.env` (no commitear)

---

## Docker — Postgres local

Crear `backend/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: analitica
      POSTGRES_PASSWORD: analitica
      POSTGRES_DB: analitica
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Levantar con:
```bash
cd backend && docker compose up -d
```

`DATABASE_URL` para el `.env`:
```
DATABASE_URL="postgresql://analitica:analitica@localhost:5432/analitica"
```

---

## Schema Prisma

Crear `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model InboxEvent {
  id           String   @id @default(cuid())
  eventId      String   @unique        // deduplicación — mismo eventId se rechaza
  sourceModule String
  eventType    String
  occurredAt   DateTime
  payload      Json
  receivedAt   DateTime @default(now())

  @@index([eventType])
  @@index([occurredAt])
  @@index([sourceModule, eventType])
}
```

Una sola tabla. Las queries agregan sobre `payload` (JSONB en Postgres) directamente.
Sin proyecciones separadas por ahora — se pueden agregar si las queries se vuelven lentas.

Correr la migración inicial:
```bash
cd backend && npx prisma migrate dev --name init
```

---

## Seed inicial

Para que los gráficos no queden vacíos mientras no hay eventos reales, al arrancar el
servidor se puede insertar un seed equivalente al mock actual.

Crear `backend/prisma/seed.ts` que lea `analytics.dataset.ts` y genere eventos sintéticos
que, al ser agregados, reproduzcan los mismos números del mock. Alternativamente, hacer
un seed más simple que solo inserte unos pocos eventos representativos de cada tipo.

Correr el seed:
```bash
cd backend && npx prisma db seed
```

---

## Implementación por pasos

### Paso 1 — Guardar eventos en Postgres

Crear `backend/src/infrastructure/repositories/inbox-event.repository.prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { InstitutionalEvent } from "../../domain/entities/institutional-event.entity";

export class PrismaInboxEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(event: InstitutionalEvent): Promise<void> {
    await this.prisma.inboxEvent.upsert({
      where: { eventId: event.eventId },
      update: {},   // si ya existe, no hace nada (idempotencia)
      create: {
        eventId: event.eventId,
        sourceModule: event.sourceModule,
        eventType: event.eventType,
        occurredAt: new Date(event.occurredAt),
        payload: event.payload as object,
      },
    });
  }
}
```

Inyectar en `index.ts` en lugar del repositorio en memoria actual.

### Paso 2 — Queries del tablero académico

Las métricas que hay que calcular (ver `backend/src/domain/entities/academic-stats.entity.ts`
para el shape exacto que espera el frontend):

**Materias en curso** (`subjectsCount`):
```sql
SELECT COUNT(DISTINCT payload->>'cursoId')
FROM inbox_events
WHERE event_type = 'curso.abierto'
  AND payload->>'cuatrimestre' = $cuatrimestre
  AND NOT EXISTS (
    SELECT 1 FROM inbox_events e2
    WHERE e2.event_type = 'curso.cerrado'
      AND e2.payload->>'cursoId' = inbox_events.payload->>'cursoId'
  )
```

**Tasa de aprobación por materia** (últimos 3 cuatrimestres):
```sql
SELECT
  payload->>'materia' AS materia,
  payload->>'cuatrimestre' AS cuatrimestre,
  COUNT(*) FILTER (WHERE (payload->>'aprobado')::boolean) * 100.0 / COUNT(*) AS tasa
FROM inbox_events
WHERE event_type = 'resultado.publicado'
  AND payload->>'cuatrimestre' IN ($c1, $c2, $c3)
GROUP BY materia, cuatrimestre
```

**Tasa de aprobación por docente**:
```sql
SELECT
  payload->>'docenteId' AS docente_id,
  COUNT(*) FILTER (WHERE (payload->>'aprobado')::boolean) * 100.0 / COUNT(*) AS tasa
FROM inbox_events
WHERE event_type = 'resultado.publicado'
  AND payload->>'cuatrimestre' = $cuatrimestre
GROUP BY docente_id
```

### Paso 3 — Queries del tablero financiero

**Balance mensual** (ingresos/egresos del módulo CORE `saldo.movimiento`):
```sql
SELECT
  DATE_TRUNC('month', occurred_at) AS mes,
  SUM(CASE WHEN payload->>'tipo' = 'carga' THEN (payload->>'monto')::numeric ELSE 0 END) AS ingresos,
  SUM(CASE WHEN payload->>'tipo' != 'carga' THEN (payload->>'monto')::numeric ELSE 0 END) AS egresos
FROM inbox_events
WHERE source_module = 'core' AND event_type = 'saldo.movimiento'
GROUP BY mes ORDER BY mes
```

**Gastos administrativos** (backoffice `sueldos.liquidados` + `gasto.registrado`):
```sql
SELECT event_type, payload->>'categoria' AS categoria,
       SUM((payload->>'monto')::numeric) AS total
FROM inbox_events
WHERE source_module = 'backoffice'
  AND event_type IN ('sueldos.liquidados', 'gasto.registrado')
GROUP BY event_type, categoria
```

**Productos más vendidos** (tienda `compra.realizada`, array `items`):
```sql
SELECT
  item->>'producto' AS producto,
  SUM((item->>'unidades')::int) AS unidades,
  SUM((item->>'monto')::numeric) AS monto
FROM inbox_events,
     jsonb_array_elements(payload->'items') AS item
WHERE source_module = 'tienda' AND event_type = 'compra.realizada'
GROUP BY producto
ORDER BY unidades DESC
```

**Facturación comedores por sede**:
```sql
SELECT payload->>'sedeId' AS sede_id,
       SUM((payload->>'monto')::numeric) AS facturacion,
       COUNT(*) AS reservas
FROM inbox_events
WHERE source_module = 'comedor' AND event_type = 'reserva.confirmada'
GROUP BY sede_id
```

### Paso 4 — Queries de estadísticas de eventos

**Frecuencia mensual**:
```sql
SELECT
  DATE_TRUNC('month', occurred_at) AS mes,
  COUNT(*) AS eventos_count
FROM inbox_events
WHERE source_module = 'eventos' AND event_type = 'evento.realizado'
GROUP BY mes ORDER BY mes
```

**Concurrencia y presentismo**:
```sql
SELECT
  COUNT(*) FILTER (WHERE event_type = 'inscripcion.confirmada') AS inscriptos,
  COUNT(*) FILTER (WHERE event_type = 'asistencia.registrada'
                     AND (payload->>'presente')::boolean) AS presentes
FROM inbox_events
WHERE source_module = 'eventos'
```

---

## Fallback al mock

Para el período actual (donde hay pocos o ningún evento real), las queries van a devolver
poco. Estrategia recomendada:

1. **Seed con datos del mock** al arrancar si la tabla está vacía (ver sección Seed)
2. **Si la query devuelve 0 resultados** para el período pedido, caer en el mock. Esto
   permite ir viendo datos reales acumularse sin romper los gráficos históricos.

Implementar en el repositorio Prisma:

```typescript
const result = await this.queryApprovalRates(filters);
if (result.length === 0) {
  return this.mockRepository.getAcademicStats(filters); // fallback
}
return result;
```

---

## Inyección de dependencias en index.ts

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = process.env.DATABASE_URL
  ? new PrismaClient()
  : null;

const analyticsRepository = prisma
  ? new AnalyticsRepositoryPrisma(prisma)
  : new AnalyticsRepositoryMock();   // fallback si no hay DB

// el resto del setup no cambia
```

---

## Cuando llegue la cola real

Solo hay que agregar en `index.ts`:

```typescript
import amqplib from "amqplib";

const conn = await amqplib.connect(process.env.RABBITMQ_URL);
const channel = await conn.createChannel();
await channel.assertQueue("analytics.all-events.v1", { durable: true });

channel.consume("analytics.all-events.v1", async (msg) => {
  if (!msg) return;
  const event = JSON.parse(msg.content.toString());
  await recordEventUseCase.execute(event);   // mismo use case que usa el POST hoy
  channel.ack(msg);
});
```

El `POST /api/analytics/events` puede quedar para dev/Postman.

---

## Checklist de la sesión

- [ ] `docker-compose.yml` en `backend/`
- [ ] `DATABASE_URL` en `backend/.env` (no commitear)
- [ ] `npx prisma init` en `backend/`
- [ ] Schema `InboxEvent` en `prisma/schema.prisma`
- [ ] `npx prisma migrate dev --name init`
- [ ] `PrismaInboxEventRepository` — save con upsert (idempotencia)
- [ ] Inyección en `index.ts` con fallback al mock si no hay `DATABASE_URL`
- [ ] `AnalyticsRepositoryPrisma` con las queries de los 3 tableros
- [ ] Seed inicial para que los gráficos no queden vacíos
- [ ] Verificar: Postman manda evento → DB lo guarda → dashboard lo refleja
- [ ] `backend/.gitignore` incluye `.env` y `docker-compose.override.yml`
