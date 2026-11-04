// Carga .env (si existe) al importarse; debe ser el primer import de index.ts para que las variables estén listas antes de instanciar repositorios.
try {
  process.loadEnvFile();
} catch {
  // Sin .env se usan las variables del entorno tal cual (o el mock en memoria).
}
