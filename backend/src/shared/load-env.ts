// Carga .env (si existe) al importarse; debe ser el primer import de index.ts para que las variables estén listas antes de instanciar repositorios.
try {
  process.loadEnvFile();
} catch {
  // Sin .env se usan las variables del entorno tal cual (DATABASE_URL es obligatoria: sin ella el server no arranca).
}
