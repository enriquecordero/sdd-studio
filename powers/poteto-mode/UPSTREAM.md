# Origen

- Repo: https://github.com/cursor/plugins
- Ruta: pstack/skills/poteto-mode
- Commit: 2eb7ed4613cfc8f098dfe464a23680ea44d84c5e
- Autor: Lauren Tan
- Licencia: MIT (ver LICENSE)
- Adaptado para GitHub Copilot por SDD Studio el 2026-10-01

## Archivos incluidos
- pstack/skills/poteto-mode/SKILL.md → skills/poteto-mode/SKILL.md
- pstack/skills/poteto-mode/playbooks/feature.md → skills/poteto-mode/references/playbooks/feature.md
- pstack/skills/poteto-mode/playbooks/bug-fix.md → skills/poteto-mode/references/playbooks/bug-fix.md
- pstack/skills/poteto-mode/playbooks/refactoring.md → skills/poteto-mode/references/playbooks/refactoring.md
- pstack/skills/poteto-mode/playbooks/prototype.md → skills/poteto-mode/references/playbooks/prototype.md
- pstack/skills/poteto-mode/playbooks/investigation.md → skills/poteto-mode/references/playbooks/investigation.md
- pstack/skills/principle-*/SKILL.md (23 skills) → skills/poteto-mode/references/principles.md (condensado, 2-4 líneas por principio)

Condensado: 23 skills de principios resumidos en references/principles.md

## Archivos excluidos
- playbooks/autopilot-full.md — flujo autónomo de PRs en cola, fuera del alcance
- playbooks/autopilot-stack.md — flujo autónomo de stacks de PRs, fuera del alcance
- playbooks/autonomous-run.md — flujo autónomo de larga duración, fuera del alcance
- playbooks/babysit.md — específico de PRs/CI y de herramientas de Cursor
- playbooks/authoring-a-skill.md — específico de Cursor (autoría de skills con su herramienta integrada)
- playbooks/eval.md — específico de Cursor (evals de skills y prompts)
- playbooks/hillclimb.md — flujo autónomo de optimización sostenida, fuera del alcance
- playbooks/orchestrate.md — flujo de coordinación de flotas de subagentes, específico de Cursor
- playbooks/worktree-cleanup.md — específico de Cursor (worktrees y simuladores iOS)
- playbooks/session-pickup.md — específico de Cursor (transcripciones y agentes en la nube)
- playbooks/pause-safely.md — específico de Cursor (reinicio y compactación de contexto)
- playbooks/opening-a-pr.md — específico de los flujos y herramientas de Cursor
- playbooks/shipping.md — flujo autónomo de aterrizaje de stacks, específico de Cursor
- playbooks/multi-phase-plan.md — flujo multifase fuera del alcance
- playbooks/perf-issue.md — específico de Cursor (trazas y herramientas de perfilado)
- playbooks/runtime-forensics.md — específico de Cursor (instrumentación en vivo)
- playbooks/trace-forensics.md — específico de Cursor (artefactos de perfilado)
- playbooks/visual-parity.md — específico de Cursor (equivalencia píxel a píxel con sus skills de control)
- skills hermanas no condensadas (how, why, architect, swarm, arena, interrogate, reflect, figure-it-out, unslop, technical-writing, create-skill, no-comments, show-me-your-work, setup-pstack, poteto-agent y similares) — dependen de herramientas, modelos o flujos de Cursor; lo esencial se integra en SKILL.md o se sustituye por skills del catálogo
- references/bugbot-triage.md — específico de Bugbot (herramienta de Cursor)

## Cambios de la adaptación
- SKILL.md: se elimina del front matter `name: Poteto Mode` en favor de `name: poteto-mode`, y se eliminan `mode: true`, `icon`, `color` y `reminder`.
- SKILL.md: la descripción se reescribe en una línea, con disparadores en español (según el brief); se conserva `disable-model-invocation: true`.
- SKILL.md: las referencias a los skills de principios (`principle-*`) pasan a secciones de `references/principles.md`; las rutas `playbooks/*.md` pasan a `references/playbooks/*.md`.
- SKILL.md: se sustituyen los skills hermanos `how`, `why` y `architect` por lectura directa, `research` y `codebase-design`; `interrogate` por `grill-me`; y se añaden referencias a `prototype`, `domain-modeling`, `systematic-debugging`, `verification` y `code-review`.
- SKILL.md: se eliminan las menciones a `swarm`, `arena`, `unslop`, `create-skill`, `technical-writing`, `deslop`, `no-comments`, `control-cli`, `control-ui`, `show-me-your-work` y `figure-it-out`; la regla de prosa limpia queda en "Writing the reply" y "Comments", y "decision trail" pasa a un registro breve.
- SKILL.md: `AskQuestion` → `vscode/askQuestions`; `Task` y subagentes → `agent/runSubagent`; `todolist` → una checklist en la respuesta o la herramienta `todos`.
- SKILL.md: se reescribe la sección Subagents sin `subagent_type: "poteto-agent"`, `run_in_background`, modelos concretos por rol ni `/setup-pstack`; se conservan "you own every subagent's work" y el valor del segundo parecer, sin referencia a otro modelo.
- SKILL.md: la lista de playbooks se reduce a los 5 incluidos (Feature, Bug fix, Refactoring, Prototype, Investigation); se eliminan los 18 playbooks excluidos y los disparadores de Babysit, Shipping y Bugbot.
- SKILL.md: la sección Principles pasa de una lista detallada a un índice por grupos, ya que el detalle vive en `references/principles.md`.
- SKILL.md: "Use any MCP tool" → "Use any tool available"; se eliminan "Cursor restart" y la mención de `/loop` y de `/setup-pstack`.
- references/principles.md: nuevo archivo; resume en 2-4 líneas cada una de las 23 skills de principios con el título original, tomadas del mismo commit.
- playbooks (los 5): se eliminan los pasos "Run Opening a PR" (→ abrir el PR o devolver la rama), y las referencias a `how`, `why`, `architect`, `arena`, `interrogate`, `unslop` y a las skills de control, sustituidas por lectura directa, `codebase-design`, `grill-me`, "Writing the reply" o una ejecución directa en la superficie.
- playbooks: se eliminan los modelos por defecto (`grok-4.7-xhigh-fast`) y la configuración por rol; la delegación pasa a `agent/runSubagent`; los skills `principle-*` pasan a nombres de sección de `references/principles.md`; "todo items" → "checklist items".
- bug-fix.md: se elimina el comando `/loop` de Cursor; se citan `systematic-debugging` y `tdd`. refactoring.md: `figure-it-out` → "un plan escrito a medida"; se cita `verification`. prototype.md: se cita `prototype`. investigation.md: se cita `research`.
- presentation.json: se usan los valores del brief (categoría `modes`), pero los disparadores son `/poteto-mode` y "/poteto-mode implementa…" porque el skill conserva `disable-model-invocation: true` y solo se invoca explícitamente.
- SKILL.md: la descripción empieza con "Invoke explicitly with /poteto-mode." y la parte en español pasa a `escribe "/poteto-mode"` (se quitan las frases de activación en lenguaje natural).
