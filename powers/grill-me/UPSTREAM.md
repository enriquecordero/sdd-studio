# Origen

- Repo: https://github.com/mattpocock/skills
- Ruta: skills/productivity/grill-me
- Commit: d81f3a183412e71a5b1e84ca21bc1a35eea03a60
- Autor: Matt Pocock
- Licencia: MIT (ver LICENSE)
- Adaptado para GitHub Copilot por SDD Studio el 2026-10-01

## Archivos incluidos
- skills/productivity/grill-me/SKILL.md → skills/grill-me/SKILL.md

## Archivos excluidos
- skills/productivity/grilling/SKILL.md — skill fuera del catálogo; solo se integra lo esencial en grill-me/SKILL.md

## Cambios de la adaptación
- SKILL.md: el origen solo contiene "Call the Skill tool with "grilling"" (término de Claude Code y dependencia fuera del catálogo); se sustituye por el cuerpo esencial de `grilling` (árbol de decisiones, recomendación por pregunta, hechos por cuenta del agente, criterio de fin), tomado del mismo commit.
- SKILL.md: la `grilling` original pregunta por rondas (toda la frontera a la vez); se cambia a "una pregunta a la vez, rama por rama", según el brief.
- SKILL.md: preguntas con `vscode/askQuestions` (o texto plano); "sub-agent" → `agent/runSubagent`; búsqueda de hechos con `read`, `search` o `execute`.
- SKILL.md: la descripción del front matter se reescribe en una línea, con disparadores en español (según el brief).
- SKILL.md: se conserva `disable-model-invocation: true`.
