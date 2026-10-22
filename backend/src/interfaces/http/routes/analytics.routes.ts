// Routes: Express route definitions that wire URLs to controllers.
// Se montan en /api/v1: el gateway de CORE reescribe /api/v1/analytics/* a /api/v1/*.
import { Router } from "express";
import { ANALYTICS_PERMISSIONS } from "../../../domain/entities/role.entity";
import { AnalyticsController } from "../controllers/analytics.controller";
import { requireAuth, requirePermission } from "../middleware/require-auth.middleware";

const router = Router();
const controller = new AnalyticsController();

// Los tableros exigen el access token de CORE y el permiso de Backoffice que corresponde.
// /roles y /sources quedan abiertas: las usa la pantalla de login antes de iniciar sesión.
router.get("/me", requireAuth, (req, res) => controller.getCurrentUser(req, res));
router.get("/dashboard/academic", requireAuth, requirePermission(ANALYTICS_PERMISSIONS.academic), (req, res) => controller.getAcademicDashboard(req, res));
router.get("/dashboard/financial", requireAuth, requirePermission(ANALYTICS_PERMISSIONS.finance), (req, res) => controller.getFinancialDashboard(req, res));
router.get("/events/stats", requireAuth, requirePermission(ANALYTICS_PERMISSIONS.academic), (req, res) => controller.getEventsStats(req, res));
router.get("/filters", requireAuth, (req, res) => controller.getFilters(req, res));
router.get("/roles", (req, res) => controller.getRoles(req, res));
router.get("/sources", (req, res) => controller.getEventSources(req, res));

// Transporte de desarrollo: simula la cola analytics.all-events.v1 mientras no haya RabbitMQ.
// No existe en producción.
export const devEventsRoutes = Router();
devEventsRoutes.post("/events", (req, res) => controller.consumeEvent(req, res));
devEventsRoutes.get("/events", (req, res) => controller.listEvents(req, res));

export { router as analyticsRoutes };
