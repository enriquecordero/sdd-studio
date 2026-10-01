# SDD Studio — Spec 1: extensión base, flujo SDD y tema

- **Fecha:** 2026-10-01
- **Estado:** borrador para revisión
- **Nombre provisional:** `sdd-studio`
- **Spec relacionado:** Spec 2 — Powers (catálogo, GitHub Page, galería). Se escribirá después de este.

## 1. Objetivo

Dar al equipo de desarrollo de la empresa la experiencia de *Spec-Driven Development* (SDD) de Kiro (AWS) dentro de VS Code, usando **GitHub Copilot Enterprise** como única IA y con un aspecto visual inspirado en Kiro.

**Éxito significa:**

- Cualquier dev con Copilot Enterprise instala un `.vsix` interno y puede hacer lo siguiente sin configurar nada más:
  - crear un spec;
  - avanzar requisitos → diseño → tareas con aprobación explícita en cada fase;
  - ejecutar tareas una a una con Copilot.
- Todos los artefactos son Markdown legible, versionado en git junto al código.
- La v1 solo usa funciones GA de VS Code/Copilot, para no depender de que TI habilite funciones preview.

### Lo que pidió el usuario y lo que se supuso

| Origen | Punto |
|---|---|
| Pedido | Emular el SDD de Kiro en VS Code. |
| Pedido | Usar el tema de Kiro. |
| Pedido | Ofrecer "Powers" con skills de la comunidad, presentados con infografía como en Kiro. |
| Pedido | La IA es Copilot Enterprise. |
| Pedido | Es para el equipo o la empresa. |
| Pedido | Se distribuye como VSIX interno. |
| Pedido | La página del catálogo es pública bajo `enriqueacordero`. |
| Pedido | El formato de spec es propio, inspirado en Kiro y no compatible 1:1. |
| Pedido | La UI es tipo Kiro. |
| Pedido | Los Powers se instalan en el repo. |
| Pedido | Hay un tema propio estilo Kiro. |
| Pedido | MCP se trabajará después de la v1. |
| Supuesto | "SSD" = SDD (Spec-Driven Development). |
| Supuesto | No hay backend propio: toda la IA va por las APIs de Copilot en VS Code. |

## 2. Alcance

**Dentro (Spec 1):**

- extensión base;
- panel Specs;
- CodeLens de tareas;
- agentes SDD;
- herramientas `sdd_*`;
- steering;
- diagnóstico;
- tema oscuro;
- CI y empaquetado del VSIX.

**Fuera de la v1:**

- Powers, que van en el Spec 2.
- MCP, que es lo siguiente a trabajar.
- Hooks.
- "Run all tasks" en paralelo.
- Specs Design-First y Quick.
- Tema claro.
- Exportar agentes y prompts al repo, para el coding agent en la nube.
- Aviso automático de nuevas versiones del VSIX.
- Modelo fijo por fase.

## 3. Arquitectura

### 3.1 Repositorios

| Repo | Visibilidad | Contenido |
|---|---|---|
| `sdd-studio` | Privado/interno | Extensión VS Code en TypeScript. El CI genera el `.vsix` y lo publica en GitHub Releases. |
| `enriqueacordero/sdd-studio-powers` | Público | Catálogo de Powers. Se define en el Spec 2. |

### 3.2 Módulos de la extensión

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `specs/` | Modelo de dominio. Lee y escribe documentos de spec, interpreta el front matter y las tareas, calcula la fase y aplica transiciones de estado. Son funciones puras sobre texto. | Nada; no importa `vscode` |
| `workspace/` | Localiza `specs/` en cada carpeta del workspace, observa cambios y aplica ediciones con `WorkspaceEdit`. | `specs/`, `vscode` |
| `ui/specsView` | TreeView "Specs": features, documentos, estado, progreso; secciones Steering y Powers (esta última vacía hasta el Spec 2). | `workspace/` |
| `ui/taskLens` | CodeLens en `tasks.md` ("▶ Ejecutar tarea", "Ver requisitos") y en los documentos ("✓ Aprobar y continuar"). | `workspace/`, `copilot/` |
| `ui/diagnostics` | Avisos en el editor para líneas de tareas mal formadas. | `specs/` |
| `copilot/` | Puente con Copilot Chat. Es el único módulo que conoce los comandos y APIs de chat. Interfaz: `openAgent(agentName, prompt)`. | `vscode` |
| `tools/` | Herramientas de modelo de lenguaje (`languageModelTools`) `sdd_*`. | `workspace/` |
| `doctor/` | Comando de diagnóstico y comprobación al instalar. | `vscode` |
| `agents/` (estático) | Archivos `.agent.md`, `.prompt.md` y plantillas, registrados con `chatAgents` y `chatPromptFiles` en `package.json`. | — |
| `theme/` (estático) | `sdd-studio-dark-color-theme.json`. | — |

