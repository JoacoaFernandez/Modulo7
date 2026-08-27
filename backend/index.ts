import express, { NextFunction, Request, Response } from "express";
import { analyticsRoutes } from "./src/interfaces/http/routes/analytics.routes";
import { ValidationError } from "./src/shared/validation-error";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.header("Access-Control-Max-Age", "600");

  // Preflight: se responde acá, sin llegar a las rutas.
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get("/", (_req, res) => {
  res.send("ok");
});

app.use("/api/analytics", analyticsRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Recurso no encontrado" });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
