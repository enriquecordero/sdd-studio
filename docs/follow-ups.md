# Pendientes menores (no bloquean v0.1.0)

Hallazgos menores diferidos durante la implementación y la revisión final. Detalle original en las revisiones por tarea.

- Task 2: minor (deferred): @types/vscode 1.138.0 lags engines ^1.140.0
- Task 3: minor (deferred): fence unwrap also strips bare ``` fences; setFrontMatterFields values not newline-sanitized
- Task 3: minor (deferred): names.ts uses literal combining chars instead of ̀-ͯ escapes; missing tests for empty FM / `---` in body / CRLF in prepareSpecDocContent
- Task 5: minor (deferred): approving nonexistent bugfix in feature spec → TYPE_MISMATCH (not DOC_MISSING), untested; redundant `!`; findRequirementLine heading-level edge
- Task 6: minor (deferred): 12 minors in task-6-review.md
- Task 7: minor (deferred): str() rejects null folder; non-SpecError errors escape tool wrap; writeSpecDoc redraft non-atomic; approvePhase on dirty buffer doesn't mention unsaved; dirty-buffer test lacks try/finally
- Task 8: minor (deferred): 7 test-coverage gaps (task-8-review.md)
- Task 9: minor (deferred): empty description accepted; silent returns on unknown folder/name; no try/catch around openAgent; tree items without ids; test gaps (untrusted/cancel/multi-root/steering)
- Task 10: minor (deferred): bridge-failure messaging in runTask/approveAndContinue (task left [-]); `task!` after status change; "Aprueba las tareas" text misleading when earlier doc back in draft; diagnostics test fixed 300ms sleep; editor/bridge leakage between tests
- Task 11: minor (deferred): manifest test weaknesses (whitespace-sensitive handoff regex, string match for 'edit', no model-pin / prompt agent checks, sort() mutates)
- Task 12: minor (deferred): silent getSession false negative when consent not granted; `void runDoctorOnce` unhandled rejection; no unit test for strict boolean/array parsing; output channel not auto-shown
- Task 13: minor (deferred): colorTheme update targets Global (workspace override masks it); `void offerThemeOnce` no catch; prompt wording slightly differs from spec; no behavior tests for offerThemeOnce; theme test checks 3 colors only
- Task 14: minor (deferred): no tag-vs-package.json version guard in release.yml; release job skips lint/typecheck/integration; example todo-app has test script but no tests
- Final: un bloque de código sin cerrar oculta todas las tareas posteriores en tasks.md
- Final: los nodos de tarea del panel no tienen id ni acción al hacer clic
- Final: no se comprueba si Copilot Chat está activo (spec §9.1), por la activación diferida (Ruling R15)