## 4. Formato de specs

### 4.1 Estructura en el repo del usuario

```
specs/<feature-kebab>/
  requirements.md      # o bugfix.md para un spec de bug
  design.md
  tasks.md
.github/instructions/  # steering
  product.instructions.md
  tech.instructions.md
  structure.instructions.md
```

El nombre de la carpeta raíz es configurable con `sddStudio.specsFolder` y su valor por defecto es `specs`.

### 4.2 Front matter común

```yaml
---
status: draft        # draft | approved
approvedAt:          # ISO-8601, lo rellena sdd_approvePhase
---
```

### 4.3 Tipo de spec y fase (calculados, no almacenados)

- **Tipo:** `bugfix` si existe `bugfix.md`; en otro caso, `feature`.
- **Orden de documentos:** `[requirements|bugfix, design, tasks]`.
- **Fase actual:** el primer documento del orden que no existe o tiene `status: draft`. Si los tres están aprobados, la fase es `implementation`.
- **Progreso de implementación:** tareas `[x]` / total de tareas obligatorias. Las opcionales no cuentan.

### 4.4 requirements.md (feature)

```markdown
# Requisitos — <feature>

## Introducción
## Glosario            (actores y términos con nombre)
## Requisitos
### Requisito N: <título>
**Historia:** Como <rol>, quiero <capacidad>, para <beneficio>.
#### Criterios de aceptación
1. WHEN <condición> THE SYSTEM SHALL <comportamiento>.
2. IF <condición> THEN THE SYSTEM SHALL <comportamiento>.
3. WHILE <estado> THE SYSTEM SHALL <comportamiento>.
4. THE SYSTEM SHALL NOT <comportamiento>.
```

Las palabras clave EARS van siempre en inglés. El resto del texto sigue el idioma de `sddStudio.language` (`es` por defecto, o `en`).

### 4.5 bugfix.md

Tiene tres secciones, cada una con criterios `WHEN <condición> THEN the system <comportamiento>`:

1. **Comportamiento actual (defecto).**
2. **Comportamiento esperado.**
3. **Comportamiento que no debe cambiar (regresión).**

### 4.6 design.md

Secciones:

- Resumen.
- Arquitectura (con diagramas Mermaid cuando sirvan).
- Componentes e interfaces.
- Modelos de datos.
- Manejo de errores.
- Estrategia de tests.
- Tabla de archivos a crear o modificar.
- Alternativas consideradas.

En un bugfix se añade además el análisis de causa raíz.

### 4.7 tasks.md

```markdown
# Plan de implementación — <feature>

- [ ] 1. <tarea>
  - <detalle>
  - _Requisitos: 1.1, 1.2_
- [ ] 2. <tarea padre>
  - [ ] 2.1 <subtarea>
    - _Requisitos: 2.3_
- [ ]* 3. <tarea opcional>
```

- **Estados:** `[ ]` pendiente, `[-]` en curso, `[x]` hecha. Un `*` después del corchete marca la tarea como opcional.
- **Identificador:** el número jerárquico (`2.1`). Es la clave que usan la CodeLens y las herramientas.
- **Tarea padre:** se considera hecha cuando todas sus subtareas obligatorias lo están. `sdd_setTaskStatus` la actualiza automáticamente.
- **Lectura tolerante:** las líneas que no encajan se conservan sin cambios al reescribir y se reportan como avisos. Reescribir un archivo nunca altera las líneas que no se tocaron.

## 5. Agentes de Copilot

Todos se distribuyen dentro de la extensión mediante `chatAgents`. Ninguno fija `model`, así que se usa el modelo que el usuario elija entre los habilitados por su Enterprise.

