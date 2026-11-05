# Mocks de integración

Con `CORE_MOCK`, `BACKOFFICE_MOCK` y `ACADEMIC_MOCK` en `true` (por defecto) los gateways leen estos archivos en lugar de llamar a los otros módulos. Especificación completa: `docs/INTEGRACION.md`, sección 5.

- Cada archivo se lee **en cada llamada** (sin caché ni watcher): editar un `.json` se ve en el siguiente request, sin reiniciar.
- El contenido del archivo es **literalmente el body** de la respuesta con `200`. Un archivo por clave: `academic/cursos/8.json` es la respuesta de `cursos?periodoId=8`.
- Si falta el archivo: `404 RESOURCE_NOT_FOUND` para recursos por id (`backoffice/users/<id>`, `academic/planes/<id>`, `academic/curso-detalle/<id>`); lista vacía para `academic/asignaturas/<id>` y `academic/cursos/<id>`; `core/wallets-aggregates/<AAAA-MM>.json` cae a `_empty.json` o a una respuesta vacía; los archivos únicos (`sites`, `periodos`, `sedes`, `carreras`, `users`) dan error de configuración (500).
- Para simular una falla: `{ "__mockStatus": 503, "__mockBody": { "code": "SERVICE_UNAVAILABLE", "detail": "..." } }`. Un JSON mal formado da 500 con la ruta del archivo.
- Las claves de archivo sólo aceptan `[A-Za-z0-9_-]`.

## Usuarios de prueba (`core/users.json`)

Contraseña de todos: `uadenet2026` (es de demo; no son credenciales reales de CORE).

| Mail | Rol de CORE | Sección de Analítica |
|---|---|---|
| `direccion.academica@uade.edu.ar` | `ACADEMIC_ADMIN` | académica (tablero académico y eventos) |
| `direccion.financiera@uade.edu.ar` | `FINANCE_ADMIN` | financiera |
| `direccion.general@uade.edu.ar` | `ADMIN` | ambas |
| `alumno.demo@uade.edu.ar` | `STUDENT` | ninguna: `403 ANALYTICS_FORBIDDEN` |
| `suspendido.demo@uade.edu.ar` | `ACADEMIC_ADMIN` con `status: SUSPENDED` | `403 AUTH_IDENTITY_SUSPENDED` |

El JWT del login mock se firma con un par RSA local en `backend/.mock-keys/` (se crea solo, no se versiona).
