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

## Powers (v0.3.0)

- Task 1: isSafeRelativePath allows in-tree dotdirs (.vscode/…); semver leading zeros; invalid-tone test lacks assertion; no tests cycle/funnel limits, isValidId/isSemver; UTF-16 length; parseLock accepts array powers / no sha/installedAt format check; source.repo/commit unchecked; no file count/size cap
- Task 2: JSON parse errors swallowed (unclear msg); symlinks/binary/dotfiles not handled; `--out` w/o value crashes; fragile main guard; Cursor/Claude Code patterns broad; test gaps (malformed JSON, CLI, unsafe paths)
- Task 3: long diagram labels not wrapped (6-step shrinks small); triggers[0]/gets[0] unguarded (validator guarantees ≥1); a11y gaps; filter leaves empty section headings
- Task 4: raw "fetch failed" msg w/o cause; prune removes empty user dirs; update overwrites unlocked colliding files w/o asking; sha256 not recomputed at install; rollback delete error may mask original; Node fetch & corporate proxy unverified (manual checklist covers offline)
- Task 5: tests don't restore default fetcher after setFetcher; weak `changes >= 4`; refreshOnline doesn't catch cache write failure; small race catalog() vs resetCatalog
- Task 6: gallery uses folders()[0] in multi-root; strict banner stale (no config listener); void render/handleMessage unhandled rejections & render races; re-render resets detail/scroll; spec 'refresh' message unhandled (webview never sends it); test gaps (re-render, invalid msgs, multi-root, untrusted, modal overwrite)
- Task 7: teaser .replace with string ($ patterns) — use function replacer; file URLs not encodeURI'd; test lacks escaping/empty-catalog; unclear error if dist/catalog.json missing
- Task 8: speccy.svg ships in VSIX unnecessarily; no test for media/speccy.png; magic width 240 in build-icon; long inline style on landing img
- Task 9: UPSTREAM.md "(según el brief)" parenthetical; openai.yaml exclusion wording
- Task 10: find-polluter.sh not executable (catalog/installer don't carry file modes; doc says ./find-polluter.sh) — note `bash find-polluter.sh` or ignore
- Task 11: trigger wording differs slightly between description and chips
- Task 12: code-review issue-fetch rewording adds a bit of new text (recorded in UPSTREAM)
- Task 13: leftover "eval" phrase SKILL.md:16; feature.md arena→"two independent attempts" rewrite not listed in UPSTREAM.md
- Task 14: README/checklist don't mention /grill-me and /poteto-mode are explicit-invocation Powers
- Final: posible carrera que pierde una entrada del lockfile si se activan dos Powers muy seguidos
- Final: en Windows con CRLF (git autocrlf) puede aparecer un aviso falso de "cambios locales" al actualizar o desactivar