| Agente | Propósito | Herramientas | Handoff al terminar |
|---|---|---|---|
| `sdd-requirements` | Entrevista breve y redacción de `requirements.md` o `bugfix.md` | lectura y búsqueda del workspace, `sdd_writeSpecDoc`, `sdd_approvePhase` | "✓ Aprobar requisitos → Diseño" (a `sdd-design`) y "✎ Refinar requisitos" |
| `sdd-design` | Redacta `design.md` a partir de los requisitos aprobados y del código existente | lectura y búsqueda, `sdd_writeSpecDoc`, `sdd_approvePhase` | "✓ Aprobar diseño → Tareas" |
| `sdd-tasks` | Redacta `tasks.md` con trazabilidad a los requisitos | lectura, `sdd_writeSpecDoc`, `sdd_approvePhase` | "✓ Aprobar tareas → Implementar" |
| `sdd-implement` | Ejecuta **una** tarea: código, tests y verificación | todas las de agent mode, `sdd_setTaskStatus` | "✓ Marcar <id> hecha → siguiente" y "↺ Revisar contra requisitos" |
| `sdd-steering` | Genera o actualiza product, tech y structure analizando el repo | lectura y búsqueda, edición limitada a `.github/instructions/` (por instrucción) | — |

- **Restricción de escritura:** los agentes de las tres primeras fases **no** tienen la herramienta genérica de edición. Solo pueden escribir documentos de spec mediante `sdd_writeSpecDoc`, así que no pueden tocar código.
- **Cómo funciona un handoff de aprobación:** el botón envía al siguiente agente un prompt que indica que el usuario aprobó la fase anterior. El agente llama primero a `sdd_approvePhase` y luego trabaja. Aprobar también es posible sin chat, con la CodeLens "✓ Aprobar y continuar" o con el menú contextual del panel.

**Prompt files** (comandos `/`):

- `/spec-new <descripción>`
- `/spec-bugfix <descripción>`
- `/spec-run <spec> <tareaId>`
- `/spec-steering`

Cada uno abre el agente correspondiente.

## 6. Herramientas de la extensión (`languageModelTools`)

| Herramienta | Entrada | Efecto | Errores |
|---|---|---|---|
| `sdd_writeSpecDoc` | `spec`, `doc` (`requirements` \| `bugfix` \| `design` \| `tasks`), `content` | Crea o reemplaza el documento con `status: draft`. Si el documento estaba aprobado, lo devuelve a `draft` y marca como `draft` los documentos posteriores. | Nombre de spec inválido; `doc` que no corresponde al tipo de spec |
| `sdd_approvePhase` | `spec`, `doc` | Pone `status: approved` y `approvedAt` | El documento no existe; algún documento anterior sigue sin aprobar |
| `sdd_setTaskStatus` | `spec`, `taskId`, `status` (`todo` \| `in_progress` \| `done`) | Cambia la casilla y recalcula la tarea padre | `taskId` inexistente; spec no aprobado hasta tareas |

- Todas aplican los cambios con `WorkspaceEdit`, de modo que respetan deshacer y los buffers sin guardar.
- Si el documento cambió desde que el agente lo leyó, la herramienta reaplica la operación sobre el texto actual. Funciona porque cada operación es semántica (marcar la tarea 2.1), no un parche textual.
- Devuelven un mensaje claro que el agente puede mostrar.

## 7. UI

- **Contenedor de actividad "SDD Studio"** (icono ⚡) con la vista **Specs**:
  - Botón "+ Nuevo spec", que pregunta feature o bugfix, el nombre y una descripción, y abre `sdd-requirements`.
  - Árbol con un nodo por spec, que muestra la etiqueta de fase y la barra de progreso. Debajo, sus documentos con el icono de estado.
  - Sección **Steering** con los archivos de `.github/instructions/` y su `applyTo`. Incluye la acción "Generar steering".
  - Sección **Powers**: un marcador de posición hasta el Spec 2.
  - Con varias carpetas en el workspace, el árbol se agrupa por carpeta.
- **CodeLens en `tasks.md`:**
  - Sobre cada tarea pendiente: "▶ Ejecutar tarea" y "Ver requisitos". Este último abre `requirements.md` en los criterios referenciados.
  - Sobre una tarea `[-]`: "◐ en curso".
  - Sobre una tarea `[x]`: "✓ completada".
- **Barra de fases** como CodeLens en la primera línea de cada documento: "✓ Requisitos → ✓ Diseño → ● Tareas → Implementación", más "✓ Aprobar y continuar" cuando el documento está en `draft`.
- **Flujo de "▶ Ejecutar tarea":**
  1. `sdd_setTaskStatus(in_progress)`.
  2. `copilot.openAgent('sdd-implement', prompt)`. El prompt incluye el id y el texto de la tarea, y referencias `#file:` a los tres documentos.
  3. La tarea se marca hecha con el handoff, la CodeLens o el panel.
