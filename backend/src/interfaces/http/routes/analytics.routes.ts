// Routes: Express route definitions that wire URLs to controllers.
import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { config } from "../../../shared/config";
import { requireAuth, requireRole } from "../middleware/require-auth.middleware";

const router = Router();

// Los tableros exigen sesión de CORE. Las rutas de ingesta (/events) y las que usa la
// pantalla de login (/sources, /roles) quedan abiertas: las llaman otros módulos o un usuario
// que todavía no inició sesión.
const controller = new AnalyticsController();

router.get("/dashboard/academic", requireAuth, requireRole("academica"), (req, res) => controller.getAcademicDashboard(req, res));
router.get("/dashboard/financial", requireAuth, requireRole("financiera"), (req, res) => controller.getFinancialDashboard(req, res));
router.get("/events/stats", requireAuth, requireRole("academica"), (req, res) => controller.getEventsStats(req, res));
router.get("/filters", requireAuth, (req, res) => controller.getFilters(req, res));
router.get("/roles", (req, res) => controller.getRoles(req, res));
router.get("/sources", (req, res) => controller.getEventSources(req, res));

// Ingesta por HTTP (mock de la cola de CORE, para Postman): sólo con EVENTS_HTTP_INGEST=true; apagado, ambas rutas dan 404.
if (config.events.httpIngest) {
  router.get("/events", (req, res) => controller.listEvents(req, res));
  router.post("/events", (req, res) => controller.recordEvent(req, res));
}

export { router as analyticsRoutes };
