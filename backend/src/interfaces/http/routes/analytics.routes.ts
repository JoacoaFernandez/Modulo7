// Routes: Express route definitions that wire URLs to controllers.
import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";

const router = Router();
const controller = new AnalyticsController();

router.get("/dashboard/academic", (req, res) => controller.getAcademicDashboard(req, res));
router.get("/dashboard/financial", (req, res) => controller.getFinancialDashboard(req, res));
router.get("/events/stats", (req, res) => controller.getEventsStats(req, res));
router.post("/events", (req, res) => controller.recordEvent(req, res));

export { router as analyticsRoutes };
