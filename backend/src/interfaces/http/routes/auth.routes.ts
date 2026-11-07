// Routes: Express route definitions that wire URLs to controllers.
// Proxy de la autenticación de CORE (módulo 10): CORE real o su mock según CORE_MOCK.
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/require-auth.middleware";

const router = Router();
const controller = new AuthController();

router.post("/login", (req, res) => controller.login(req, res));
router.post("/refresh", (req, res) => controller.refresh(req, res));
router.post("/logout", (req, res) => controller.logout(req, res));
router.get("/me", requireAuth, (req, res) => controller.me(req, res));

export { router as authRoutes };
