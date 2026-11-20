# Deploy del frontend a Vercel

El frontend se publica a producción con la CLI de Vercel, **siempre desde `main`** y una vez
que todos los cambios ya están mergeados.

## Requisitos (una sola vez)

- CLI de Vercel instalada: `npm i -g vercel`
- Sesión iniciada: `vercel login`
- La carpeta `frontend/.vercel/` vincula el proyecto (no se sube al repo). Si no la tenés,
  corré `vercel link` dentro de `frontend/` y elegí el proyecto existente.

## Pasos

```bash
git checkout main
git pull            # asegurate de tener todo lo mergeado
git status          # tiene que estar limpio, sin cambios sueltos
cd frontend
vercel --prod
```

- Si `git status` muestra cambios, no deployes: commitealos por PR o descartalos primero, así
  lo que queda en producción es exactamente lo que está en `main`.
- Conviene correr `npm run build` antes para detectar errores de tipos o de build localmente.
- Al terminar, `vercel --prod` imprime la URL de producción para verificar el deploy.
