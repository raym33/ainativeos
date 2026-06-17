# R Desktop MVP

Objetivo: convertir `raym33/r` en una app local para personas con ordenadores personales medios/altos, usando modelos locales y permisos claros.

## Posicionamiento

R no debe sentirse como otro chat. Debe sentirse como una mesa de trabajo local:

- entiende archivos y documentos del usuario;
- busca y lee web con fuentes;
- usa herramientas locales bajo demanda;
- pide permiso antes de tocar acciones sensibles;
- funciona con LM Studio, Ollama o cualquier endpoint OpenAI-compatible.

## Primeros workflows

1. Documentos: resumir PDFs, extraer texto, unir/dividir PDFs, generar informes.
2. Investigación web: buscar, leer fuentes, comparar y crear síntesis con enlaces.
3. Archivos locales: ordenar carpetas, detectar duplicados, renombrar y convertir.
4. Datos: CSV, JSON, YAML, SQL ligero y estadísticas.
5. Código: revisar repos, explicar errores, usar git y generar parches.

## Arquitectura recomendada

- UI local: experiencia principal para usuarios no técnicos.
- Agent runtime: Eve o una capa equivalente con sesiones, streaming y tools.
- Skill router: no cargar 560 tools al modelo; buscar herramientas relevantes y ejecutar una concreta.
- Permission layer: bloquear por defecto herramientas sensibles y pedir aprobación visual.
- Model adapters: LM Studio, Ollama, OpenAI-compatible, APIs externas opcionales.

## Seguridad por defecto

Bloquear inicialmente:

- shell destructiva;
- red arbitraria;
- email/envíos;
- docker/ssh;
- power/wifi/bluetooth;
- clipboard;
- escritura fuera de carpetas permitidas.

Permisos ideales:

- permitir una vez;
- permitir para esta sesión;
- permitir siempre para este agente;
- denegar.

## Siguiente sprint

1. Panel de workflows con prompts guiados. Hecho en este starter.
2. Explorador visual de skills y tools. Hecho en este starter con `public/r-catalog.json`.
3. Perfil visible de permisos y skills bloqueadas. Hecho en este starter.
4. Historial de ejecuciones y resultados.
5. Firecrawl como búsqueda/extracción web principal.
6. Browser-use como herramienta avanzada para navegación interactiva.
