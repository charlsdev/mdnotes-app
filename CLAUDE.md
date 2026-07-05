@AGENTS.md

# MDNotes — Notas para agentes

App móvil (Expo/React Native) para leer, escribir y previsualizar Markdown, con
**vault** (abrir una carpeta del teléfono y editar los `.md` en sitio, tipo
Obsidian/Typora). El detalle técnico y los gotchas están en `AGENTS.md` — léelo
antes de tocar código no trivial.

## Idioma y tono
- Texto user-facing (UI, errores, copy, alertas): **español neutro**.
- Variables, comentarios técnicos, commits, PRs: **inglés** (salvo comentarios de
  lógica de negocio que valen más en español).
- Comentarios escuetos: solo el WHY no obvio, nunca lo que el nombre ya dice.

## Antes de cambiar algo no trivial
1. Lee `AGENTS.md` (arquitectura + gotchas de esta app).
2. `README.md` tiene el mapa del proyecto.
3. Build/ejecución en `COMPILACION.md`; marca aplicada en `MARCA.md`.
4. Verifica siempre con `pnpm typecheck` y `npx expo export --platform android`
   (bundle) antes de dar algo por hecho.
