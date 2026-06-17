# Eve + LM Studio + Web Search Starter

Starter local para usar Eve con LM Studio y busquedas web desde una web app.

## 1. Configura LM Studio

1. Abre LM Studio.
2. Carga un modelo con buen tool calling.
3. Arranca el servidor local OpenAI-compatible.
4. Comprueba que responde:

```bash
curl http://127.0.0.1:1234/v1/models
```

Copia el `id` del modelo en `.env`.

## 2. Configura el proyecto

```bash
cp .env.example .env
```

Edita:

```bash
LM_STUDIO_MODEL=el-id-real-del-modelo
LM_STUDIO_CONTEXT_TOKENS=65536
LM_STUDIO_MAX_OUTPUT_TOKENS=4096
```

Para busqueda web, configura una de estas opciones:

```bash
SEARXNG_URL=http://127.0.0.1:8080
BRAVE_SEARCH_API_KEY=...
TAVILY_API_KEY=...
```

Si no configuras ninguna, se usa DuckDuckGo Instant Answer como fallback. Sirve para humo, pero no sustituye una busqueda web completa.

## 3. Arranca Eve y la web

Terminal 1:

```bash
npm run build
npm run start
```

Terminal 2:

```bash
npm run web
```

Abre:

```text
http://127.0.0.1:5173
```

Si Eve no corre en `http://127.0.0.1:3000`, cambia `VITE_EVE_TARGET` en `.env`.

`npm run dev` abre el modo interactivo de Eve. Para empezar rapido con LM Studio local, el flujo `build` + `start` suele ser mas predecible.

## raym33/r skills

Este starter incluye un puente a `raym33/r`:

- `r_catalog`: lista las skills disponibles.
- `r_search_tools`: busca tools por palabra clave.
- `r_call_tool`: ejecuta una tool concreta.

El repo esta clonado en `../work/raym33-r` y se instalo en editable dentro de `.venv`.
La UI carga `public/r-catalog.json` para mostrar un explorador visual de skills/tools.
Tambien muestra un panel de permisos con las skills listas para usar y las familias sensibles bloqueadas.

Prueba rapida:

```bash
.venv/bin/python scripts/r_bridge.py export-catalog --output public/r-catalog.json
.venv/bin/python scripts/r_bridge.py catalog --limit 5
.venv/bin/python scripts/r_bridge.py call math calculate --params '{"expression":"sqrt(144)"}'
```

Por seguridad, el puente bloquea por defecto skills con efectos sensibles como `ssh`, `docker`, `email`, `power`, `wifi`, `clipboard` y similares. Para abrirlas:

```bash
R_BRIDGE_ALLOW_DANGEROUS=1 npm run start
```

Ese desbloqueo es global para el proceso del backend. Para uso diario, mantenlo desactivado y deja que Eve proponga un plan antes de ejecutar acciones que puedan modificar el sistema.
