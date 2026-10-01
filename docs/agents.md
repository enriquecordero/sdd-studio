# Reglas de los agentes y su fuente

Los seis agentes `sdd-*` condensan prácticas de dos colecciones de skills (MIT):

- **SP** = [obra/superpowers](https://github.com/obra/superpowers) (Jesse Vincent), `skills/<nombre>/SKILL.md`.
- **MP** = [mattpocock/skills](https://github.com/mattpocock/skills) (Matt Pocock), `skills/<área>/<nombre>/SKILL.md`.

Las reglas están reescritas en español y resumidas; cuando un procedimiento es largo, el agente lleva la regla esencial y remite al Power correspondiente (`tdd`, `verification`, `systematic-debugging`, `grill-me`, `domain-modeling`, `codebase-design`, `code-review`, `research`, `prototype`) si está activo en el repo.

## sdd-spec

| Regla | Por qué | Fuente |
|---|---|---|
| Escribir de vuelta la comprensión (resultado, restricciones, criterio de éxito; lo dicho vs. lo supuesto) y pedir confirmación antes de delegar | El usuario corrige antes de gastar tres fases | SP · brainstorming |
| Detectar alcance excesivo y proponer partir en varios specs | Evita specs que mezclan subsistemas independientes | SP · brainstorming |
| Los hechos los busca el agente en el repo; al usuario solo se le preguntan decisiones | Preguntas cortas y que solo el usuario puede contestar | MP · grilling |
| Cada pregunta con su respuesta recomendada | Contestar es elegir, no redactar | MP · grilling |
| Delegar con punteros (rutas de spec, steering, glosario), no copias | El subagente lee lo que necesita; el prompt no se infla | MP · implement-spec |
| Pedir al subagente un estado de retorno (HECHO / HECHO CON DUDAS / BLOQUEADO / FALTA CONTEXTO) y sus dudas | Se sabe si se puede avanzar o hay que resolver algo | SP · subagent-driven-development |
| Quick Spec: autorrevisión obligatoria en cada fase | Compensa que nadie revise cada fase | SP · brainstorming, writing-plans (self-review) |
| Cierre tipo handoff: qué se creó (por ruta), qué queda abierto, siguiente paso; sin duplicar contenido | Estado reanudable sin repetir los documentos | MP · handoff |
| Entrevista a fondo con el Power `grill-me` | Árbol de decisiones con preguntas numeradas | MP · grill-me / grilling |

## sdd-requirements

| Regla | Por qué | Fuente |
|---|---|---|
| Sección `## Fuera de alcance` en requirements.md | Frena el crecimiento de alcance en tareas e implementación | MP · to-spec |
| Historias de usuario completas antes de los criterios EARS | Los criterios cubren todos los aspectos, no solo el camino feliz | MP · to-spec |
| YAGNI: quitar lo que nadie pidió | Menos requisitos, menos código especulativo | SP · brainstorming |
| Usar glosario y respetar ADRs si existen (Power `domain-modeling`) | Lenguaje de dominio consistente entre fases | MP · to-spec, domain-modeling |
| Autorrevisión antes de escribir: placeholders/TBD, contradicciones, alcance, ambigüedad (elegir una lectura explícita) | Detecta fallos baratos antes de que lleguen al diseño | SP · brainstorming (spec self-review) |
| Bugfix: reproducir y buscar la causa antes de fijar el comportamiento esperado (Power `systematic-debugging`) | Evita requisitos que codifican un síntoma | SP · systematic-debugging |
| Modo subagente: no preguntar, devolver dudas abiertas; modo directo: una pregunta por mensaje con respuesta recomendada | Respeta quién puede preguntar en cada modo | Decisión de SDD Studio (riesgo 3 de la investigación: solo sdd-spec tiene `askQuestions`); modo directo: SP · brainstorming + MP · grilling |

## sdd-design

| Regla | Por qué | Fuente |
|---|---|---|
| 2–3 enfoques con trade-offs y recomendación (alimenta "Alternativas consideradas") | La alternativa elegida es una decisión real, no un adorno | SP · brainstorming |
| Unidades con una responsabilidad e interfaz clara: qué hace, cómo se usa, de qué depende (Power `codebase-design`) | Se entienden y prueban por separado | SP · brainstorming; MP · codebase-design |
| Un seam de test, el más alto posible, en "Estrategia de tests" | Tests que no dependen de internos | MP · to-spec |
| Mejoras dirigidas al código existente que afecta el trabajo; sin refactors no relacionados | Diseño enfocado y revisable | SP · brainstorming |
| Rutas y firmas sí; código completo no | El código completo se queda obsoleto; las rutas guían al implementador | MP · to-spec; SP · writing-plans (ver conflictos) |
| Autorrevisión: cada requisito cubierto, sin contradicciones | Nada se pierde entre requisitos y tareas | SP · brainstorming, writing-plans |
| Hechos de APIs/docs con el Power `research`; dudas de comportamiento o aspecto con `prototype` | Decidir con datos, no con suposiciones | MP · research, prototype |

## sdd-tasks

| Regla | Por qué | Fuente |
|---|---|---|
| Rebanadas verticales: cada tarea atraviesa todas las capas y es demostrable | Feedback temprano; nada de capas horizontales a medias | MP · to-tickets |
| Prefactor primero si el código actual dificulta el cambio | "Haz fácil el cambio, luego haz el cambio fácil" | MP · to-tickets |
| Por tarea hoja: Archivos, Interfaces (usa/produce, firmas exactas), Bloqueada por, Verificación y `_Requisitos_` | El implementador solo ve su tarea | SP · writing-plans; MP · to-tickets (blocking edges) |
| Verificación: comando + resultado esperado | Hecho significa algo comprobable | SP · writing-plans |
| Tamaño: setup/doc dentro de la tarea que lo necesita; dividir solo donde un revisor rechazaría una y aprobaría la vecina | Ni tareas triviales ni gigantes | SP · writing-plans (task right-sizing) |
| Prohibidos placeholders ("TBD", "manejar casos límite", "igual que la tarea N") | Un plan vago traslada las decisiones al implementador | SP · writing-plans |
| Autorrevisión: cada criterio cubierto por ≥1 tarea; nombres/tipos consistentes | Trazabilidad e interfaces que encajan | SP · writing-plans (self-review) |
| Bugfix: la primera tarea es el test que reproduce el bug | El arreglo se demuestra | SDD Studio (regla previa, coherente con SP · test-driven-development) |

## sdd-implement

| Regla | Por qué | Fuente |
|---|---|---|
| TDD de hierro: ningún código de producción sin un test que falle antes por la razón correcta (Power `tdd`) | El test prueba algo real | SP · test-driven-development |
| Un test → implementación mínima → repetir; sin features especulativas | Rebanadas verticales también en el código | MP · tdd |
| Refactor fuera del bucle (lo hace la revisión) | Turnos cortos y enfocados | MP · tdd |
| Typecheck y archivo de test a menudo, suite completa al final | Feedback rápido sin perder la red final | MP · implement |
| Evidencia antes de afirmar: comando completo, salida y código de salida citados (Power `verification`) | "Debería funcionar" no es evidencia | SP · verification-before-completion |
| "Cumple requisitos" = checklist línea por línea de los criterios | Que los tests pasen no prueba que se cumpla el spec | SP · verification-before-completion |
| Causa raíz antes de arreglar; tras 3 arreglos fallidos, parar y cuestionar diseño/spec (Power `systematic-debugging`) | Evita parches en bucle sobre un diseño equivocado | SP · systematic-debugging |
| No editar archivos de `specs/` a mano (solo `setTaskStatus` / `approvePhase`) | El estado del spec lo controlan las herramientas | Decisión de SDD Studio |
| Cierre con **Estado:**, archivos, comandos y resultado, checklist de criterios y desviaciones (qué, por qué) | Informe verificable y desviaciones a la vista | SP · subagent-driven-development, executing-plans |
| "↺ Revisar contra requisitos" puede usar el Power `code-review` | Revisión de estándares y de spec | MP · code-review |

## sdd-steering

| Regla | Por qué | Fuente |
|---|---|---|
| Basado en evidencia del repo | Confianza no es evidencia | SP · verification-before-completion |
| Comandos de build/test/lint verificados leyendo `package.json`, scripts y CI (el agente no puede ejecutarlos y lo dice) | Comandos reales, no supuestos | SP · verification-before-completion |
| Lo no deducible va como pregunta al final; una por mensaje si el usuario responde | Preguntas fáciles de contestar | SP · brainstorming |
| Breve y accionable; sin duplicar lo que muestra el código | Es contexto que se carga en cada petición | MP · writing-for-agents |
| Seguir los patrones existentes, sin proponer reestructuras | El steering describe, no rediseña | SP · brainstorming |
| Vocabulario de dominio: sugerir el Power `domain-modeling`; glosario solo en `.github/instructions/` | Lenguaje común sin salir de la carpeta permitida | MP · domain-modeling |

## Decisiones ante conflictos

1. **Archivos.** Los agentes de fase (requisitos, diseño, tareas) solo escriben documentos de spec con `writeSpecDoc`; no crean ledgers, ADRs ni handoffs en archivos. Las decisiones y desviaciones van en el chat o en una sección del propio documento.
2. **Rutas sí, código completo no.** MP to-spec evita rutas y fragmentos; SP writing-plans pide rutas exactas. Como el diseño y las tareas los usa un agente en el mismo repo, se incluyen rutas y firmas, pero no código completo.
3. **Refactor fuera del bucle TDD.** SP propone rojo-verde-refactor; MP tdd saca el refactor del bucle. Se sigue a MP: el refactor lo propone la revisión.
4. **Quick Spec con autorrevisión obligatoria.** Quick Spec encadena fases sin aprobación humana (SP brainstorming pide aprobar cada fase); se mantiene como excepción explícita y se compensa con autorrevisión en cada fase.
5. **Preguntas.** Un subagente no pregunta: devuelve dudas abiertas en su estado. En modo directo, una pregunta por mensaje con respuesta recomendada (SP una por mensaje + MP respuesta recomendada).
6. **Formato de tasks.md compatible.** Se mantienen `- [ ] N. título`, subtareas `N.M`, `[ ]*` y `_Requisitos: …_`; lo nuevo (Archivos, Interfaces, Bloqueada por, Verificación) va como viñetas de detalle que el parser ignora.

## Créditos

- [obra/superpowers](https://github.com/obra/superpowers) — Jesse Vincent, licencia MIT.
- [mattpocock/skills](https://github.com/mattpocock/skills) — Matt Pocock, licencia MIT.
