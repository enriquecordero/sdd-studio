# Origen

- Repo: https://github.com/mattpocock/skills
- Ruta: skills/engineering/code-review
- Commit: d81f3a183412e71a5b1e84ca21bc1a35eea03a60
- Autor: Matt Pocock
- Licencia: MIT (ver LICENSE)
- Adaptado para GitHub Copilot por SDD Studio el 2026-10-01

## Archivos incluidos
- skills/engineering/code-review/SKILL.md → skills/code-review/SKILL.md

## Archivos excluidos
- agents/openai.yaml — configuración específica de OpenAI

## Cambios de la adaptación
- SKILL.md: la descripción del front matter se reescribe en una línea, con disparadores en español (según el brief); el origen la entrecomilla.
- SKILL.md: "parallel sub-agents" → se añade "(`agent/runSubagent`)" en la introducción y en el título del paso 4.
- SKILL.md: se elimina "The issue tracker should have been provided to you. If `docs/agents/issue-tracker.md` is missing, tell the user to run `/setup-matt-pocock-skills`." (skill fuera del catálogo).
- SKILL.md: "fetched via the workflow in `docs/agents/issue-tracker.md`" → "fetched with whatever issue-tracker access is available (GitHub tools, or `gh` via `execute`)".
- SKILL.md: fuentes de estándares: se añaden `AGENTS.md` y `.github/copilot-instructions.md` a `CODING_STANDARDS.md` y `CONTRIBUTING.md`.
