import express from "express";
import { analyticsRoutes } from "./src/interfaces/http/routes/analytics.routes";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  next();
});

app.get("/", (_req, res) => {
  res.send("ok");
});

app.use("/api/analytics", analyticsRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