- **Workspace no confiable:** "Ejecutar tarea" y "Nuevo spec" quedan desactivados.

## 8. Integración con Copilot

- `copilot.openAgent(agent, prompt)` usa `workbench.action.chat.open` con el agente y la consulta.
- **Plan B**, si el spike demuestra que no se puede elegir el agente por código: abrir el chat con el prompt ya escrito y mostrar una notificación "Selecciona el agente `sdd-implement`".
- La interfaz no cambia entre la implementación principal y el plan B.

## 9. Diagnóstico y políticas

El comando **"SDD Studio: Diagnóstico"** se ejecuta automáticamente una vez tras instalar o actualizar. Comprueba:

1. Que la extensión Copilot Chat está instalada, activa y con sesión iniciada.
2. Que agent mode está habilitado (setting y política `ChatAgentMode`).
3. Que las herramientas de extensión están permitidas (`chat.extensionTools.enabled` / `ChatAgentExtensionTools`).
4. Si `ChatStrictPluginOnlyCustomization` está activa. En ese caso avisa de que las customizaciones de workspace (instructions de steering y, en el Spec 2, los skills) no se cargarán.
5. Si la versión de VS Code es menor que la mínima.

Cada fallo indica la causa y la acción: qué pedir a TI o qué setting cambiar. Los resultados se muestran en un panel de salida y como un resumen en una notificación.

## 10. Tema "SDD Studio Dark"

- Se basa en la paleta de *Kiro Theme* (`MohdZaid.kiro-theme`, MIT), con atribución en `NOTICE`:

  | Uso | Color |
  |---|---|
  | Fondo | `#211d25` |
  | Acento | `#b080ff` |
  | Botones y badges | `#7138cc` |
  | Keywords | `#e2d3fe` |
  | Funciones | `#8dc8fb` |
  | Strings | `#80ffb5` |

- Se registra con `themes` en `package.json`.
- La primera vez que se activa la extensión, se pregunta una sola vez "¿Activar SDD Studio Dark?". Nunca se cambia el tema sin preguntar.

## 11. Tests

| Capa | Herramienta | Qué cubre |
|---|---|---|
| `specs/` | vitest | Lectura y reescritura de `tasks.md` (ida y vuelta idéntica), cálculo de fase y tipo, transiciones, tareas padre, líneas tolerantes, front matter, specs de ejemplo con formato Kiro |
| `workspace/`, `tools/`, `ui/` | `@vscode/test-electron` | El árbol se llena desde un workspace de ejemplo; CodeLens en las posiciones correctas; las herramientas editan archivos y reportan errores; workspace no confiable |
| `copilot/` | Implementación falsa de la interfaz en los tests anteriores | Que "Ejecutar tarea" llama `openAgent` con el agente y el prompt correctos |
| Agentes | Repo de ejemplo `examples/todo-app` y checklist manual | Cada agente produce el formato de la sección 4 y respeta las restricciones de escritura |

## 12. Build y distribución

- **Stack:** TypeScript, esbuild y `@vscode/vsce package`.
- **CI (GitHub Actions):**
  - En cada PR se ejecutan lint, vitest y los tests de integración (con `xvfb` en Linux).
  - Cada tag `v*` genera el `.vsix` y lo adjunta a un GitHub Release del repo interno.
- **Instalación:** `code --install-extension sdd-studio-<ver>.vsix`.
- **Versión mínima** (`engines.vscode`): la fija el spike (sección 13). La referencia es VS Code 1.140, la estable actual.

## 13. Riesgos y spike inicial

Primera tarea de implementación, antes del resto:

1. **Abrir chat con un agente por código.** Confirmar que `workbench.action.chat.open` acepta un custom agent registrado por una extensión. Si no lo acepta, aplica el plan B de la sección 8.
2. **Contribución de agentes.** Confirmar que `chatAgents` admite los handoffs y la lista `tools` con herramientas de la propia extensión.
3. **Política estricta.** Ver cómo se comportan los agentes y prompts registrados por la extensión cuando `ChatStrictPluginOnlyCustomization` está activa.
4. Fijar la versión mínima de VS Code según lo anterior.

El spike es desechable y su resultado se documenta en el README del repo.

## 14. Preguntas abiertas

- El nombre definitivo del producto. `sdd-studio` es provisional.
- La organización de GitHub donde vivirá el repo privado `sdd-studio`.
