// Routes: Express route definitions that wire URLs to controllers.
// Estas rutas representan a CORE (módulo 10) mientras no exista el real.
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/require-auth.middleware";

const router = Router();
const controller = new AuthController();

router.post("/login", (req, res) => controller.login(req, res));
router.get("/me", requireAuth, (req, res) => controller.me(req, res));

export { router as authRoutes };
