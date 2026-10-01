# SDD Studio (Spec 1) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la extensión de VS Code "SDD Studio" que ofrece el flujo de Spec-Driven Development estilo Kiro (requisitos → diseño → tareas → implementación) sobre GitHub Copilot, con panel Specs, CodeLens de tareas, agentes SDD, herramientas `sdd_*`, diagnóstico y el tema "SDD Studio Dark".

**Architecture:**
- **Núcleo de dominio puro.** `src/specs/` no importa `vscode` y se prueba con vitest.
- **Capa de workspace.** `src/workspace/` lee y escribe los specs del disco y de los editores abiertos.
- **UI y conexión con Copilot.** Sobre esa capa van el TreeView, las CodeLens y los comandos, junto con el puente `copilot/`. Ese puente es el único sitio que conoce el comando de chat.
- **Agentes.** Los agentes y prompt files son Markdown estático, registrado en `package.json`.
- **Sin backend.** Toda la IA va por Copilot.

**Tech Stack:**
- TypeScript, con esbuild para empaquetar.
- vitest para tests unitarios.
- `@vscode/test-cli` + `@vscode/test-electron` + mocha para tests de integración.
- `@vscode/vsce` para generar el `.vsix`.
- typescript-eslint para lint.
- GitHub Actions para CI.

**Spec:** `/Users/enriquecordero/Documents/brainstorming/docs/superpowers/specs/2026-10-01-sdd-studio-core-design.md`. La Tarea 1 lo copia a `docs/spec.md` dentro del repo nuevo.

## Global Constraints

**Repo e identidad de la extensión**
- El repo nuevo vive en `/Users/enriquecordero/Documents/sdd-studio`. Todas las rutas del plan son relativas a esa carpeta, salvo que se indique otra cosa.
- `package.json`: `name: "sdd-studio"`, `publisher: "enriqueacordero"`, id `enriqueacordero.sdd-studio`, `displayName: "SDD Studio"`.
- `engines.vscode`: el valor que fije el spike en `docs/spike-findings.md`. La referencia es `^1.140.0`.

**Qué se puede usar**
- Solo funciones GA de VS Code/Copilot: **sin hooks y sin MCP**.
- Ninguna llamada de red y ningún backend propio.
- `src/specs/**`, `src/workspace/resolve.ts`, `src/copilot/prompts.ts`, `src/ui/labels.ts`, `src/ui/lensModel.ts` y `src/doctor/checks.ts` **no importan `vscode`**. ESLint lo verifica.

**Textos e idioma**
- Los textos de la UI van en español.
- Las palabras clave EARS (`WHEN`, `IF`, `THEN`, `WHILE`, `THE SYSTEM SHALL`, `SHALL NOT`) siempre van en inglés.

**Settings**
- `sddStudio.specsFolder` (string, por defecto `"specs"`).
- `sddStudio.language` (`"es"` | `"en"`, por defecto `"es"`).

**Nombres fijos**
- Herramientas: `sdd_writeSpecDoc`, `sdd_approvePhase`, `sdd_setTaskStatus`. Sus `toolReferenceName` son `writeSpecDoc`, `approvePhase` y `setTaskStatus`.
- Agentes: `sdd-requirements`, `sdd-design`, `sdd-tasks`, `sdd-implement`, `sdd-steering`.
- Prompt files: `/spec-new`, `/spec-bugfix`, `/spec-run`, `/spec-steering`.

**Formato de los documentos**
- Front matter: `status: draft | approved` y `approvedAt` en ISO-8601. Si falta el front matter o el valor no se reconoce, cuenta como `draft`.
- Marcas de tarea: `[ ]` pendiente, `[-]` en curso, `[x]` (o `[X]`) hecha. Un `*` justo después del `]` marca la tarea como opcional.
- El id de una tarea es su número jerárquico (`2.1`).

**Tema y workspace**
- El tema se llama "SDD Studio Dark" y lleva atribución a `MohdZaid.kiro-theme` (MIT) en `NOTICE`. Nunca se cambia el tema sin preguntar.
- En un workspace no confiable, `sddStudio.newSpec` y `sddStudio.runTask` están desactivados.

**Commits**
- Cada commit termina con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

Hay cinco casos que el spec implica pero que nadie probaría por accidente. Cada uno tiene un test en la tarea indicada:

1. **`tasks.md` con finales de línea CRLF (devs en Windows).** Cambiar el estado de una tarea debe conservar CRLF en todo el archivo. → Tarea 4, test `preserva CRLF`.
2. **Documento abierto en el editor con cambios sin guardar cuando un agente lo modifica.** El cambio se aplica sobre el buffer, que sigue sin guardar; no se pierde lo que escribió el usuario y no se escribe al disco. → Tarea 7, test `respeta un buffer sucio`.
3. **Nombre de spec con acentos o espacios desde "Nuevo spec"** (por ejemplo "Exportación CSV"). Se convierte a `exportacion-csv`, no a un nombre inválido. → Tarea 3, test `toSpecName`.
4. **El agente envía a `sdd_writeSpecDoc` un contenido dentro de un bloque ```` ```markdown ```` o con su propio front matter.** El archivo final debe tener un único front matter limpio. → Tarea 3, test `prepareSpecDocContent`.
5. **Mismo nombre de spec en dos carpetas de un workspace multi-root, sin indicar `folder`.** Debe dar un error claro que nombre las carpetas, no escribir en una al azar. → Tarea 6, test `resolveSpecFolder`.

---

## Estructura de archivos

```
sdd-studio/
  package.json                 manifiesto y contribuciones (crece en cada tarea)
  tsconfig.json                typecheck de src + test
  tsconfig.test.json           compila tests de integración a out/
  esbuild.mjs                  bundle src/extension.ts → dist/extension.js
  vitest.config.ts             tests unitarios (test/unit)
  .vscode-test.mjs             tests de integración (out/test/integration)
  eslint.config.mjs            lint + regla "módulos puros sin vscode"
  .vscodeignore, .gitignore, LICENSE.md, NOTICE, README.md
  media/sdd-studio.svg         icono de la barra de actividad
  themes/sdd-studio-dark-color-theme.json
  agents/*.agent.md            5 agentes SDD
  prompts/*.prompt.md          4 prompt files
  src/
    extension.ts               activate(): conecta todo y devuelve SddStudioApi
    specs/                     PURO
      errors.ts                SpecError + códigos
      frontMatter.ts           leer/escribir front matter, prepareSpecDocContent
      names.ts                 validar y generar nombres de spec
      tasks.ts                 parseTasks, withTaskStatus, progress
      phase.ts                 tipos de doc/fase, orden, reglas de aprobación
      requirements.ts          findRequirementLine
    workspace/
      resolve.ts               PURO: resolveSpecFolder (multi-root)
      edits.ts                 transformFile (buffer abierto o disco)
      specStore.ts             SpecStore: leer specs, snapshots, watchers, steering
      specService.ts           SpecService: writeSpecDoc, approvePhase, setTaskStatus
    tools/
      registerTools.ts         createToolHandlers + registerTools (vscode.lm)
    copilot/
      prompts.ts               PURO: textos de prompt + AgentName
      bridge.ts                CopilotBridge + VsCodeCopilotBridge
    ui/
      labels.ts                PURO: textos de fase/estado
      lensModel.ts             PURO: qué CodeLens van en qué línea
      specsTree.ts             TreeDataProvider "Specs"
      specCommands.ts          newSpec, refresh, generateSteering
      taskLens.ts              CodeLensProvider
      taskCommands.ts          runTask, markTaskDone, approveAndContinue, openRequirements
      diagnostics.ts           avisos en tasks.md
      themePrompt.ts           ofrecer el tema una vez
    doctor/
      checks.ts                PURO: reglas de diagnóstico
      doctor.ts                recoger entorno, informar, ejecutar una vez
  test/
    unit/**.test.ts            vitest
    integration/**.test.ts     mocha dentro de VS Code
    fixtures/pristine/         specs de ejemplo (fuente de verdad)
    fixtures/workspace/        carpeta que abre el VS Code de test (se rellena desde pristine)
  examples/todo-app/           repo de ejemplo para la checklist manual
  docs/spec.md, docs/plan.md, docs/spike-findings.md, docs/manual-checklist.md
  .github/workflows/ci.yml, release.yml
```

---

### Task 1: Repo nuevo + spike de integración con Copilot

Este spike es **desechable**: el código vive fuera del repo y solo se commitean los hallazgos. Necesita que el humano (Enrique) observe la UI de Copilot Chat. El agente prepara todo, y el humano ejecuta los pasos 5 a 7 y rellena la tabla.

**Files:**
- Create: `/Users/enriquecordero/Documents/sdd-studio/.gitignore`
- Create: `docs/spec.md` (copia del spec)
- Create: `docs/plan.md` (copia de este plan)
- Create: `docs/spike-findings.md`
- Desechable (no se commitea): `/Users/enriquecordero/Documents/sdd-studio-spike/**`

**Interfaces:**
- Produces: `docs/spike-findings.md`, con los valores que usan las Tareas 2, 8, 11 y 12. Son: el valor del argumento `mode`, los ids de herramientas en `tools:`, los ids de los toolsets integrados, el setting de la política estricta y la versión mínima de VS Code.

- [ ] **Step 1: Crear el repo y copiar los documentos**

```bash
mkdir -p /Users/enriquecordero/Documents/sdd-studio/docs
cd /Users/enriquecordero/Documents/sdd-studio
git init -q
printf 'node_modules/\ndist/\nout/\n*.vsix\n.vscode-test/\n.DS_Store\n' > .gitignore
cp /Users/enriquecordero/Documents/brainstorming/docs/superpowers/specs/2026-10-01-sdd-studio-core-design.md docs/spec.md
cp /Users/enriquecordero/Documents/brainstorming/docs/superpowers/plans/2026-10-01-sdd-studio-core.md docs/plan.md
```

- [ ] **Step 2: Crear la extensión del spike**

`/Users/enriquecordero/Documents/sdd-studio-spike/package.json`:

```json
{
  "name": "sdd-spike",
  "publisher": "enriqueacordero",
  "version": "0.0.1",
  "engines": { "vscode": "^1.100.0" },
  "main": "./extension.js",
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "commands": [
      { "command": "spike.openWithMode", "title": "Spike: abrir chat con mode=spike-agent" },
      { "command": "spike.openPartial", "title": "Spike: abrir chat con prompt parcial" }
    ],
    "chatAgents": [{ "path": "./agents/spike-agent.agent.md" }, { "path": "./agents/spike-next.agent.md" }],
    "chatPromptFiles": [{ "path": "./prompts/spike-run.prompt.md" }],
    "languageModelTools": [
      {
        "name": "spike_echo",
        "toolReferenceName": "spikeEcho",
        "displayName": "Spike echo",
        "canBeReferencedInPrompt": true,
        "modelDescription": "Devuelve el texto recibido. Úsala cuando el usuario diga 'eco'.",
        "inputSchema": { "type": "object", "properties": { "text": { "type": "string" } }, "required": ["text"] }
      }
    ]
  }
}
```

`/Users/enriquecordero/Documents/sdd-studio-spike/extension.js`:

```js
const vscode = require('vscode');
exports.activate = (context) => {
  context.subscriptions.push(
    vscode.lm.registerTool('spike_echo', {
      invoke: async (options) =>
        new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(`ECO: ${options.input.text}`)]),
    }),
    vscode.commands.registerCommand('spike.openWithMode', () =>
      vscode.commands.executeCommand('workbench.action.chat.open', { query: 'di eco hola', mode: 'spike-agent' }),
    ),
    vscode.commands.registerCommand('spike.openPartial', () =>
      vscode.commands.executeCommand('workbench.action.chat.open', { query: 'di eco hola', isPartialQuery: true }),
    ),
  );
};
```

`/Users/enriquecordero/Documents/sdd-studio-spike/agents/spike-agent.agent.md`:

```markdown
---
name: spike-agent
description: Agente de prueba del spike de SDD Studio
tools: ['search', 'read', 'spikeEcho']
handoffs:
  - label: "→ Pasar a spike-next"
    agent: spike-next
    prompt: "Continúa: llama a spikeEcho con 'handoff ok'."
    send: true
---
Cuando el usuario diga "eco X", llama a la herramienta spikeEcho con text = X y responde con el resultado.
```

`/Users/enriquecordero/Documents/sdd-studio-spike/agents/spike-next.agent.md`:

```markdown
---
name: spike-next
description: Segundo agente del spike (destino del handoff)
tools: ['spikeEcho']
---
Llama a spikeEcho con el texto que te pidan.
```

`/Users/enriquecordero/Documents/sdd-studio-spike/prompts/spike-run.prompt.md`:

```markdown
---
name: spike-run
description: Prompt file de prueba
agent: spike-agent
---
Di eco desde prompt file.
```

- [ ] **Step 3: Buscar en el código de VS Code las opciones de `workbench.action.chat.open`**

Usa WebFetch con `https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/workbench/contrib/chat/browser/actions/chatActions.ts` y busca `interface IChatViewOpenOptions`. Anota qué tipo acepta `mode`: el id de un modo, el nombre de un custom agent, o ambos.

- [ ] **Step 4: Buscar el setting de la política estricta**

Usa WebFetch con `https://code.visualstudio.com/docs/enterprise/policies` y anota el nombre del setting asociado a `ChatStrictPluginOnlyCustomization`.

- [ ] **Step 5 (humano): Ejecutar el spike**

```bash
code --extensionDevelopmentPath=/Users/enriquecordero/Documents/sdd-studio-spike /Users/enriquecordero/Documents/sdd-studio-spike
```

En la ventana nueva, con sesión de Copilot iniciada:
- (a) Ejecuta "Spike: abrir chat con mode=spike-agent". Anota si el chat se abre **con `spike-agent` ya seleccionado**.
- (b) Si no queda seleccionado, prueba en la consola del Developer Tools otras variantes de `mode`. Usa los ids que viste en el paso 3.
- (c) Envía "eco hola". Anota si `spike-agent` llama a `spikeEcho`. Si no, abre "Configure Tools…" en el chat y anota el id exacto con que aparece la herramienta. Ese id es el que va en `tools:`.
- (d) Anota si aparece el botón "→ Pasar a spike-next" y si al pulsarlo cambia de agente.
- (e) Escribe `/spike-run` en el chat y anota si existe y abre `spike-agent`.
- (f) Abre "Configure Tools…" y anota los ids de los toolsets integrados de búsqueda, lectura, edición y terminal.
- (g) Revisa la vista Problems del `package.json` del spike y anota los avisos de esquema de `chatAgents` y `chatPromptFiles`.
- (h) Ejecuta "Help: About" y anota la versión de VS Code.

- [ ] **Step 6 (humano, opcional): Comprobar la política estricta**

Si tienes una máquina con políticas de empresa, activa el setting del paso 4 y repite (a) y (c). Si no, escribe "no probado".

- [ ] **Step 7: Escribir `docs/spike-findings.md`**

```markdown
# Hallazgos del spike — <fecha>

| # | Pregunta | Resultado | Valor a usar |
|---|---|---|---|
| 1 | ¿`workbench.action.chat.open` selecciona un agente de extensión? | sí / no | `SUPPORTS_AGENT_ARG = true/false`; argumento: `mode: "<valor>"` |
| 2 | ¿El esquema de `chatAgents` (`path`) se acepta sin avisos? | | campos válidos: |
| 3 | ¿Funcionan los handoffs en agentes de extensión? | | |
| 4 | Id de una herramienta de extensión en `tools:` | | p. ej. `spikeEcho` → SDD usará `writeSpecDoc`… |
| 5 | Ids de toolsets integrados (búsqueda, lectura, edición, terminal) | | p. ej. `search`, `read`, `edit`, `execute` |
| 6 | ¿`chatPromptFiles` funciona y `agent:` selecciona el agente? | | |
| 7 | Setting de `ChatStrictPluginOnlyCustomization` | | `<clave>` |
| 8 | Con la política estricta, ¿cargan agentes y herramientas de extensión? | | |
| 9 | Versión mínima de VS Code (`engines.vscode`) | | `^1.xxx.0` |

**Decisión del puente con Copilot:** plan A (agente por argumento) / plan B (prompt parcial + aviso).
```

- [ ] **Step 8: Commit**

```bash
cd /Users/enriquecordero/Documents/sdd-studio
git add .gitignore docs/
git commit -m "docs: spec, plan y hallazgos del spike de integración con Copilot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Esqueleto de la extensión, build y runners de test

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.test.json`, `esbuild.mjs`, `vitest.config.ts`, `.vscode-test.mjs`, `eslint.config.mjs`, `.vscodeignore`, `LICENSE.md`
- Create: `src/extension.ts`
- Create: `test/unit/smoke.test.ts`, `test/integration/activation.test.ts`, `test/fixtures/workspace/.gitignore`

**Interfaces:**
- Produces: los scripts `npm run build | typecheck | lint | test:unit | test:integration | package`. También `activate(context)` en `src/extension.ts`, que de momento devuelve `{}` y la Tarea 6 amplía hasta `SddStudioApi`.

- [ ] **Step 1: `package.json`**

Sustituye `^1.140.0` por la versión de la fila 9 de `docs/spike-findings.md`.

```json
{
  "name": "sdd-studio",
  "displayName": "SDD Studio",
  "description": "Spec-Driven Development estilo Kiro para VS Code, con GitHub Copilot.",
  "version": "0.1.0",
  "publisher": "enriqueacordero",
  "private": true,
  "license": "SEE LICENSE IN LICENSE.md",
  "repository": { "type": "git", "url": "https://github.com/enriqueacordero/sdd-studio" },
  "engines": { "vscode": "^1.140.0" },
  "categories": ["AI", "Chat", "Themes"],
  "main": "./dist/extension.js",
  "activationEvents": ["onStartupFinished"],
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": "limited",
      "description": "En workspaces no confiables no se pueden crear specs ni ejecutar tareas."
    }
  },
  "contributes": {
    "configuration": {
      "title": "SDD Studio",
      "properties": {
        "sddStudio.specsFolder": {
          "type": "string",
          "default": "specs",
          "description": "Carpeta (relativa a la raíz del workspace) donde viven los specs."
        },
        "sddStudio.language": {
          "type": "string",
          "enum": ["es", "en"],
          "default": "es",
          "description": "Idioma en que los agentes redactan los specs. Las palabras clave EARS siempre van en inglés."
        }
      }
    }
  },
  "scripts": {
    "build": "node esbuild.mjs",
    "watch": "node esbuild.mjs --watch",
    "vscode:prepublish": "npm run build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test:unit": "vitest run",
    "compile:tests": "tsc -p tsconfig.test.json",
    "test:integration": "npm run build && npm run compile:tests && vscode-test",
    "package": "vsce package --no-dependencies"
  }
}
```

- [ ] **Step 2: Instalar las dependencias de desarrollo**

Usa la versión de la fila 9 del spike para `@types/vscode`.

```bash
cd /Users/enriquecordero/Documents/sdd-studio
npm install -D typescript esbuild vitest eslint typescript-eslint @types/node @types/mocha mocha @vscode/test-cli @vscode/test-electron @vscode/vsce
npm install -D @types/vscode@1.140.0
```

- [ ] **Step 3: Configuración de TypeScript, esbuild, vitest, test-cli y ESLint**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "types": ["node", "mocha"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

`tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": "out", "rootDir": ".", "sourceMap": true },
  "include": ["src", "test/integration"]
}
```

`esbuild.mjs`:

```js
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
});
if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/unit/**/*.test.ts'], environment: 'node' },
});
```

`.vscode-test.mjs`:

```js
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/integration/**/*.test.js',
  workspaceFolder: './test/fixtures/workspace',
  launchArgs: ['--disable-extensions'],
  mocha: { ui: 'bdd', timeout: 20000 },
});
```

`eslint.config.mjs`:

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'out/**', 'node_modules/**', '.vscode-test/**'] },
  ...tseslint.configs.recommended,
  {
    files: [
      'src/specs/**/*.ts',
      'src/workspace/resolve.ts',
      'src/copilot/prompts.ts',
      'src/ui/labels.ts',
      'src/ui/lensModel.ts',
      'src/doctor/checks.ts',
    ],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'vscode', message: 'Módulo puro: no importes vscode.' }] }],
    },
  },
);
```

`.vscodeignore`:

```
src/**
test/**
out/**
docs/**
examples/**
node_modules/**
.vscode-test/**
.github/**
*.mjs
tsconfig*.json
vitest.config.ts
**/*.map
```

`LICENSE.md`:

```markdown
Copyright (c) 2026 Enrique Cordero. Todos los derechos reservados.
Uso interno. Ver NOTICE para los componentes de terceros.
```

`test/fixtures/workspace/.gitignore` (la carpeta se rellena en cada test desde `pristine/`):

```
*
!.gitignore
```

- [ ] **Step 4: Escribir los tests de humo, que deben fallar**

`test/unit/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('vitest funciona', () => {
    expect(1 + 1).toBe(2);
  });
});
```

`test/integration/activation.test.ts`:

```ts
import * as assert from 'assert';
import * as vscode from 'vscode';

describe('activación', () => {
  it('la extensión se activa', async () => {
    const ext = vscode.extensions.getExtension('enriqueacordero.sdd-studio');
    assert.ok(ext, 'extensión no encontrada');
    await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });
});
```

- [ ] **Step 5: Ejecutar el test de integración para ver que falla**

Run: `npm run test:integration`
Expected: FAIL. esbuild no encuentra `src/extension.ts`.

- [ ] **Step 6: `src/extension.ts` mínimo**

```ts
import * as vscode from 'vscode';

export function activate(_context: vscode.ExtensionContext): Record<string, never> {
  return {};
}

export function deactivate(): void {}
```

- [ ] **Step 7: Ejecutar todo y comprobar que pasa**

Run: `npm run typecheck && npm run lint && npm run test:unit && npm run test:integration`
Expected:
- typecheck y lint sin errores.
- vitest: `1 passed`.
- integración: `1 passing`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: esqueleto de la extensión con build, lint y runners de test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dominio: errores, front matter y nombres de spec

**Files:**
- Create: `src/specs/errors.ts`, `src/specs/frontMatter.ts`, `src/specs/names.ts`
- Test: `test/unit/specs/frontMatter.test.ts`, `test/unit/specs/names.test.ts`

**Interfaces:**
- Produces:
  - `class SpecError extends Error { readonly code: SpecErrorCode }`, con códigos `'INVALID_INPUT' | 'INVALID_NAME' | 'TYPE_MISMATCH' | 'DOC_MISSING' | 'PREVIOUS_NOT_APPROVED' | 'NOT_READY' | 'TASK_NOT_FOUND' | 'FOLDER'`.
  - `type DocStatus = 'draft' | 'approved'`
  - `readFrontMatter(text: string): { status: DocStatus; approvedAt?: string }`
  - `frontMatterFields(text: string): Map<string, string>`
  - `setFrontMatterFields(text: string, fields: Record<string, string | undefined>): string`. Un valor `undefined` elimina la clave.
  - `prepareSpecDocContent(content: string): string`
  - `isValidSpecName(name: string): boolean`
  - `toSpecName(input: string): string`

- [ ] **Step 1: Escribir los tests que fallan**

`test/unit/specs/frontMatter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  frontMatterFields,
  prepareSpecDocContent,
  readFrontMatter,
  setFrontMatterFields,
} from '../../../src/specs/frontMatter';

describe('readFrontMatter', () => {
  it('sin front matter es draft', () => {
    expect(readFrontMatter('# Hola\n')).toEqual({ status: 'draft' });
  });
  it('lee approved y approvedAt', () => {
    const text = '---\nstatus: approved\napprovedAt: 2026-10-01T10:00:00.000Z\n---\n# Doc\n';
    expect(readFrontMatter(text)).toEqual({ status: 'approved', approvedAt: '2026-10-01T10:00:00.000Z' });
  });
  it('un status desconocido cuenta como draft', () => {
    expect(readFrontMatter('---\nstatus: listo\n---\nx\n').status).toBe('draft');
  });
  it('acepta CRLF', () => {
    expect(readFrontMatter('---\r\nstatus: approved\r\n---\r\nx\r\n').status).toBe('approved');
  });
});

describe('frontMatterFields', () => {
  it('devuelve todas las claves', () => {
    const fields = frontMatterFields('---\napplyTo: "**/*.ts"\ndescription: Tech\n---\nbody');
    expect(fields.get('applyTo')).toBe('"**/*.ts"');
    expect(fields.get('description')).toBe('Tech');
  });
});

describe('setFrontMatterFields', () => {
  it('añade front matter a un documento sin él y conserva el cuerpo exacto', () => {
    expect(setFrontMatterFields('# Título\n\ntexto\n', { status: 'draft' })).toBe(
      '---\nstatus: draft\n---\n# Título\n\ntexto\n',
    );
  });
  it('reemplaza claves, conserva desconocidas y elimina las undefined', () => {
    const text = '---\nstatus: approved\nowner: ana\napprovedAt: 2026-01-01\n---\nbody\n';
    expect(setFrontMatterFields(text, { status: 'draft', approvedAt: undefined })).toBe(
      '---\nstatus: draft\nowner: ana\n---\nbody\n',
    );
  });
  it('mantiene CRLF', () => {
    const text = '---\r\nstatus: draft\r\n---\r\nbody\r\n';
    expect(setFrontMatterFields(text, { status: 'approved' })).toBe('---\r\nstatus: approved\r\n---\r\nbody\r\n');
  });
});

describe('prepareSpecDocContent', () => {
  it('quita un bloque ```markdown que envuelve todo', () => {
    expect(prepareSpecDocContent('```markdown\n# Requisitos\n\nx\n```')).toBe('# Requisitos\n\nx\n');
  });
  it('quita el front matter que traiga el agente', () => {
    expect(prepareSpecDocContent('---\nstatus: approved\n---\n\n# Diseño\n')).toBe('# Diseño\n');
  });
  it('quita ambos a la vez y añade salto final', () => {
    expect(prepareSpecDocContent('```md\n---\nstatus: approved\n---\n# Tareas\n```')).toBe('# Tareas\n');
  });
  it('no toca bloques de código internos', () => {
    const doc = '# Diseño\n\n```ts\nconst a = 1;\n```\n';
    expect(prepareSpecDocContent(doc)).toBe(doc);
  });
});
```

`test/unit/specs/names.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isValidSpecName, toSpecName } from '../../../src/specs/names';

describe('isValidSpecName', () => {
  it.each(['export-csv', 'a', 'login-sso-2'])('%s es válido', (n) => expect(isValidSpecName(n)).toBe(true));
  it.each(['', 'Export', 'a--b', '-a', 'a-', 'a b', 'ñandú', 'x'.repeat(65)])('"%s" es inválido', (n) =>
    expect(isValidSpecName(n)).toBe(false),
  );
});

describe('toSpecName', () => {
  it('quita acentos, espacios y mayúsculas', () => {
    expect(toSpecName('Exportación CSV')).toBe('exportacion-csv');
  });
  it('colapsa símbolos y recorta guiones', () => {
    expect(toSpecName('  ¡Login / SSO!  ')).toBe('login-sso');
  });
  it('limita a 64 caracteres sin guion final', () => {
    const name = toSpecName('a'.repeat(63) + ' b');
    expect(name.length).toBeLessThanOrEqual(64);
    expect(isValidSpecName(name)).toBe(true);
  });
  it('devuelve vacío si no queda nada', () => {
    expect(toSpecName('¿¿??')).toBe('');
  });
});
```

- [ ] **Step 2: Ejecutar los tests para ver que fallan**

Run: `npx vitest run test/unit/specs`
Expected: FAIL. Los módulos `src/specs/frontMatter` y `src/specs/names` no existen.

- [ ] **Step 3: Implementación**

`src/specs/errors.ts`:

```ts
export type SpecErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_NAME'
  | 'TYPE_MISMATCH'
  | 'DOC_MISSING'
  | 'PREVIOUS_NOT_APPROVED'
  | 'NOT_READY'
  | 'TASK_NOT_FOUND'
  | 'FOLDER';

export class SpecError extends Error {
  constructor(
    readonly code: SpecErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SpecError';
  }
}
```

`src/specs/frontMatter.ts`:

```ts
export type DocStatus = 'draft' | 'approved';

export interface FrontMatter {
  status: DocStatus;
  approvedAt?: string;
}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n?---(?:\r?\n|$)/;

interface SplitResult {
  lines: string[];
  body: string;
  eol: string;
}

function split(text: string): SplitResult {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const match = FRONT_MATTER_RE.exec(text);
  if (!match) return { lines: [], body: text, eol };
  const inner = match[1];
  return { lines: inner === '' ? [] : inner.split(/\r?\n/), body: text.slice(match[0].length), eol };
}

function keyOf(line: string): string | undefined {
  const i = line.indexOf(':');
  return i > 0 ? line.slice(0, i).trim() : undefined;
}

export function frontMatterFields(text: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of split(text).lines) {
    const key = keyOf(line);
    if (key) fields.set(key, line.slice(line.indexOf(':') + 1).trim());
  }
  return fields;
}

export function readFrontMatter(text: string): FrontMatter {
  const fields = frontMatterFields(text);
  const status: DocStatus = fields.get('status') === 'approved' ? 'approved' : 'draft';
  const approvedAt = fields.get('approvedAt');
  return approvedAt ? { status, approvedAt } : { status };
}

export function setFrontMatterFields(text: string, fields: Record<string, string | undefined>): string {
  const { lines, body, eol } = split(text);
  const out = [...lines];
  for (const [key, value] of Object.entries(fields)) {
    const index = out.findIndex((line) => keyOf(line) === key);
    if (value === undefined) {
      if (index >= 0) out.splice(index, 1);
    } else if (index >= 0) {
      out[index] = `${key}: ${value}`;
    } else {
      out.push(`${key}: ${value}`);
    }
  }
  return ['---', ...out, '---'].join(eol) + eol + body;
}

const WRAPPING_FENCE_RE = /^```(?:markdown|md)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/;

export function prepareSpecDocContent(content: string): string {
  let text = content.trim();
  const fence = WRAPPING_FENCE_RE.exec(text);
  if (fence) text = fence[1].trim();
  text = split(text).body.replace(/^\s+/, '');
  return text.endsWith('\n') ? text : `${text}\n`;
}
```

`src/specs/names.ts`:

```ts
const SPEC_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LENGTH = 64;

export function isValidSpecName(name: string): boolean {
  return name.length <= MAX_LENGTH && SPEC_NAME_RE.test(name);
}

export function toSpecName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, '');
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run test/unit/specs && npm run lint`
Expected: PASS. Todos los tests de frontMatter y names pasan y lint no da errores.

- [ ] **Step 5: Commit**

```bash
git add src/specs test/unit/specs
git commit -m "feat(specs): errores, front matter y nombres de spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Dominio: tareas (`tasks.md`)

**Files:**
- Create: `src/specs/tasks.ts`
- Test: `test/unit/specs/tasks.test.ts`

**Interfaces:**
- Consumes: `SpecError` (Tarea 3).
- Produces:
  - `type TaskStatus = 'todo' | 'in_progress' | 'done'`
  - `interface Task { id: string; title: string; status: TaskStatus; optional: boolean; line: number; depth: number; requirements: string[]; parentId?: string }`. `line` empieza en 0.
  - `interface TaskWarning { line: number; message: string }`
  - `parseTasks(text: string): { tasks: Task[]; warnings: TaskWarning[] }`
  - `withTaskStatus(text: string, taskId: string, status: TaskStatus): string`. Lanza `SpecError('TASK_NOT_FOUND')` si la tarea no existe.
  - `isLeaf(task: Task, tasks: Task[]): boolean`
  - `progress(tasks: Task[]): { done: number; total: number }`. Cuenta solo hojas obligatorias.

- [ ] **Step 1: Escribir los tests que fallan**

`test/unit/specs/tasks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SpecError } from '../../../src/specs/errors';
import { parseTasks, progress, withTaskStatus } from '../../../src/specs/tasks';

const DOC = [
  '---',
  'status: approved',
  '---',
  '# Plan de implementación — pagos',
  '',
  '- [x] 1. Modelo PaymentIntent',
  '  - _Requisitos: 1.1, 1.2_',
  '- [ ] 2. Endpoint POST /checkout',
  '  - [ ] 2.1 Validar carrito',
  '    - _Requisitos: 2.1_',
  '  - [ ] 2.2 Idempotency-Key',
  '    - _Requirements: 2.3_',
  '- [ ]* 3. Métricas',
  '',
].join('\n');

describe('parseTasks', () => {
  it('lee ids, títulos, estados, opcionales, profundidad, padre y requisitos', () => {
    const { tasks, warnings } = parseTasks(DOC);
    expect(warnings).toEqual([]);
    expect(tasks.map((t) => [t.id, t.status, t.optional, t.depth, t.parentId])).toEqual([
      ['1', 'done', false, 0, undefined],
      ['2', 'todo', false, 0, undefined],
      ['2.1', 'todo', false, 1, '2'],
      ['2.2', 'todo', false, 1, '2'],
      ['3', 'todo', true, 0, undefined],
    ]);
    expect(tasks[0]).toMatchObject({ title: 'Modelo PaymentIntent', line: 5, requirements: ['1.1', '1.2'] });
    expect(tasks[3].requirements).toEqual(['2.3']);
  });

  it('acepta [-] y [X]', () => {
    const { tasks } = parseTasks('- [-] 1. a\n- [X] 2. b\n');
    expect(tasks.map((t) => t.status)).toEqual(['in_progress', 'done']);
  });

  it('avisa de casillas mal formadas e ids duplicados sin romper', () => {
    const { tasks, warnings } = parseTasks('- [ ] 1. ok\n- [?] 2. raro\n- [ ] sin número\n- [ ] 1. repetida\n');
    expect(tasks.map((t) => t.id)).toEqual(['1']);
    expect(warnings.map((w) => w.line)).toEqual([1, 2, 3]);
  });
});

describe('withTaskStatus', () => {
  it('cambia solo la casilla de la tarea y deja el resto idéntico', () => {
    const next = withTaskStatus(DOC, '2.1', 'in_progress');
    const before = DOC.split('\n');
    const after = next.split('\n');
    expect(after[8]).toBe('  - [-] 2.1 Validar carrito');
    expect(after[7]).toBe('- [-] 2. Endpoint POST /checkout');
    expect(after.filter((_, i) => i !== 7 && i !== 8)).toEqual(before.filter((_, i) => i !== 7 && i !== 8));
  });

  it('marca el padre hecho cuando todas sus subtareas obligatorias lo están', () => {
    const step1 = withTaskStatus(DOC, '2.1', 'done');
    expect(step1.split('\n')[7]).toBe('- [-] 2. Endpoint POST /checkout');
    const step2 = withTaskStatus(step1, '2.2', 'done');
    expect(step2.split('\n')[7]).toBe('- [x] 2. Endpoint POST /checkout');
  });

  it('el padre vuelve a pendiente si se reabren todas sus subtareas', () => {
    const done = withTaskStatus(withTaskStatus(DOC, '2.1', 'done'), '2.2', 'done');
    const reopened = withTaskStatus(withTaskStatus(done, '2.1', 'todo'), '2.2', 'todo');
    expect(reopened.split('\n')[7]).toBe('- [ ] 2. Endpoint POST /checkout');
  });

  it('preserva CRLF', () => {
    const crlf = DOC.replace(/\n/g, '\r\n');
    const next = withTaskStatus(crlf, '1', 'todo');
    expect(next).toBe(crlf.replace('- [x] 1. Modelo', '- [ ] 1. Modelo'));
    expect(next.split('\r\n').length).toBe(crlf.split('\r\n').length);
  });

  it('lanza TASK_NOT_FOUND si no existe', () => {
    expect(() => withTaskStatus(DOC, '9', 'done')).toThrowError(SpecError);
    try {
      withTaskStatus(DOC, '9', 'done');
    } catch (e) {
      expect((e as SpecError).code).toBe('TASK_NOT_FOUND');
    }
  });
});

describe('progress', () => {
  it('cuenta hojas obligatorias', () => {
    expect(progress(parseTasks(DOC).tasks)).toEqual({ done: 1, total: 3 });
  });
  it('documento vacío', () => {
    expect(progress(parseTasks('').tasks)).toEqual({ done: 0, total: 0 });
  });
});
```

- [ ] **Step 2: Ejecutar los tests para ver que fallan**

Run: `npx vitest run test/unit/specs/tasks.test.ts`
Expected: FAIL. El módulo `src/specs/tasks` no existe.

- [ ] **Step 3: Implementación**

`src/specs/tasks.ts`:

```ts
import { SpecError } from './errors';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  optional: boolean;
  line: number;
  depth: number;
  requirements: string[];
  parentId?: string;
}

export interface TaskWarning {
  line: number;
  message: string;
}

const TASK_RE = /^(\s*)- \[([ xX-])\](\*)? (\d+(?:\.\d+)*)\.?\s+(.*)$/;
const CHECKBOX_RE = /^\s*- \[[^\]]?\]/;
const REQUIREMENTS_RE = /_(?:Requisitos|Requirements):\s*([^_]+)_/;
const STATUS_FROM_MARK: Record<string, TaskStatus> = { ' ': 'todo', '-': 'in_progress', x: 'done', X: 'done' };
const MARK_FROM_STATUS: Record<TaskStatus, string> = { todo: ' ', in_progress: '-', done: 'x' };

/** Separa en [línea, salto, línea, salto, …] para poder reconstruir el texto exacto. */
function splitKeepingEol(text: string): string[] {
  return text.split(/(\r?\n)/);
}

export function parseTasks(text: string): { tasks: Task[]; warnings: TaskWarning[] } {
  const parts = splitKeepingEol(text);
  const tasks: Task[] = [];
  const warnings: TaskWarning[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < parts.length; i += 2) {
    const raw = parts[i];
    const line = i / 2;
    const match = TASK_RE.exec(raw);
    if (match) {
      const [, , mark, star, id, title] = match;
      if (seen.has(id)) {
        warnings.push({ line, message: `Id de tarea duplicado: ${id}` });
        continue;
      }
      seen.add(id);
      const parent = id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : undefined;
      tasks.push({
        id,
        title: title.trim(),
        status: STATUS_FROM_MARK[mark],
        optional: star === '*',
        line,
        depth: id.split('.').length - 1,
        requirements: [],
        parentId: parent !== undefined && seen.has(parent) ? parent : undefined,
      });
      continue;
    }
    if (CHECKBOX_RE.test(raw)) {
      warnings.push({ line, message: 'Línea de tarea no reconocida: se esperaba "- [ ] N. título".' });
      continue;
    }
    const reqs = REQUIREMENTS_RE.exec(raw);
    if (reqs && tasks.length > 0) {
      tasks[tasks.length - 1].requirements.push(
        ...reqs[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  return { tasks, warnings };
}

export function isLeaf(task: Task, tasks: Task[]): boolean {
  return !tasks.some((t) => t.parentId === task.id);
}

function parentStatus(children: TaskStatus[]): TaskStatus {
  if (children.every((s) => s === 'done')) return 'done';
  if (children.some((s) => s !== 'todo')) return 'in_progress';
  return 'todo';
}

export function withTaskStatus(text: string, taskId: string, status: TaskStatus): string {
  const parts = splitKeepingEol(text);
  const { tasks } = parseTasks(text);
  const target = tasks.find((t) => t.id === taskId);
  if (!target) throw new SpecError('TASK_NOT_FOUND', `No existe la tarea ${taskId} en tasks.md.`);

  const wanted = new Map<string, TaskStatus>(tasks.map((t) => [t.id, t.status]));
  wanted.set(taskId, status);

  let parentId = target.parentId;
  while (parentId !== undefined) {
    const required = tasks.filter((t) => t.parentId === parentId && !t.optional);
    if (required.length === 0) break;
    wanted.set(parentId, parentStatus(required.map((c) => wanted.get(c.id)!)));
    parentId = tasks.find((t) => t.id === parentId)!.parentId;
  }

  for (const task of tasks) {
    const next = wanted.get(task.id)!;
    if (next !== task.status) {
      parts[task.line * 2] = parts[task.line * 2].replace(/\[[ xX-]\]/, `[${MARK_FROM_STATUS[next]}]`);
    }
  }
  return parts.join('');
}

export function progress(tasks: Task[]): { done: number; total: number } {
  const counted = tasks.filter((t) => !t.optional && isLeaf(t, tasks));
  return { done: counted.filter((t) => t.status === 'done').length, total: counted.length };
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run test/unit/specs/tasks.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/specs/tasks.ts test/unit/specs/tasks.test.ts
git commit -m "feat(specs): parser de tasks.md, cambios de estado y progreso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dominio: fases, reglas de aprobación y búsqueda de requisitos

**Files:**
- Create: `src/specs/phase.ts`, `src/specs/requirements.ts`
- Test: `test/unit/specs/phase.test.ts`, `test/unit/specs/requirements.test.ts`

**Interfaces:**
- Consumes: `DocStatus` y `SpecError` (Tarea 3).
- Produces:
  - `type DocKind = 'requirements' | 'bugfix' | 'design' | 'tasks'`
  - `const ALL_DOC_KINDS: readonly DocKind[]`
  - `isDocKind(v: unknown): v is DocKind`
  - `type SpecType = 'feature' | 'bugfix'`
  - `type Phase = DocKind | 'implementation'`
  - `interface DocState { exists: boolean; status: DocStatus }`
  - `type DocStates = Partial<Record<DocKind, DocState>>`
  - `specType(states): SpecType`
  - `docOrder(type): DocKind[]`
  - `currentPhase(states): Phase`
  - `docsAfter(kind): DocKind[]`
  - `docFileName(kind): string`
  - `assertDocMatchesType(states, kind): void`
  - `assertCanApprove(states, kind): void`
  - `PHASE_LABELS: Record<Phase, string>`
  - `findRequirementLine(text: string, reqId: string): number | undefined`

- [ ] **Step 1: Escribir los tests que fallan**

`test/unit/specs/phase.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SpecError } from '../../../src/specs/errors';
import {
  assertCanApprove,
  assertDocMatchesType,
  currentPhase,
  docOrder,
  docsAfter,
  DocStates,
  specType,
} from '../../../src/specs/phase';

const draft = { exists: true, status: 'draft' as const };
const ok = { exists: true, status: 'approved' as const };

function code(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (e) {
    return (e as SpecError).code;
  }
}

describe('tipo y fase', () => {
  it('feature por defecto, bugfix si existe bugfix.md', () => {
    expect(specType({})).toBe('feature');
    expect(specType({ bugfix: draft })).toBe('bugfix');
    expect(docOrder('bugfix')).toEqual(['bugfix', 'design', 'tasks']);
  });
  it('la fase es el primer documento no aprobado', () => {
    expect(currentPhase({})).toBe('requirements');
    expect(currentPhase({ requirements: ok, design: draft })).toBe('design');
    expect(currentPhase({ requirements: ok, design: ok })).toBe('tasks');
    expect(currentPhase({ requirements: ok, design: ok, tasks: ok })).toBe('implementation');
    expect(currentPhase({ bugfix: ok })).toBe('design');
  });
  it('docsAfter', () => {
    expect(docsAfter('requirements')).toEqual(['design', 'tasks']);
    expect(docsAfter('bugfix')).toEqual(['design', 'tasks']);
    expect(docsAfter('design')).toEqual(['tasks']);
    expect(docsAfter('tasks')).toEqual([]);
  });
});

describe('reglas', () => {
  it('no se mezcla requirements con bugfix', () => {
    expect(code(() => assertDocMatchesType({ requirements: draft }, 'bugfix'))).toBe('TYPE_MISMATCH');
    expect(code(() => assertDocMatchesType({ bugfix: draft }, 'requirements'))).toBe('TYPE_MISMATCH');
    expect(code(() => assertDocMatchesType({}, 'bugfix'))).toBeUndefined();
  });
  it('no se aprueba un documento que no existe', () => {
    expect(code(() => assertCanApprove({}, 'requirements'))).toBe('DOC_MISSING');
  });
  it('no se aprueba si falta aprobar uno anterior', () => {
    const states: DocStates = { requirements: draft, design: draft };
    expect(code(() => assertCanApprove(states, 'design'))).toBe('PREVIOUS_NOT_APPROVED');
    expect(code(() => assertCanApprove(states, 'requirements'))).toBeUndefined();
  });
  it('aprobar bugfix en un spec feature es TYPE_MISMATCH', () => {
    expect(code(() => assertCanApprove({ requirements: ok, bugfix: draft }, 'bugfix'))).toBe('TYPE_MISMATCH');
  });
});
```

`test/unit/specs/requirements.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findRequirementLine } from '../../../src/specs/requirements';

const DOC = [
  '# Requisitos — export-csv', // 0
  '## Requisitos', // 1
  '### Requisito 1: Exportar', // 2
  '**Historia:** …', // 3
  '#### Criterios de aceptación', // 4
  '1. WHEN a THE SYSTEM SHALL b.', // 5
  '2. IF c THEN THE SYSTEM SHALL d.', // 6
  '### Requisito 2: Seguridad', // 7
  '#### Criterios de aceptación', // 8
  '1. THE SYSTEM SHALL NOT e.', // 9
].join('\n');

describe('findRequirementLine', () => {
  it('encuentra el criterio N.M', () => {
    expect(findRequirementLine(DOC, '1.2')).toBe(6);
    expect(findRequirementLine(DOC, '2.1')).toBe(9);
  });
  it('sin criterio devuelve el encabezado', () => {
    expect(findRequirementLine(DOC, '2')).toBe(7);
  });
  it('criterio inexistente devuelve el encabezado del requisito', () => {
    expect(findRequirementLine(DOC, '1.9')).toBe(2);
  });
  it('requisito inexistente devuelve undefined', () => {
    expect(findRequirementLine(DOC, '7.1')).toBeUndefined();
  });
  it('entiende encabezados en inglés', () => {
    expect(findRequirementLine('### Requirement 3: X\n1. a\n', '3.1')).toBe(1);
  });
});
```

- [ ] **Step 2: Ejecutar los tests para ver que fallan**

Run: `npx vitest run test/unit/specs/phase.test.ts test/unit/specs/requirements.test.ts`
Expected: FAIL. Los módulos no existen.

- [ ] **Step 3: Implementación**

`src/specs/phase.ts`:

```ts
import { SpecError } from './errors';
import { DocStatus } from './frontMatter';

export type DocKind = 'requirements' | 'bugfix' | 'design' | 'tasks';
export const ALL_DOC_KINDS: readonly DocKind[] = ['requirements', 'bugfix', 'design', 'tasks'];
export type SpecType = 'feature' | 'bugfix';
export type Phase = DocKind | 'implementation';

export interface DocState {
  exists: boolean;
  status: DocStatus;
}
export type DocStates = Partial<Record<DocKind, DocState>>;

export const PHASE_LABELS: Record<Phase, string> = {
  requirements: 'Requisitos',
  bugfix: 'Bug',
  design: 'Diseño',
  tasks: 'Tareas',
  implementation: 'Implementación',
};

export function isDocKind(value: unknown): value is DocKind {
  return typeof value === 'string' && (ALL_DOC_KINDS as readonly string[]).includes(value);
}

function exists(states: DocStates, kind: DocKind): boolean {
  return states[kind]?.exists === true;
}

function approved(states: DocStates, kind: DocKind): boolean {
  return exists(states, kind) && states[kind]!.status === 'approved';
}

export function specType(states: DocStates): SpecType {
  return exists(states, 'bugfix') ? 'bugfix' : 'feature';
}

export function docOrder(type: SpecType): DocKind[] {
  return [type === 'bugfix' ? 'bugfix' : 'requirements', 'design', 'tasks'];
}

export function currentPhase(states: DocStates): Phase {
  for (const kind of docOrder(specType(states))) {
    if (!approved(states, kind)) return kind;
  }
  return 'implementation';
}

export function docsAfter(kind: DocKind): DocKind[] {
  if (kind === 'requirements' || kind === 'bugfix') return ['design', 'tasks'];
  if (kind === 'design') return ['tasks'];
  return [];
}

export function docFileName(kind: DocKind): string {
  return `${kind}.md`;
}

export function assertDocMatchesType(states: DocStates, kind: DocKind): void {
  if (kind === 'bugfix' && exists(states, 'requirements')) {
    throw new SpecError('TYPE_MISMATCH', 'Este spec es de feature (tiene requirements.md); no puede llevar bugfix.md.');
  }
  if (kind === 'requirements' && exists(states, 'bugfix')) {
    throw new SpecError('TYPE_MISMATCH', 'Este spec es de bugfix (tiene bugfix.md); no puede llevar requirements.md.');
  }
}

export function assertCanApprove(states: DocStates, kind: DocKind): void {
  const order = docOrder(specType(states));
  const index = order.indexOf(kind);
  if (index < 0) {
    throw new SpecError('TYPE_MISMATCH', `${docFileName(kind)} no corresponde al tipo de este spec.`);
  }
  if (!exists(states, kind)) {
    throw new SpecError('DOC_MISSING', `No existe ${docFileName(kind)}: escríbelo antes de aprobarlo.`);
  }
  const pending = order.slice(0, index).filter((k) => !approved(states, k));
  if (pending.length > 0) {
    throw new SpecError('PREVIOUS_NOT_APPROVED', `Antes aprueba: ${pending.map(docFileName).join(', ')}.`);
  }
}
```

`src/specs/requirements.ts`:

```ts
const REQUIREMENT_HEADING_RE = /^#{2,4}\s+(?:Requisito|Requirement)\s+(\d+)\b/i;
const CRITERION_RE = /^\s*(\d+)\.\s/;
const SECTION_END_RE = /^#{1,3}\s/;

/** Línea (base 0) del criterio "N.M" o del encabezado "Requisito N". */
export function findRequirementLine(text: string, reqId: string): number | undefined {
  const [major, minor] = reqId.split('.');
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => REQUIREMENT_HEADING_RE.exec(line)?.[1] === major);
  if (start < 0) return undefined;
  if (minor === undefined) return start;
  for (let i = start + 1; i < lines.length; i++) {
    if (SECTION_END_RE.test(lines[i])) break;
    if (CRITERION_RE.exec(lines[i])?.[1] === minor) return i;
  }
  return start;
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run && npm run lint`
Expected: PASS. Pasan todos los tests unitarios.

- [ ] **Step 5: Commit**

```bash
git add src/specs test/unit/specs
git commit -m "feat(specs): fases, reglas de aprobación y búsqueda de requisitos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Workspace: resolver la carpeta, editar archivos y SpecStore

**Files:**
- Create: `src/workspace/resolve.ts`, `src/workspace/edits.ts`, `src/workspace/specStore.ts`
- Modify: `src/extension.ts` (sustituirlo completo)
- Create: los fixtures en `test/fixtures/pristine/` (listados en el Step 4)
- Test: `test/unit/workspace/resolve.test.ts`, `test/integration/helpers.ts`, `test/integration/store.test.ts`

**Interfaces:**
- Consumes: todo `src/specs/*`.
- Produces:
  - `resolveSpecFolder(folders: { name: string; hasSpec: boolean }[], spec: string, requested: string | undefined, mustExist: boolean): { ok: true; folder: string } | { ok: false; message: string }`
  - `transformFile(uri: vscode.Uri, fn: (current: string | undefined) => string): Promise<void>`
  - `class SpecStore`, con estos miembros:
    - `onDidChange: vscode.Event<void>`
    - `specsFolder: string`
    - `folders(): readonly vscode.WorkspaceFolder[]`
    - `folderByName(name: string): vscode.WorkspaceFolder | undefined`
    - `dirUri(folder, name): vscode.Uri`
    - `docUri(folder, name, kind): vscode.Uri`
    - `relPath(name, kind): string`
    - `readText(uri): Promise<string | undefined>`
    - `snapshot(folder, name): Promise<SpecSnapshot>`
    - `specExists(folder, name): Promise<boolean>`
    - `list(folder): Promise<SpecSnapshot[]>`
    - `resolveFolder(spec, requested: string | undefined, mustExist: boolean): Promise<vscode.WorkspaceFolder>`
    - `locate(uri): { folder: vscode.WorkspaceFolder; name: string; kind: DocKind } | undefined`
    - `listSteering(folder): Promise<SteeringDoc[]>`
    - `refresh(): void`
    - `dispose(): void`
  - `interface SpecDocInfo { kind: DocKind; uri: vscode.Uri; exists: boolean; status: DocStatus }`
  - `interface SpecSnapshot { folder: vscode.WorkspaceFolder; name: string; dirUri: vscode.Uri; type: SpecType; phase: Phase; docs: SpecDocInfo[]; states: DocStates; progress: { done: number; total: number } }`
  - `interface SteeringDoc { uri: vscode.Uri; label: string; applyTo?: string }`
  - `interface SddStudioApi { store: SpecStore }`, que crece en las Tareas 7 a 10.

- [ ] **Step 1: Escribir el test unitario de `resolveSpecFolder`, que debe fallar**

`test/unit/workspace/resolve.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveSpecFolder } from '../../../src/workspace/resolve';

const a = { name: 'api', hasSpec: false };
const b = { name: 'web', hasSpec: false };

describe('resolveSpecFolder', () => {
  it('sin carpetas: error', () => {
    expect(resolveSpecFolder([], 'x', undefined, false)).toMatchObject({ ok: false });
  });
  it('una carpeta: esa', () => {
    expect(resolveSpecFolder([a], 'x', undefined, false)).toEqual({ ok: true, folder: 'api' });
  });
  it('folder pedido inexistente: error que lista carpetas', () => {
    const r = resolveSpecFolder([a, b], 'x', 'mobile', false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('api, web');
  });
  it('mismo spec en dos carpetas sin folder: error que nombra ambas', () => {
    const r = resolveSpecFolder([{ ...a, hasSpec: true }, { ...b, hasSpec: true }], 'export-csv', undefined, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/export-csv.*api, web.*folder/);
  });
  it('spec en una sola carpeta: esa', () => {
    expect(resolveSpecFolder([a, { ...b, hasSpec: true }], 'x', undefined, true)).toEqual({ ok: true, folder: 'web' });
  });
  it('spec nuevo en multi-root sin folder: error', () => {
    expect(resolveSpecFolder([a, b], 'x', undefined, false).ok).toBe(false);
  });
  it('mustExist y no existe: error', () => {
    expect(resolveSpecFolder([a], 'x', undefined, true).ok).toBe(false);
    expect(resolveSpecFolder([a], 'x', 'api', true).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar el test para ver que falla**

Run: `npx vitest run test/unit/workspace`
Expected: FAIL. El módulo no existe.

- [ ] **Step 3: Implementar `resolve.ts`, `edits.ts`, `specStore.ts` y `extension.ts`**

`src/workspace/resolve.ts`:

```ts
export interface FolderCandidate {
  name: string;
  hasSpec: boolean;
}

export type FolderResolution = { ok: true; folder: string } | { ok: false; message: string };

export function resolveSpecFolder(
  folders: FolderCandidate[],
  spec: string,
  requested: string | undefined,
  mustExist: boolean,
): FolderResolution {
  const names = folders.map((f) => f.name).join(', ');
  if (folders.length === 0) return { ok: false, message: 'No hay ninguna carpeta abierta en VS Code.' };

  if (requested !== undefined) {
    const found = folders.find((f) => f.name === requested);
    if (!found) return { ok: false, message: `No existe la carpeta "${requested}". Carpetas: ${names}.` };
    if (mustExist && !found.hasSpec) return { ok: false, message: `No existe el spec "${spec}" en "${requested}".` };
    return { ok: true, folder: found.name };
  }

  const withSpec = folders.filter((f) => f.hasSpec);
  if (withSpec.length === 1) return { ok: true, folder: withSpec[0].name };
  if (withSpec.length > 1) {
    return {
      ok: false,
      message: `El spec "${spec}" existe en varias carpetas (${withSpec.map((f) => f.name).join(', ')}): indica folder.`,
    };
  }
  if (mustExist) return { ok: false, message: `No encontré el spec "${spec}".` };
  if (folders.length === 1) return { ok: true, folder: folders[0].name };
  return { ok: false, message: `Hay varias carpetas abiertas (${names}): indica folder para crear "${spec}".` };
}
```

`src/workspace/edits.ts`:

```ts
import * as vscode from 'vscode';

/**
 * Aplica fn al texto actual del archivo.
 * - Si está abierto en VS Code: edita el buffer (respeta deshacer). Solo guarda si no tenía cambios sin guardar.
 * - Si no: lee y escribe en disco (crea carpetas si hace falta).
 */
export async function transformFile(uri: vscode.Uri, fn: (current: string | undefined) => string): Promise<void> {
  const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
  if (open) {
    const wasDirty = open.isDirty;
    const current = open.getText();
    const next = fn(current);
    if (next === current) return;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(open.positionAt(0), open.positionAt(current.length)), next);
    if (!(await vscode.workspace.applyEdit(edit))) throw new Error(`No se pudo editar ${uri.fsPath}`);
    if (!wasDirty) await open.save();
    return;
  }

  let current: string | undefined;
  try {
    current = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    current = undefined;
  }
  const next = fn(current);
  if (next === current) return;
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(next));
}
```

`src/workspace/specStore.ts`:

```ts
import * as path from 'path';
import * as vscode from 'vscode';
import { SpecError } from '../specs/errors';
import { DocStatus, frontMatterFields, readFrontMatter } from '../specs/frontMatter';
import { isValidSpecName } from '../specs/names';
import {
  ALL_DOC_KINDS,
  currentPhase,
  DocKind,
  docFileName,
  docOrder,
  DocStates,
  isDocKind,
  Phase,
  specType,
  SpecType,
} from '../specs/phase';
import { parseTasks, progress } from '../specs/tasks';
import { resolveSpecFolder } from './resolve';

export interface SpecDocInfo {
  kind: DocKind;
  uri: vscode.Uri;
  exists: boolean;
  status: DocStatus;
}

export interface SpecSnapshot {
  folder: vscode.WorkspaceFolder;
  name: string;
  dirUri: vscode.Uri;
  type: SpecType;
  phase: Phase;
  docs: SpecDocInfo[];
  states: DocStates;
  progress: { done: number; total: number };
}

export interface SteeringDoc {
  uri: vscode.Uri;
  label: string;
  applyTo?: string;
}

const STEERING_DIR = ['.github', 'instructions'];
const STEERING_SUFFIX = '.instructions.md';

export class SpecStore implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private watchers: vscode.Disposable[] = [];
  private readonly subscriptions: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.createWatchers();
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (this.isTracked(e.document.uri)) this.scheduleFire();
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.createWatchers();
        this.scheduleFire();
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('sddStudio.specsFolder')) {
          this.createWatchers();
          this.scheduleFire();
        }
      }),
    );
  }

  get specsFolder(): string {
    return vscode.workspace.getConfiguration('sddStudio').get<string>('specsFolder', 'specs').replace(/^\/+|\/+$/g, '');
  }

  folders(): readonly vscode.WorkspaceFolder[] {
    return vscode.workspace.workspaceFolders ?? [];
  }

  folderByName(name: string): vscode.WorkspaceFolder | undefined {
    return this.folders().find((f) => f.name === name);
  }

  refresh(): void {
    this.emitter.fire();
  }

  dirUri(folder: vscode.WorkspaceFolder, name: string): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, ...this.specsFolder.split('/'), name);
  }

  docUri(folder: vscode.WorkspaceFolder, name: string, kind: DocKind): vscode.Uri {
    return vscode.Uri.joinPath(this.dirUri(folder, name), docFileName(kind));
  }

  relPath(name: string, kind: DocKind): string {
    return `${this.specsFolder}/${name}/${docFileName(kind)}`;
  }

  /** Texto actual: el buffer si tiene cambios sin guardar; si no, el disco. */
  async readText(uri: vscode.Uri): Promise<string | undefined> {
    const dirty = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString() && d.isDirty);
    if (dirty) return dirty.getText();
    try {
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    } catch {
      return undefined;
    }
  }

  async snapshot(folder: vscode.WorkspaceFolder, name: string): Promise<SpecSnapshot> {
    const states: DocStates = {};
    let tasksText: string | undefined;
    for (const kind of ALL_DOC_KINDS) {
      const text = await this.readText(this.docUri(folder, name, kind));
      states[kind] = { exists: text !== undefined, status: text === undefined ? 'draft' : readFrontMatter(text).status };
      if (kind === 'tasks') tasksText = text;
    }
    const type = specType(states);
    return {
      folder,
      name,
      dirUri: this.dirUri(folder, name),
      type,
      phase: currentPhase(states),
      docs: docOrder(type).map((kind) => ({
        kind,
        uri: this.docUri(folder, name, kind),
        exists: states[kind]!.exists,
        status: states[kind]!.status,
      })),
      states,
      progress: tasksText === undefined ? { done: 0, total: 0 } : progress(parseTasks(tasksText).tasks),
    };
  }

  async specExists(folder: vscode.WorkspaceFolder, name: string): Promise<boolean> {
    const snap = await this.snapshot(folder, name);
    return ALL_DOC_KINDS.some((k) => snap.states[k]?.exists);
  }

  async list(folder: vscode.WorkspaceFolder): Promise<SpecSnapshot[]> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.joinPath(folder.uri, ...this.specsFolder.split('/')));
    } catch {
      return [];
    }
    const names = entries
      .filter(([n, t]) => t === vscode.FileType.Directory && isValidSpecName(n))
      .map(([n]) => n)
      .sort();
    const snaps = await Promise.all(names.map((n) => this.snapshot(folder, n)));
    return snaps.filter((s) => ALL_DOC_KINDS.some((k) => s.states[k]?.exists));
  }

  async resolveFolder(spec: string, requested: string | undefined, mustExist: boolean): Promise<vscode.WorkspaceFolder> {
    const folders = this.folders();
    const candidates = await Promise.all(folders.map(async (f) => ({ name: f.name, hasSpec: await this.specExists(f, spec) })));
    const result = resolveSpecFolder(candidates, spec, requested, mustExist);
    if (!result.ok) throw new SpecError('FOLDER', result.message);
    return folders.find((f) => f.name === result.folder)!;
  }

  locate(uri: vscode.Uri): { folder: vscode.WorkspaceFolder; name: string; kind: DocKind } | undefined {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return undefined;
    const rel = path.posix.relative(folder.uri.path, uri.path);
    const prefix = `${this.specsFolder}/`;
    if (!rel.startsWith(prefix)) return undefined;
    const parts = rel.slice(prefix.length).split('/');
    if (parts.length !== 2 || !parts[1].endsWith('.md')) return undefined;
    const kind = parts[1].slice(0, -'.md'.length);
    if (!isValidSpecName(parts[0]) || !isDocKind(kind)) return undefined;
    return { folder, name: parts[0], kind };
  }

  async listSteering(folder: vscode.WorkspaceFolder): Promise<SteeringDoc[]> {
    const dir = vscode.Uri.joinPath(folder.uri, ...STEERING_DIR);
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
      return [];
    }
    const files = entries.filter(([n, t]) => t === vscode.FileType.File && n.endsWith(STEERING_SUFFIX)).map(([n]) => n).sort();
    return Promise.all(
      files.map(async (file) => {
        const uri = vscode.Uri.joinPath(dir, file);
        const applyTo = frontMatterFields((await this.readText(uri)) ?? '').get('applyTo')?.replace(/^["']|["']$/g, '');
        return { uri, label: file.slice(0, -STEERING_SUFFIX.length), applyTo };
      }),
    );
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.watchers.forEach((w) => w.dispose());
    this.subscriptions.forEach((s) => s.dispose());
    this.emitter.dispose();
  }

  private isTracked(uri: vscode.Uri): boolean {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) return false;
    const rel = path.posix.relative(folder.uri.path, uri.path);
    return rel.startsWith(`${this.specsFolder}/`) || rel.startsWith(`${STEERING_DIR.join('/')}/`);
  }

  private scheduleFire(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.emitter.fire(), 150);
  }

  private createWatchers(): void {
    this.watchers.forEach((w) => w.dispose());
    this.watchers = [`**/${this.specsFolder}/**/*.md`, `**/${STEERING_DIR.join('/')}/*.md`].map((pattern) => {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      watcher.onDidCreate(() => this.scheduleFire());
      watcher.onDidChange(() => this.scheduleFire());
      watcher.onDidDelete(() => this.scheduleFire());
      return watcher;
    });
  }
}
```

`src/extension.ts` (sustitución completa):

```ts
import * as vscode from 'vscode';
import { SpecStore } from './workspace/specStore';

export interface SddStudioApi {
  store: SpecStore;
}

export function activate(context: vscode.ExtensionContext): SddStudioApi {
  const store = new SpecStore();
  context.subscriptions.push(store);
  return { store };
}

export function deactivate(): void {}
```

- [ ] **Step 4: Crear los fixtures**

`test/fixtures/pristine/specs/pagos-checkout/requirements.md`:

```markdown
---
status: approved
approvedAt: 2026-09-30T10:00:00.000Z
---
# Requisitos — pagos-checkout

## Requisitos

### Requisito 1: Intención de pago
**Historia:** Como cliente, quiero pagar mi carrito, para completar la compra.
#### Criterios de aceptación
1. WHEN el cliente confirma el pago THE SYSTEM SHALL crear un PaymentIntent.
2. THE SYSTEM SHALL guardar el PaymentIntent con estado "pendiente".

### Requisito 2: Validación
**Historia:** Como negocio, quiero validar montos, para evitar cobros erróneos.
#### Criterios de aceptación
1. IF el carrito está vacío THEN THE SYSTEM SHALL responder 400.
2. IF el monto no coincide con la suma del carrito THEN THE SYSTEM SHALL responder 422.
3. WHEN llega un reintento con la misma Idempotency-Key THE SYSTEM SHALL devolver la respuesta original.
```

`test/fixtures/pristine/specs/pagos-checkout/design.md`:

```markdown
---
status: approved
approvedAt: 2026-09-30T11:00:00.000Z
---
# Diseño — pagos-checkout

## Resumen
Endpoint POST /checkout que valida el carrito y crea un PaymentIntent.
```

`test/fixtures/pristine/specs/pagos-checkout/tasks.md`:

```markdown
---
status: approved
approvedAt: 2026-09-30T12:00:00.000Z
---
# Plan de implementación — pagos-checkout

- [x] 1. Modelo PaymentIntent y repositorio
  - _Requisitos: 1.1, 1.2_
- [ ] 2. Endpoint POST /checkout
  - [ ] 2.1 Validar carrito y montos
    - _Requisitos: 2.1, 2.2_
  - [ ] 2.2 Idempotency-Key en reintentos
    - _Requisitos: 2.3_
- [ ]* 3. Métricas de conversión
```

`test/fixtures/pristine/specs/export-csv/requirements.md`:

```markdown
---
status: draft
---
# Requisitos — export-csv

## Requisitos

### Requisito 1: Exportar pedidos
**Historia:** Como admin, quiero exportar pedidos a CSV, para analizarlos.
#### Criterios de aceptación
1. WHEN el admin pulsa "Exportar" THE SYSTEM SHALL generar un CSV con los filtros activos.
```

`test/fixtures/pristine/.github/instructions/product.instructions.md`:

```markdown
---
applyTo: "**"
description: Producto
---
# Producto
Tienda online de prueba.
```

- [ ] **Step 5: Escribir los helpers y el test de integración, que debe fallar**

`test/integration/helpers.ts`:

```ts
import * as path from 'path';
import * as vscode from 'vscode';
import type { SddStudioApi } from '../../src/extension';

export const PRISTINE = path.resolve(__dirname, '../../../test/fixtures/pristine');

export function ws(): vscode.WorkspaceFolder {
  return vscode.workspace.workspaceFolders![0];
}

export function wsUri(rel: string): vscode.Uri {
  return vscode.Uri.joinPath(ws().uri, ...rel.split('/'));
}

export async function readWs(rel: string): Promise<string> {
  return new TextDecoder().decode(await vscode.workspace.fs.readFile(wsUri(rel)));
}

export async function writeWs(rel: string, text: string): Promise<void> {
  await vscode.workspace.fs.writeFile(wsUri(rel), new TextEncoder().encode(text));
}

export async function getApi(): Promise<SddStudioApi> {
  const ext = vscode.extensions.getExtension<SddStudioApi>('enriqueacordero.sdd-studio')!;
  return ext.activate();
}

/** Restaura specs/ y .github/ desde pristine y espera a que los documentos abiertos se sincronicen con el disco. */
export async function restoreFixture(): Promise<void> {
  for (const dir of ['specs', '.github']) {
    try {
      await vscode.workspace.fs.delete(wsUri(dir), { recursive: true });
    } catch {
      // no existía
    }
    await vscode.workspace.fs.copy(vscode.Uri.file(path.join(PRISTINE, dir)), wsUri(dir), { overwrite: true });
  }
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    let stale = false;
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme !== 'file' || doc.isDirty) continue;
      try {
        const disk = new TextDecoder().decode(await vscode.workspace.fs.readFile(doc.uri));
        if (disk !== doc.getText()) stale = true;
      } catch {
        // borrado
      }
    }
    if (!stale) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}
```

`test/integration/store.test.ts`:

```ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { getApi, restoreFixture, ws, wsUri } from './helpers';

describe('SpecStore', () => {
  beforeEach(restoreFixture);

  it('lista los specs con tipo, fase y progreso', async () => {
    const { store } = await getApi();
    const specs = await store.list(ws());
    assert.deepStrictEqual(
      specs.map((s) => [s.name, s.type, s.phase, s.progress.done, s.progress.total]),
      [
        ['export-csv', 'feature', 'requirements', 0, 0],
        ['pagos-checkout', 'feature', 'implementation', 1, 3],
      ],
    );
  });

  it('locate reconoce documentos de spec y rechaza otros', async () => {
    const { store } = await getApi();
    assert.deepStrictEqual(
      { ...store.locate(wsUri('specs/pagos-checkout/tasks.md'))!, folder: undefined },
      { folder: undefined, name: 'pagos-checkout', kind: 'tasks' },
    );
    assert.strictEqual(store.locate(wsUri('specs/pagos-checkout/notas.md')), undefined);
    assert.strictEqual(store.locate(wsUri('README.md')), undefined);
  });

  it('lista el steering con su applyTo', async () => {
    const { store } = await getApi();
    const steering = await store.listSteering(ws());
    assert.deepStrictEqual(steering.map((s) => [s.label, s.applyTo]), [['product', '**']]);
  });

  it('readText prefiere el buffer con cambios sin guardar', async () => {
    const { store } = await getApi();
    const uri = wsUri('specs/export-csv/requirements.md');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((e) => e.insert(new vscode.Position(doc.lineCount, 0), 'EXTRA\n'));
    assert.ok((await store.readText(uri))!.includes('EXTRA'));
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });
});
```

- [ ] **Step 6: Ejecutar todos los tests y comprobar que pasan**

Run: `npx vitest run && npm run test:integration`
Expected: PASS. Pasan los tests unitarios (incluido `resolveSpecFolder`) y la integración da `5 passing`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(workspace): SpecStore, edición segura de archivos y resolución multi-root

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: SpecService y herramientas `sdd_*` para Copilot

**Files:**
- Create: `src/workspace/specService.ts`, `src/tools/registerTools.ts`
- Modify: `src/extension.ts` (sustituirlo completo)
- Modify: `package.json`: añadir `contributes.languageModelTools`
- Test: `test/integration/service.test.ts`

**Interfaces:**
- Consumes: `SpecStore`, `transformFile` (Tarea 6) y todo `src/specs/*`.
- Produces:
  - `interface WriteSpecDocInput { folder?: string; spec: string; doc: DocKind; content: string }`
  - `interface ApprovePhaseInput { folder?: string; spec: string; doc: DocKind }`
  - `interface SetTaskStatusInput { folder?: string; spec: string; taskId: string; status: TaskStatus }`
  - `class SpecService { constructor(store: SpecStore, now?: () => Date) }`, con estos métodos:
    - `writeSpecDoc(i: WriteSpecDocInput): Promise<string>`
    - `approvePhase(i: ApprovePhaseInput): Promise<string>`
    - `setTaskStatus(i: SetTaskStatusInput): Promise<string>`
  - `interface ToolHandlers { writeSpecDoc(input: unknown): Promise<string>; approvePhase(input: unknown): Promise<string>; setTaskStatus(input: unknown): Promise<string> }`. Cada handler devuelve el mensaje, o `ERROR (<code>): <mensaje>` si ocurre un `SpecError`.
  - `createToolHandlers(service: SpecService): ToolHandlers`
  - `registerTools(h: ToolHandlers): vscode.Disposable`
  - `SddStudioApi` pasa a ser `{ store; service; tools }`.

- [ ] **Step 1: Escribir el test de integración, que debe fallar**

`test/integration/service.test.ts`:

```ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { getApi, readWs, restoreFixture, wsUri } from './helpers';

describe('SpecService + herramientas', () => {
  beforeEach(restoreFixture);

  it('writeSpecDoc crea un documento en borrador con un único front matter', async () => {
    const { tools } = await getApi();
    const msg = await tools.writeSpecDoc({
      spec: 'login-sso',
      doc: 'requirements',
      content: '```markdown\n---\nstatus: approved\n---\n# Requisitos — login-sso\n```',
    });
    assert.match(msg, /specs\/login-sso\/requirements\.md/);
    assert.strictEqual(await readWs('specs/login-sso/requirements.md'), '---\nstatus: draft\n---\n# Requisitos — login-sso\n');
  });

  it('reescribir requisitos aprobados devuelve a borrador diseño y tareas', async () => {
    const { tools } = await getApi();
    const msg = await tools.writeSpecDoc({ spec: 'pagos-checkout', doc: 'requirements', content: '# Nuevo\n' });
    assert.match(msg, /design\.md, tasks\.md/);
    assert.match(await readWs('specs/pagos-checkout/design.md'), /status: draft/);
    assert.doesNotMatch(await readWs('specs/pagos-checkout/design.md'), /approvedAt/);
    assert.match(await readWs('specs/pagos-checkout/tasks.md'), /status: draft/);
  });

  it('approvePhase aprueba y respeta el orden', async () => {
    const { tools } = await getApi();
    assert.match(await tools.approvePhase({ spec: 'export-csv', doc: 'design' }), /^ERROR \(DOC_MISSING\)/);
    assert.match(await tools.approvePhase({ spec: 'export-csv', doc: 'requirements' }), /Aprobado/);
    assert.match(await readWs('specs/export-csv/requirements.md'), /status: approved\napprovedAt: \d{4}-/);
  });

  it('setTaskStatus cambia la tarea y su padre', async () => {
    const { tools } = await getApi();
    await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '2.1', status: 'done' });
    await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '2.2', status: 'done' });
    const text = await readWs('specs/pagos-checkout/tasks.md');
    assert.match(text, /- \[x\] 2\. Endpoint/);
    assert.match(text, /- \[x\] 2\.1 Validar/);
  });

  it('setTaskStatus falla si las tareas no están aprobadas o la tarea no existe', async () => {
    const { tools } = await getApi();
    assert.match(await tools.setTaskStatus({ spec: 'export-csv', taskId: '1', status: 'done' }), /^ERROR \(NOT_READY\)/);
    assert.match(await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '9', status: 'done' }), /^ERROR \(TASK_NOT_FOUND\)/);
  });

  it('valida entradas', async () => {
    const { tools } = await getApi();
    assert.match(await tools.writeSpecDoc({ spec: 'Mal Nombre', doc: 'design', content: 'x' }), /^ERROR \(INVALID_NAME\)/);
    assert.match(await tools.writeSpecDoc({ spec: 'ok', doc: 'notas', content: 'x' }), /^ERROR \(INVALID_INPUT\)/);
    assert.match(await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '1', status: 'hecho' }), /^ERROR \(INVALID_INPUT\)/);
    assert.match(await tools.writeSpecDoc({ spec: 'export-csv', doc: 'bugfix', content: 'x' }), /^ERROR \(TYPE_MISMATCH\)/);
  });

  it('respeta un buffer sucio: edita el buffer, no guarda, no pierde lo escrito', async () => {
    const { tools } = await getApi();
    const uri = wsUri('specs/pagos-checkout/tasks.md');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((e) => e.insert(new vscode.Position(doc.lineCount - 1, 0), '<!-- nota del usuario -->\n'));
    const onDisk = await readWs('specs/pagos-checkout/tasks.md');

    await tools.setTaskStatus({ spec: 'pagos-checkout', taskId: '2.1', status: 'in_progress' });

    assert.strictEqual(doc.isDirty, true);
    assert.match(doc.getText(), /<!-- nota del usuario -->/);
    assert.match(doc.getText(), /- \[-\] 2\.1 Validar/);
    assert.strictEqual(await readWs('specs/pagos-checkout/tasks.md'), onDisk);
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });
});
```

- [ ] **Step 2: Ejecutar el test para ver que falla**

Run: `npm run test:integration`
Expected: FAIL. `tools` es `undefined` en la API.

- [ ] **Step 3: Implementar el servicio y las herramientas**

`src/workspace/specService.ts`:

```ts
import { SpecError } from '../specs/errors';
import { prepareSpecDocContent, setFrontMatterFields } from '../specs/frontMatter';
import { isValidSpecName } from '../specs/names';
import { assertCanApprove, assertDocMatchesType, DocKind, docFileName, docsAfter, PHASE_LABELS } from '../specs/phase';
import { TaskStatus, withTaskStatus } from '../specs/tasks';
import { transformFile } from './edits';
import { SpecStore } from './specStore';

export interface WriteSpecDocInput {
  folder?: string;
  spec: string;
  doc: DocKind;
  content: string;
}
export interface ApprovePhaseInput {
  folder?: string;
  spec: string;
  doc: DocKind;
}
export interface SetTaskStatusInput {
  folder?: string;
  spec: string;
  taskId: string;
  status: TaskStatus;
}

const STATUS_LABELS: Record<TaskStatus, string> = { todo: 'pendiente', in_progress: 'en curso', done: 'hecha' };

function assertName(spec: string): void {
  if (!isValidSpecName(spec)) {
    throw new SpecError('INVALID_NAME', `Nombre de spec inválido "${spec}": usa minúsculas, números y guiones (ej. export-csv).`);
  }
}

export class SpecService {
  constructor(
    private readonly store: SpecStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async writeSpecDoc(input: WriteSpecDocInput): Promise<string> {
    assertName(input.spec);
    const folder = await this.store.resolveFolder(input.spec, input.folder, false);
    const snap = await this.store.snapshot(folder, input.spec);
    assertDocMatchesType(snap.states, input.doc);

    const text = setFrontMatterFields(prepareSpecDocContent(input.content), { status: 'draft', approvedAt: undefined });
    await transformFile(this.store.docUri(folder, input.spec, input.doc), () => text);

    const redrafted: DocKind[] = [];
    for (const kind of docsAfter(input.doc)) {
      const state = snap.states[kind];
      if (state?.exists && state.status === 'approved') {
        await transformFile(this.store.docUri(folder, input.spec, kind), (t) =>
          setFrontMatterFields(t ?? '', { status: 'draft', approvedAt: undefined }),
        );
        redrafted.push(kind);
      }
    }
    const extra = redrafted.length ? ` Volvieron a borrador: ${redrafted.map(docFileName).join(', ')}.` : '';
    return `Escribí ${this.store.relPath(input.spec, input.doc)} (borrador).${extra}`;
  }

  async approvePhase(input: ApprovePhaseInput): Promise<string> {
    assertName(input.spec);
    const folder = await this.store.resolveFolder(input.spec, input.folder, true);
    assertCanApprove((await this.store.snapshot(folder, input.spec)).states, input.doc);
    await transformFile(this.store.docUri(folder, input.spec, input.doc), (t) =>
      setFrontMatterFields(t ?? '', { status: 'approved', approvedAt: this.now().toISOString() }),
    );
    const after = await this.store.snapshot(folder, input.spec);
    return `Aprobado ${this.store.relPath(input.spec, input.doc)}. Fase actual: ${PHASE_LABELS[after.phase]}.`;
  }

  async setTaskStatus(input: SetTaskStatusInput): Promise<string> {
    assertName(input.spec);
    const folder = await this.store.resolveFolder(input.spec, input.folder, true);
    const snap = await this.store.snapshot(folder, input.spec);
    if (snap.phase !== 'implementation') {
      throw new SpecError(
        'NOT_READY',
        `Las tareas de "${input.spec}" aún no están aprobadas (fase: ${PHASE_LABELS[snap.phase]}). Aprueba tasks.md antes de ejecutar tareas.`,
      );
    }
    await transformFile(this.store.docUri(folder, input.spec, 'tasks'), (t) => withTaskStatus(t ?? '', input.taskId, input.status));
    return `Tarea ${input.taskId} → ${STATUS_LABELS[input.status]}.`;
  }
}
```

`src/tools/registerTools.ts`:

```ts
import * as vscode from 'vscode';
import { SpecError } from '../specs/errors';
import { isDocKind } from '../specs/phase';
import { TaskStatus } from '../specs/tasks';
import { SpecService } from '../workspace/specService';

export interface ToolHandlers {
  writeSpecDoc(input: unknown): Promise<string>;
  approvePhase(input: unknown): Promise<string>;
  setTaskStatus(input: unknown): Promise<string>;
}

const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done'];

function obj(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) throw new SpecError('INVALID_INPUT', 'La entrada debe ser un objeto.');
  return input as Record<string, unknown>;
}

function str(o: Record<string, unknown>, key: string, required = true): string | undefined {
  const value = o[key];
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') throw new SpecError('INVALID_INPUT', `Falta "${key}" (texto).`);
  return value;
}

function doc(o: Record<string, unknown>) {
  const value = o.doc;
  if (!isDocKind(value)) throw new SpecError('INVALID_INPUT', '"doc" debe ser requirements, bugfix, design o tasks.');
  return value;
}

function wrap(fn: (input: unknown) => Promise<string>): (input: unknown) => Promise<string> {
  return async (input) => {
    try {
      return await fn(input);
    } catch (e) {
      if (e instanceof SpecError) return `ERROR (${e.code}): ${e.message}`;
      throw e;
    }
  };
}

export function createToolHandlers(service: SpecService): ToolHandlers {
  return {
    writeSpecDoc: wrap(async (input) => {
      const o = obj(input);
      return service.writeSpecDoc({ folder: str(o, 'folder', false), spec: str(o, 'spec')!, doc: doc(o), content: str(o, 'content')! });
    }),
    approvePhase: wrap(async (input) => {
      const o = obj(input);
      return service.approvePhase({ folder: str(o, 'folder', false), spec: str(o, 'spec')!, doc: doc(o) });
    }),
    setTaskStatus: wrap(async (input) => {
      const o = obj(input);
      const status = o.status;
      if (!TASK_STATUSES.includes(status as TaskStatus)) {
        throw new SpecError('INVALID_INPUT', '"status" debe ser todo, in_progress o done.');
      }
      return service.setTaskStatus({
        folder: str(o, 'folder', false),
        spec: str(o, 'spec')!,
        taskId: str(o, 'taskId')!,
        status: status as TaskStatus,
      });
    }),
  };
}

export function registerTools(handlers: ToolHandlers): vscode.Disposable {
  const register = (name: string, fn: (input: unknown) => Promise<string>, message: string) =>
    vscode.lm.registerTool<unknown>(name, {
      prepareInvocation: () => ({ invocationMessage: message }),
      invoke: async (options) => new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(await fn(options.input))]),
    });
  return vscode.Disposable.from(
    register('sdd_writeSpecDoc', handlers.writeSpecDoc, 'Escribiendo documento del spec…'),
    register('sdd_approvePhase', handlers.approvePhase, 'Aprobando fase del spec…'),
    register('sdd_setTaskStatus', handlers.setTaskStatus, 'Actualizando estado de la tarea…'),
  );
}
```

`src/extension.ts` (sustitución completa):

```ts
import * as vscode from 'vscode';
import { createToolHandlers, registerTools, ToolHandlers } from './tools/registerTools';
import { SpecService } from './workspace/specService';
import { SpecStore } from './workspace/specStore';

export interface SddStudioApi {
  store: SpecStore;
  service: SpecService;
  tools: ToolHandlers;
}

export function activate(context: vscode.ExtensionContext): SddStudioApi {
  const store = new SpecStore();
  const service = new SpecService(store);
  const tools = createToolHandlers(service);
  context.subscriptions.push(store, registerTools(tools));
  return { store, service, tools };
}

export function deactivate(): void {}
```

En `package.json`, añade dentro de `contributes`:

```json
"languageModelTools": [
  {
    "name": "sdd_writeSpecDoc",
    "toolReferenceName": "writeSpecDoc",
    "displayName": "SDD: escribir documento de spec",
    "canBeReferencedInPrompt": true,
    "modelDescription": "Crea o reemplaza un documento de un spec de SDD Studio (requirements, bugfix, design o tasks) en <specsFolder>/<spec>/. El documento queda en borrador (status: draft). Úsala SIEMPRE para escribir documentos de spec, nunca edites esos archivos directamente. Si reescribes un documento, los documentos posteriores que estaban aprobados vuelven a borrador. Envía el Markdown completo sin front matter.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "spec": { "type": "string", "description": "Nombre kebab-case del spec, ej. export-csv" },
        "doc": { "type": "string", "enum": ["requirements", "bugfix", "design", "tasks"] },
        "content": { "type": "string", "description": "Markdown completo del documento, sin front matter" },
        "folder": { "type": "string", "description": "Nombre de la carpeta del workspace. Solo si hay varias carpetas abiertas." }
      },
      "required": ["spec", "doc", "content"]
    }
  },
  {
    "name": "sdd_approvePhase",
    "toolReferenceName": "approvePhase",
    "displayName": "SDD: aprobar fase",
    "canBeReferencedInPrompt": true,
    "modelDescription": "Marca como aprobado (status: approved) un documento de un spec de SDD Studio. Úsala solo cuando el usuario haya aprobado explícitamente ese documento (por ejemplo, con un botón de handoff). Falla si el documento no existe o si un documento anterior no está aprobado.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "spec": { "type": "string" },
        "doc": { "type": "string", "enum": ["requirements", "bugfix", "design", "tasks"] },
        "folder": { "type": "string" }
      },
      "required": ["spec", "doc"]
    }
  },
  {
    "name": "sdd_setTaskStatus",
    "toolReferenceName": "setTaskStatus",
    "displayName": "SDD: cambiar estado de tarea",
    "canBeReferencedInPrompt": true,
    "modelDescription": "Cambia el estado de una tarea de tasks.md de un spec de SDD Studio: todo, in_progress o done. La tarea padre se recalcula sola. Marca done solo cuando el usuario lo confirme. Falla si tasks.md no está aprobado o si la tarea no existe.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "spec": { "type": "string" },
        "taskId": { "type": "string", "description": "Id jerárquico, ej. 2.1" },
        "status": { "type": "string", "enum": ["todo", "in_progress", "done"] },
        "folder": { "type": "string" }
      },
      "required": ["spec", "taskId", "status"]
    }
  }
]
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npm run typecheck && npm run lint && npm run test:integration`
Expected: PASS, con `12 passing`: 1 de activación, 4 del store y 7 del servicio.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: SpecService y herramientas sdd_* para Copilot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Puente con Copilot y textos de prompt

**Files:**
- Create: `src/copilot/prompts.ts`, `src/copilot/bridge.ts`
- Test: `test/unit/copilot/prompts.test.ts`

**Interfaces:**
- Consumes: `DocKind` y `SpecType` (Tarea 5).
- Produces:
  - `type AgentName = 'sdd-requirements' | 'sdd-design' | 'sdd-tasks' | 'sdd-implement' | 'sdd-steering'`
  - `type Language = 'es' | 'en'`
  - `newSpecPrompt(p: { spec: string; folder?: string; type: SpecType; description: string; language: Language }): string`
  - `runTaskPrompt(p: { specsFolder: string; spec: string; folder?: string; type: SpecType; task: { id: string; title: string; requirements: string[] } }): string`
  - `nextPhasePrompt(p: { spec: string; folder?: string; approved: DocKind }): { agent: AgentName; prompt: string } | undefined`
  - `steeringPrompt(language: Language): string`
  - `interface CopilotBridge { openAgent(agent: AgentName, prompt: string): Promise<void> }`
  - `class VsCodeCopilotBridge implements CopilotBridge`

- [ ] **Step 1: Escribir el test que falla**

`test/unit/copilot/prompts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newSpecPrompt, nextPhasePrompt, runTaskPrompt, steeringPrompt } from '../../../src/copilot/prompts';

describe('newSpecPrompt', () => {
  it('feature en español', () => {
    const p = newSpecPrompt({ spec: 'export-csv', type: 'feature', description: 'Exportar pedidos', language: 'es' });
    expect(p).toContain('Crea el spec "export-csv" (feature).');
    expect(p).toContain('Descripción: Exportar pedidos');
    expect(p).toContain('writeSpecDoc (spec="export-csv", doc="requirements")');
    expect(p).toContain('Redacta en español');
  });
  it('bugfix con carpeta y en inglés', () => {
    const p = newSpecPrompt({ spec: 'timeout-api', folder: 'api', type: 'bugfix', description: '', language: 'en' });
    expect(p).toContain('doc="bugfix", folder="api"');
    expect(p).toContain('(sin descripción: pregúntame)');
    expect(p).toContain('Write the document in English');
  });
});

describe('runTaskPrompt', () => {
  it('incluye tarea, criterios y referencias #file', () => {
    const p = runTaskPrompt({
      specsFolder: 'specs',
      spec: 'pagos-checkout',
      type: 'feature',
      task: { id: '2.1', title: 'Validar carrito', requirements: ['2.1', '2.2'] },
    });
    expect(p).toContain('Ejecuta la tarea 2.1 del spec "pagos-checkout": Validar carrito');
    expect(p).toContain('Criterios relacionados: 2.1, 2.2');
    expect(p).toContain('#file:specs/pagos-checkout/requirements.md #file:specs/pagos-checkout/design.md #file:specs/pagos-checkout/tasks.md');
    expect(p).toContain('No la marques como hecha');
  });
  it('bugfix referencia bugfix.md y sin criterios lo dice', () => {
    const p = runTaskPrompt({ specsFolder: 'specs', spec: 'b', type: 'bugfix', task: { id: '1', title: 't', requirements: [] } });
    expect(p).toContain('#file:specs/b/bugfix.md');
    expect(p).toContain('Criterios relacionados: ninguno indicado');
  });
});

describe('nextPhasePrompt', () => {
  it('requisitos y bugfix → sdd-design; diseño → sdd-tasks; tareas → nada', () => {
    expect(nextPhasePrompt({ spec: 's', approved: 'requirements' })?.agent).toBe('sdd-design');
    expect(nextPhasePrompt({ spec: 's', approved: 'bugfix' })?.agent).toBe('sdd-design');
    expect(nextPhasePrompt({ spec: 's', approved: 'design' })?.agent).toBe('sdd-tasks');
    expect(nextPhasePrompt({ spec: 's', approved: 'tasks' })).toBeUndefined();
    expect(nextPhasePrompt({ spec: 's', approved: 'design' })?.prompt).toContain('Ya aprobé design.md del spec "s"');
  });
});

describe('steeringPrompt', () => {
  it('pide los tres archivos', () => {
    const p = steeringPrompt('es');
    expect(p).toContain('product.instructions.md');
    expect(p).toContain('tech.instructions.md');
    expect(p).toContain('structure.instructions.md');
  });
});
```

- [ ] **Step 2: Ejecutar el test para ver que falla**

Run: `npx vitest run test/unit/copilot`
Expected: FAIL. El módulo no existe.

- [ ] **Step 3: Implementación**

`src/copilot/prompts.ts`:

```ts
import type { DocKind, SpecType } from '../specs/phase';

export type AgentName = 'sdd-requirements' | 'sdd-design' | 'sdd-tasks' | 'sdd-implement' | 'sdd-steering';
export type Language = 'es' | 'en';

function languageLine(language: Language): string {
  return language === 'en'
    ? 'Write the document in English; EARS keywords stay in English.'
    : 'Redacta en español; las palabras clave EARS van en inglés.';
}

function folderArg(folder?: string): string {
  return folder ? `, folder="${folder}"` : '';
}

export function newSpecPrompt(p: { spec: string; folder?: string; type: SpecType; description: string; language: Language }): string {
  const doc = p.type === 'bugfix' ? 'bugfix' : 'requirements';
  return [
    `Crea el spec "${p.spec}" (${p.type}).`,
    `Descripción: ${p.description.trim() || '(sin descripción: pregúntame)'}`,
    `Escribe ${doc}.md con la herramienta writeSpecDoc (spec="${p.spec}", doc="${doc}"${folderArg(p.folder)}).`,
    languageLine(p.language),
  ].join('\n');
}

export function runTaskPrompt(p: {
  specsFolder: string;
  spec: string;
  folder?: string;
  type: SpecType;
  task: { id: string; title: string; requirements: string[] };
}): string {
  const base = `${p.specsFolder}/${p.spec}`;
  const first = p.type === 'bugfix' ? 'bugfix' : 'requirements';
  return [
    `Ejecuta la tarea ${p.task.id} del spec "${p.spec}": ${p.task.title}`,
    `Criterios relacionados: ${p.task.requirements.join(', ') || 'ninguno indicado'}`,
    ...(p.folder ? [`Carpeta del workspace: ${p.folder}`] : []),
    `Contexto: #file:${base}/${first}.md #file:${base}/design.md #file:${base}/tasks.md`,
    'Implementa solo esta tarea, con tests primero, y verifica ejecutándolos. No la marques como hecha: lo confirmo yo con el botón.',
  ].join('\n');
}

export function nextPhasePrompt(p: { spec: string; folder?: string; approved: DocKind }): { agent: AgentName; prompt: string } | undefined {
  const where = `spec="${p.spec}"${folderArg(p.folder)}`;
  if (p.approved === 'requirements' || p.approved === 'bugfix') {
    return {
      agent: 'sdd-design',
      prompt: `Ya aprobé ${p.approved}.md del spec "${p.spec}". Redacta design.md con writeSpecDoc (${where}, doc="design").`,
    };
  }
  if (p.approved === 'design') {
    return {
      agent: 'sdd-tasks',
      prompt: `Ya aprobé design.md del spec "${p.spec}". Redacta tasks.md con writeSpecDoc (${where}, doc="tasks").`,
    };
  }
  return undefined;
}

export function steeringPrompt(language: Language): string {
  return [
    'Analiza este repositorio y genera o actualiza el steering del proyecto en .github/instructions/:',
    '- product.instructions.md (propósito, usuarios, objetivos) con applyTo: "**"',
    '- tech.instructions.md (stack, librerías, comandos de build y test, restricciones) con applyTo: "**"',
    '- structure.instructions.md (organización de carpetas, nombres, patrones de arquitectura) con applyTo: "**"',
    'Si ya existen, conserva lo que siga siendo cierto y corrige lo que no.',
    languageLine(language),
  ].join('\n');
}
```

`src/copilot/bridge.ts`. Fija `SUPPORTS_AGENT_ARG` y la clave del argumento según las filas 1 y 2 de `docs/spike-findings.md`:

```ts
import * as vscode from 'vscode';
import type { AgentName } from './prompts';

export interface CopilotBridge {
  openAgent(agent: AgentName, prompt: string): Promise<void>;
}

/** Fijado por el spike (docs/spike-findings.md, fila 1). */
const SUPPORTS_AGENT_ARG = true;

export class VsCodeCopilotBridge implements CopilotBridge {
  async openAgent(agent: AgentName, prompt: string): Promise<void> {
    if (SUPPORTS_AGENT_ARG) {
      await vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt, mode: agent });
      return;
    }
    await vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt, isPartialQuery: true });
    void vscode.window.showInformationMessage(`Selecciona el agente "${agent}" en Copilot Chat y envía el mensaje.`);
  }
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/copilot test/unit/copilot
git commit -m "feat(copilot): puente con Copilot Chat y textos de prompt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Panel "Specs" y comandos de spec

**Files:**
- Create: `src/ui/labels.ts`, `src/ui/specsTree.ts`, `src/ui/specCommands.ts`, `media/sdd-studio.svg`
- Modify: `src/extension.ts` (sustituirlo completo)
- Modify: `package.json`: añadir `viewsContainers`, `views`, `commands` y `menus`
- Test: `test/unit/ui/labels.test.ts`, `test/integration/tree.test.ts`

**Interfaces:**
- Consumes:
  - `SpecStore`, `SpecSnapshot`, `SpecDocInfo` y `SteeringDoc` (Tarea 6).
  - `CopilotBridge`, `newSpecPrompt`, `steeringPrompt` y `Language` (Tarea 8).
  - `toSpecName` (Tarea 3), y `PHASE_LABELS`, `docOrder` y `currentPhase` (Tarea 5).
- Produces:
  - `phaseBar(type: SpecType, states: DocStates): string`
  - `specDescription(phase: Phase, progress: { done: number; total: number }): string`
  - `docStatusLabel(doc: { exists: boolean; status: DocStatus }, isCurrent: boolean): string`
  - `docIcon(doc: { exists: boolean; status: DocStatus }, isCurrent: boolean): string`
  - `class SpecsTreeProvider implements vscode.TreeDataProvider<SpecsNode>`
  - `type SpecsNode`
  - `interface CommandDeps { store: SpecStore; service: SpecService; getBridge(): CopilotBridge }`
  - `registerSpecCommands(deps: CommandDeps): vscode.Disposable`
  - Comandos: `sddStudio.newSpec(args?: { folder?: string; type?: SpecType; name?: string; description?: string })`, `sddStudio.refresh` y `sddStudio.generateSteering`.
  - `SddStudioApi` pasa a ser `{ store; service; tools; specsTree: SpecsTreeProvider; setCopilotBridge(b: CopilotBridge): void }`.

- [ ] **Step 1: Escribir los tests que fallan**

`test/unit/ui/labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { docIcon, docStatusLabel, phaseBar, specDescription } from '../../../src/ui/labels';

const ok = { exists: true, status: 'approved' as const };
const draft = { exists: true, status: 'draft' as const };

describe('labels', () => {
  it('phaseBar feature en diseño', () => {
    expect(phaseBar('feature', { requirements: ok, design: draft })).toBe('✓ Requisitos → ● Diseño → Tareas → Implementación');
  });
  it('phaseBar bugfix terminado', () => {
    expect(phaseBar('bugfix', { bugfix: ok, design: ok, tasks: ok })).toBe('✓ Bug → ✓ Diseño → ✓ Tareas → ● Implementación');
  });
  it('specDescription', () => {
    expect(specDescription('design', { done: 0, total: 0 })).toBe('Diseño');
    expect(specDescription('implementation', { done: 1, total: 3 })).toBe('1/3 tareas');
  });
  it('estado e icono de documento', () => {
    expect(docStatusLabel({ exists: false, status: 'draft' }, true)).toBe('falta');
    expect(docStatusLabel(ok, false)).toBe('aprobado');
    expect(docStatusLabel(draft, true)).toBe('borrador · actual');
    expect(docIcon({ exists: false, status: 'draft' }, false)).toBe('circle-slash');
    expect(docIcon(ok, false)).toBe('pass-filled');
    expect(docIcon(draft, true)).toBe('circle-filled');
    expect(docIcon(draft, false)).toBe('circle-outline');
  });
});
```

`test/integration/tree.test.ts`:

```ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import type { CopilotBridge } from '../../src/copilot/bridge';
import type { AgentName } from '../../src/copilot/prompts';
import { getApi, restoreFixture } from './helpers';

class FakeBridge implements CopilotBridge {
  calls: { agent: AgentName; prompt: string }[] = [];
  async openAgent(agent: AgentName, prompt: string): Promise<void> {
    this.calls.push({ agent, prompt });
  }
}

function label(item: vscode.TreeItem): string {
  return typeof item.label === 'string' ? item.label : item.label!.label;
}

describe('Panel Specs y comandos de spec', () => {
  beforeEach(restoreFixture);

  it('muestra Nuevo spec, los specs, Steering y Powers', async () => {
    const { specsTree } = await getApi();
    const roots = await specsTree.getChildren();
    const items = roots.map((n) => specsTree.getTreeItem(n));
    assert.deepStrictEqual(items.map(label), ['Nuevo spec', 'export-csv', 'pagos-checkout', 'Steering', 'Powers']);
    assert.strictEqual(items[2].description, '1/3 tareas');
    assert.strictEqual(items[1].description, 'Requisitos');
  });

  it('los hijos de un spec son sus documentos con estado', async () => {
    const { specsTree } = await getApi();
    const roots = await specsTree.getChildren();
    const docs = (await specsTree.getChildren(roots[1])).map((n) => specsTree.getTreeItem(n));
    assert.deepStrictEqual(docs.map((d) => [label(d), d.description]), [
      ['requirements.md', 'borrador · actual'],
      ['design.md', 'falta'],
      ['tasks.md', 'falta'],
    ]);
  });

  it('newSpec con argumentos abre sdd-requirements con el prompt', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.newSpec', { type: 'feature', name: 'Exportación PDF', description: 'Exportar a PDF' });
    assert.strictEqual(fake.calls.length, 1);
    assert.strictEqual(fake.calls[0].agent, 'sdd-requirements');
    assert.match(fake.calls[0].prompt, /Crea el spec "exportacion-pdf" \(feature\)/);
  });

  it('newSpec rechaza un nombre que ya existe', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.newSpec', { type: 'feature', name: 'export-csv', description: 'x' });
    assert.strictEqual(fake.calls.length, 0);
  });

  it('generateSteering abre sdd-steering', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.generateSteering');
    assert.strictEqual(fake.calls[0].agent, 'sdd-steering');
  });
});
```

- [ ] **Step 2: Ejecutar los tests para ver que fallan**

Run: `npx vitest run test/unit/ui; npm run test:integration`
Expected: FAIL. El módulo `labels` no existe y `specsTree` es `undefined`.

- [ ] **Step 3: Implementación**

`src/ui/labels.ts`:

```ts
import type { DocStatus } from '../specs/frontMatter';
import { currentPhase, docOrder, DocStates, Phase, PHASE_LABELS, SpecType } from '../specs/phase';

interface DocLike {
  exists: boolean;
  status: DocStatus;
}

export function phaseBar(type: SpecType, states: DocStates): string {
  const current = currentPhase(states);
  const steps: Phase[] = [...docOrder(type), 'implementation'];
  return steps
    .map((step) => {
      const label = PHASE_LABELS[step];
      if (step !== 'implementation' && states[step]?.exists && states[step]?.status === 'approved') return `✓ ${label}`;
      if (step === current) return `● ${label}`;
      return label;
    })
    .join(' → ');
}

export function specDescription(phase: Phase, progress: { done: number; total: number }): string {
  return phase === 'implementation' ? `${progress.done}/${progress.total} tareas` : PHASE_LABELS[phase];
}

export function docStatusLabel(doc: DocLike, isCurrent: boolean): string {
  if (!doc.exists) return 'falta';
  if (doc.status === 'approved') return 'aprobado';
  return isCurrent ? 'borrador · actual' : 'borrador';
}

export function docIcon(doc: DocLike, isCurrent: boolean): string {
  if (!doc.exists) return 'circle-slash';
  if (doc.status === 'approved') return 'pass-filled';
  return isCurrent ? 'circle-filled' : 'circle-outline';
}
```

`src/ui/specsTree.ts`:

```ts
import * as vscode from 'vscode';
import { docFileName } from '../specs/phase';
import { SpecDocInfo, SpecSnapshot, SpecStore, SteeringDoc } from '../workspace/specStore';
import { docIcon, docStatusLabel, phaseBar, specDescription } from './labels';

export type SpecsNode =
  | { type: 'folder'; folder: vscode.WorkspaceFolder }
  | { type: 'new'; folder: vscode.WorkspaceFolder }
  | { type: 'spec'; snap: SpecSnapshot }
  | { type: 'doc'; snap: SpecSnapshot; doc: SpecDocInfo }
  | { type: 'section'; section: 'steering' | 'powers'; folder: vscode.WorkspaceFolder }
  | { type: 'steering'; doc: SteeringDoc }
  | { type: 'info'; label: string; command?: vscode.Command };

export class SpecsTreeProvider implements vscode.TreeDataProvider<SpecsNode>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<SpecsNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly store: SpecStore) {
    this.subscription = store.onDidChange(() => this.emitter.fire(undefined));
  }

  async getChildren(node?: SpecsNode): Promise<SpecsNode[]> {
    if (!node) {
      const folders = this.store.folders();
      if (folders.length === 0) return [{ type: 'info', label: 'Abre una carpeta para usar SDD Studio' }];
      if (folders.length > 1) return folders.map((folder): SpecsNode => ({ type: 'folder', folder }));
      return this.folderChildren(folders[0]);
    }
    switch (node.type) {
      case 'folder':
        return this.folderChildren(node.folder);
      case 'spec':
        return node.snap.docs.map((doc): SpecsNode => ({ type: 'doc', snap: node.snap, doc }));
      case 'section':
        return this.sectionChildren(node.section, node.folder);
      default:
        return [];
    }
  }

  getTreeItem(node: SpecsNode): vscode.TreeItem {
    switch (node.type) {
      case 'folder': {
        const item = new vscode.TreeItem(node.folder.name, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = new vscode.ThemeIcon('root-folder');
        return item;
      }
      case 'new': {
        const item = new vscode.TreeItem('Nuevo spec');
        item.iconPath = new vscode.ThemeIcon('add');
        item.command = { command: 'sddStudio.newSpec', title: 'Nuevo spec', arguments: [{ folder: node.folder.name }] };
        return item;
      }
      case 'spec': {
        const item = new vscode.TreeItem(node.snap.name, vscode.TreeItemCollapsibleState.Collapsed);
        item.description = specDescription(node.snap.phase, node.snap.progress);
        item.tooltip = phaseBar(node.snap.type, node.snap.states);
        item.iconPath = new vscode.ThemeIcon(node.snap.type === 'bugfix' ? 'bug' : 'symbol-event');
        item.contextValue = 'spec';
        return item;
      }
      case 'doc': {
        const isCurrent = node.snap.phase === node.doc.kind;
        const item = new vscode.TreeItem(docFileName(node.doc.kind));
        item.description = docStatusLabel(node.doc, isCurrent);
        item.iconPath = new vscode.ThemeIcon(docIcon(node.doc, isCurrent));
        item.contextValue = 'doc';
        if (node.doc.exists) item.command = { command: 'vscode.open', title: 'Abrir', arguments: [node.doc.uri] };
        return item;
      }
      case 'section': {
        const item = new vscode.TreeItem(
          node.section === 'steering' ? 'Steering' : 'Powers',
          vscode.TreeItemCollapsibleState.Expanded,
        );
        item.iconPath = new vscode.ThemeIcon(node.section === 'steering' ? 'book' : 'zap');
        item.contextValue = `section-${node.section}`;
        return item;
      }
      case 'steering': {
        const item = new vscode.TreeItem(node.doc.label);
        item.description = node.doc.applyTo ?? 'manual';
        item.iconPath = new vscode.ThemeIcon('note');
        item.command = { command: 'vscode.open', title: 'Abrir', arguments: [node.doc.uri] };
        return item;
      }
      case 'info': {
        const item = new vscode.TreeItem(node.label);
        item.command = node.command;
        return item;
      }
    }
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }

  private async folderChildren(folder: vscode.WorkspaceFolder): Promise<SpecsNode[]> {
    const specs = await this.store.list(folder);
    return [
      { type: 'new', folder },
      ...specs.map((snap): SpecsNode => ({ type: 'spec', snap })),
      { type: 'section', section: 'steering', folder },
      { type: 'section', section: 'powers', folder },
    ];
  }

  private async sectionChildren(section: 'steering' | 'powers', folder: vscode.WorkspaceFolder): Promise<SpecsNode[]> {
    if (section === 'powers') return [{ type: 'info', label: 'Llegan en la próxima versión' }];
    const docs = await this.store.listSteering(folder);
    if (docs.length === 0) {
      return [{ type: 'info', label: 'Generar steering…', command: { command: 'sddStudio.generateSteering', title: 'Generar steering' } }];
    }
    return docs.map((doc): SpecsNode => ({ type: 'steering', doc }));
  }
}
```

`src/ui/specCommands.ts`:

```ts
import * as vscode from 'vscode';
import { CopilotBridge } from '../copilot/bridge';
import { Language, newSpecPrompt, steeringPrompt } from '../copilot/prompts';
import { toSpecName } from '../specs/names';
import { SpecType } from '../specs/phase';
import { SpecService } from '../workspace/specService';
import { SpecStore } from '../workspace/specStore';

export interface CommandDeps {
  store: SpecStore;
  service: SpecService;
  getBridge(): CopilotBridge;
}

interface NewSpecArgs {
  folder?: string;
  type?: SpecType;
  name?: string;
  description?: string;
}

function language(): Language {
  return vscode.workspace.getConfiguration('sddStudio').get<Language>('language', 'es');
}

async function pickFolder(store: SpecStore, requested?: string): Promise<vscode.WorkspaceFolder | undefined> {
  if (requested) return store.folderByName(requested);
  const folders = store.folders();
  if (folders.length <= 1) return folders[0];
  const active = vscode.window.activeTextEditor?.document.uri;
  const fromEditor = active ? vscode.workspace.getWorkspaceFolder(active) : undefined;
  return fromEditor ?? vscode.window.showWorkspaceFolderPick({ placeHolder: '¿En qué carpeta creo el spec?' });
}

async function newSpec(deps: CommandDeps, args: NewSpecArgs = {}): Promise<void> {
  if (!vscode.workspace.isTrusted) {
    void vscode.window.showWarningMessage('SDD Studio: confía en este workspace para crear specs.');
    return;
  }
  const folder = await pickFolder(deps.store, args.folder);
  if (!folder) return;

  let type = args.type;
  if (!type) {
    const pick = await vscode.window.showQuickPick(
      [
        { label: '$(symbol-event) Feature', description: 'requisitos → diseño → tareas', value: 'feature' as const },
        { label: '$(bug) Bugfix', description: 'bug → causa raíz → tareas', value: 'bugfix' as const },
      ],
      { title: 'Nuevo spec' },
    );
    if (!pick) return;
    type = pick.value;
  }

  const raw =
    args.name ??
    (await vscode.window.showInputBox({
      title: 'Nombre del spec',
      prompt: 'Se convertirá a minúsculas con guiones (ej. export-csv)',
      validateInput: (v) => (toSpecName(v) ? undefined : 'Escribe un nombre con letras o números'),
    }));
  if (!raw) return;
  const name = toSpecName(raw);
  if (!name) return;
  if (await deps.store.specExists(folder, name)) {
    void vscode.window.showErrorMessage(`SDD Studio: ya existe el spec "${name}".`);
    return;
  }

  const description =
    args.description ??
    (await vscode.window.showInputBox({
      title: `Describe "${name}"`,
      prompt: type === 'bugfix' ? '¿Qué falla y cómo se reproduce?' : '¿Qué quieres construir y para quién?',
    }));
  if (description === undefined) return;

  const multiRoot = deps.store.folders().length > 1;
  await deps
    .getBridge()
    .openAgent('sdd-requirements', newSpecPrompt({ spec: name, folder: multiRoot ? folder.name : undefined, type, description, language: language() }));
}

export function registerSpecCommands(deps: CommandDeps): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.commands.registerCommand('sddStudio.newSpec', (args?: NewSpecArgs) => newSpec(deps, args)),
    vscode.commands.registerCommand('sddStudio.refresh', () => deps.store.refresh()),
    vscode.commands.registerCommand('sddStudio.generateSteering', () =>
      deps.getBridge().openAgent('sdd-steering', steeringPrompt(language())),
    ),
  );
}
```

`media/sdd-studio.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>
```

`src/extension.ts` (sustitución completa):

```ts
import * as vscode from 'vscode';
import { CopilotBridge, VsCodeCopilotBridge } from './copilot/bridge';
import { createToolHandlers, registerTools, ToolHandlers } from './tools/registerTools';
import { registerSpecCommands } from './ui/specCommands';
import { SpecsTreeProvider } from './ui/specsTree';
import { SpecService } from './workspace/specService';
import { SpecStore } from './workspace/specStore';

export interface SddStudioApi {
  store: SpecStore;
  service: SpecService;
  tools: ToolHandlers;
  specsTree: SpecsTreeProvider;
  setCopilotBridge(bridge: CopilotBridge): void;
}

export function activate(context: vscode.ExtensionContext): SddStudioApi {
  const store = new SpecStore();
  const service = new SpecService(store);
  const tools = createToolHandlers(service);
  const specsTree = new SpecsTreeProvider(store);
  let bridge: CopilotBridge = new VsCodeCopilotBridge();
  const deps = { store, service, getBridge: () => bridge };

  context.subscriptions.push(
    store,
    specsTree,
    registerTools(tools),
    vscode.window.createTreeView('sddStudio.specs', { treeDataProvider: specsTree }),
    registerSpecCommands(deps),
  );

  return {
    store,
    service,
    tools,
    specsTree,
    setCopilotBridge: (b) => {
      bridge = b;
    },
  };
}

export function deactivate(): void {}
```

En `package.json`, añade dentro de `contributes`:

```json
"viewsContainers": {
  "activitybar": [{ "id": "sddStudio", "title": "SDD Studio", "icon": "media/sdd-studio.svg" }]
},
"views": {
  "sddStudio": [{ "id": "sddStudio.specs", "name": "Specs" }]
},
"commands": [
  { "command": "sddStudio.newSpec", "title": "Nuevo spec", "category": "SDD Studio", "icon": "$(add)", "enablement": "isWorkspaceTrusted" },
  { "command": "sddStudio.refresh", "title": "Actualizar", "category": "SDD Studio", "icon": "$(refresh)" },
  { "command": "sddStudio.generateSteering", "title": "Generar steering", "category": "SDD Studio" }
],
"menus": {
  "view/title": [
    { "command": "sddStudio.newSpec", "when": "view == sddStudio.specs", "group": "navigation@1" },
    { "command": "sddStudio.refresh", "when": "view == sddStudio.specs", "group": "navigation@2" }
  ],
  "view/item/context": [
    { "command": "sddStudio.generateSteering", "when": "view == sddStudio.specs && viewItem == section-steering" }
  ]
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:integration`
Expected: PASS. La integración da `17 passing`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): panel Specs, Nuevo spec y Generar steering

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: CodeLens, comandos de tareas y avisos en `tasks.md`

**Files:**
- Create: `src/ui/lensModel.ts`, `src/ui/taskLens.ts`, `src/ui/taskCommands.ts`, `src/ui/diagnostics.ts`
- Modify: `src/extension.ts` (sustituirlo completo)
- Modify: `package.json`: añadir comandos y ocultar los internos de la paleta
- Test: `test/unit/ui/lensModel.test.ts`, `test/integration/tasks.test.ts`

**Interfaces:**
- Consumes:
  - `parseTasks` e `isLeaf` (Tarea 4).
  - `currentPhase`, `DocKind`, `DocStates` y `SpecType` (Tarea 5), y `findRequirementLine`.
  - `phaseBar` (Tarea 9).
  - `CommandDeps` (Tarea 9), y `runTaskPrompt` y `nextPhasePrompt` (Tarea 8).
- Produces:
  - `interface LensSpec { line: number; title: string; command?: string; args?: unknown[] }`
  - `computeLenses(ctx: { folder: string; spec: string; kind: DocKind; text: string; type: SpecType; states: DocStates }): LensSpec[]`
  - `class SpecLensProvider implements vscode.CodeLensProvider`
  - `class TaskDiagnostics implements vscode.Disposable`
  - `registerTaskCommands(deps: CommandDeps): vscode.Disposable`
  - Comandos:
    - `sddStudio.runTask(folder: string, spec: string, taskId: string)`
    - `sddStudio.markTaskDone(folder: string, spec: string, taskId: string)`
    - `sddStudio.approveAndContinue(folder: string, spec: string, kind: DocKind)`
    - `sddStudio.openRequirements(folder: string, spec: string, reqIds: string[])`

- [ ] **Step 1: Escribir los tests que fallan**

`test/unit/ui/lensModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeLenses } from '../../../src/ui/lensModel';

const ok = { exists: true, status: 'approved' as const };
const draft = { exists: true, status: 'draft' as const };
const TASKS = [
  '---', // 0
  'status: approved', // 1
  '---', // 2
  '# Plan', // 3
  '- [x] 1. Hecha', // 4
  '- [ ] 2. Padre', // 5
  '  - [-] 2.1 En curso', // 6
  '    - _Requisitos: 2.1_', // 7
  '  - [ ] 2.2 Pendiente', // 8
  '    - _Requisitos: 2.3_', // 9
].join('\n');

const base = { folder: 'ws', spec: 'pagos', type: 'feature' as const };

describe('computeLenses', () => {
  it('documento en borrador de la fase actual: barra + Aprobar y continuar', () => {
    const lenses = computeLenses({ ...base, kind: 'design', text: '# D', states: { requirements: ok, design: draft } });
    expect(lenses).toEqual([
      { line: 0, title: '✓ Requisitos → ● Diseño → Tareas → Implementación' },
      { line: 0, title: '✓ Aprobar y continuar', command: 'sddStudio.approveAndContinue', args: ['ws', 'pagos', 'design'] },
    ]);
  });

  it('tasks.md sin aprobar: no hay Ejecutar tarea', () => {
    const lenses = computeLenses({ ...base, kind: 'tasks', text: TASKS, states: { requirements: ok, design: ok, tasks: draft } });
    expect(lenses.map((l) => l.title)).toEqual([
      '✓ Requisitos → ✓ Diseño → ● Tareas → Implementación',
      '✓ Aprobar y continuar',
      'Aprueba las tareas para poder ejecutarlas',
    ]);
  });

  it('tasks.md aprobado: lenses por tarea hoja según estado; el padre no se ejecuta', () => {
    const lenses = computeLenses({ ...base, kind: 'tasks', text: TASKS, states: { requirements: ok, design: ok, tasks: ok } });
    expect(lenses.slice(1)).toEqual([
      { line: 4, title: '✓ completada' },
      { line: 6, title: '◐ en curso' },
      { line: 6, title: '✓ Marcar hecha', command: 'sddStudio.markTaskDone', args: ['ws', 'pagos', '2.1'] },
      { line: 6, title: 'Ver requisitos', command: 'sddStudio.openRequirements', args: ['ws', 'pagos', ['2.1']] },
      { line: 8, title: '▶ Ejecutar tarea', command: 'sddStudio.runTask', args: ['ws', 'pagos', '2.2'] },
      { line: 8, title: 'Ver requisitos', command: 'sddStudio.openRequirements', args: ['ws', 'pagos', ['2.3']] },
    ]);
  });

  it('documento aprobado: solo la barra', () => {
    const lenses = computeLenses({ ...base, kind: 'requirements', text: '# R', states: { requirements: ok } });
    expect(lenses).toHaveLength(1);
  });
});
```

`test/integration/tasks.test.ts`:

```ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import type { CopilotBridge } from '../../src/copilot/bridge';
import type { AgentName } from '../../src/copilot/prompts';
import { getApi, readWs, restoreFixture, ws, wsUri } from './helpers';

class FakeBridge implements CopilotBridge {
  calls: { agent: AgentName; prompt: string }[] = [];
  async openAgent(agent: AgentName, prompt: string): Promise<void> {
    this.calls.push({ agent, prompt });
  }
}

describe('Tareas: CodeLens y comandos', () => {
  beforeEach(restoreFixture);

  it('tasks.md aprobado muestra ▶ Ejecutar tarea en las hojas pendientes (incluida la opcional 3)', async () => {
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      'vscode.executeCodeLensProvider',
      wsUri('specs/pagos-checkout/tasks.md'),
    );
    const run = lenses.filter((l) => l.command?.title === '▶ Ejecutar tarea').map((l) => l.command!.arguments![2]);
    assert.deepStrictEqual(run, ['2.1', '2.2', '3']);
  });

  it('runTask marca en curso y abre sdd-implement con la tarea', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.runTask', ws().name, 'pagos-checkout', '2.1');
    const text = await readWs('specs/pagos-checkout/tasks.md');
    assert.match(text, /- \[-\] 2\.1 Validar/);
    assert.match(text, /- \[-\] 2\. Endpoint/);
    assert.strictEqual(fake.calls[0].agent, 'sdd-implement');
    assert.match(fake.calls[0].prompt, /Ejecuta la tarea 2\.1 del spec "pagos-checkout": Validar carrito y montos/);
    assert.match(fake.calls[0].prompt, /Criterios relacionados: 2\.1, 2\.2/);
  });

  it('markTaskDone en 2.1 y 2.2 completa el padre', async () => {
    await vscode.commands.executeCommand('sddStudio.markTaskDone', ws().name, 'pagos-checkout', '2.1');
    await vscode.commands.executeCommand('sddStudio.markTaskDone', ws().name, 'pagos-checkout', '2.2');
    assert.match(await readWs('specs/pagos-checkout/tasks.md'), /- \[x\] 2\. Endpoint/);
  });

  it('approveAndContinue aprueba requisitos y abre sdd-design', async () => {
    const api = await getApi();
    const fake = new FakeBridge();
    api.setCopilotBridge(fake);
    await vscode.commands.executeCommand('sddStudio.approveAndContinue', ws().name, 'export-csv', 'requirements');
    assert.match(await readWs('specs/export-csv/requirements.md'), /status: approved/);
    assert.strictEqual(fake.calls[0].agent, 'sdd-design');
  });

  it('openRequirements abre requirements.md en el criterio', async () => {
    await vscode.commands.executeCommand('sddStudio.openRequirements', ws().name, 'pagos-checkout', ['2.2']);
    const editor = vscode.window.activeTextEditor!;
    assert.match(editor.document.uri.path, /pagos-checkout\/requirements\.md$/);
    assert.match(editor.document.lineAt(editor.selection.active.line).text, /^2\. IF el monto/);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  it('avisa de líneas mal formadas en tasks.md', async () => {
    const uri = wsUri('specs/pagos-checkout/tasks.md');
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);
    await editor.edit((e) => e.insert(new vscode.Position(doc.lineCount - 1, 0), '- [?] 4. rara\n'));
    await new Promise((r) => setTimeout(r, 300));
    const diags = vscode.languages.getDiagnostics(uri);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Warning);
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });
});
```

- [ ] **Step 2: Ejecutar los tests para ver que fallan**

Run: `npx vitest run test/unit/ui/lensModel.test.ts; npm run test:integration`
Expected: FAIL. `lensModel` no existe y los comandos `sddStudio.runTask` y demás no están registrados.

- [ ] **Step 3: Implementación**

`src/ui/lensModel.ts`:

```ts
import { currentPhase, DocKind, DocStates, SpecType } from '../specs/phase';
import { isLeaf, parseTasks } from '../specs/tasks';
import { phaseBar } from './labels';

export interface LensSpec {
  line: number;
  title: string;
  command?: string;
  args?: unknown[];
}

export function computeLenses(ctx: {
  folder: string;
  spec: string;
  kind: DocKind;
  text: string;
  type: SpecType;
  states: DocStates;
}): LensSpec[] {
  const phase = currentPhase(ctx.states);
  const lenses: LensSpec[] = [{ line: 0, title: phaseBar(ctx.type, ctx.states) }];
  if (phase === ctx.kind && ctx.states[ctx.kind]?.status === 'draft') {
    lenses.push({ line: 0, title: '✓ Aprobar y continuar', command: 'sddStudio.approveAndContinue', args: [ctx.folder, ctx.spec, ctx.kind] });
  }
  if (ctx.kind !== 'tasks') return lenses;
  if (phase !== 'implementation') {
    lenses.push({ line: 0, title: 'Aprueba las tareas para poder ejecutarlas' });
    return lenses;
  }

  const { tasks } = parseTasks(ctx.text);
  for (const task of tasks.filter((t) => isLeaf(t, tasks))) {
    const args = [ctx.folder, ctx.spec, task.id];
    if (task.status === 'done') {
      lenses.push({ line: task.line, title: '✓ completada' });
      continue;
    }
    if (task.status === 'in_progress') {
      lenses.push({ line: task.line, title: '◐ en curso' });
      lenses.push({ line: task.line, title: '✓ Marcar hecha', command: 'sddStudio.markTaskDone', args });
    } else {
      lenses.push({ line: task.line, title: '▶ Ejecutar tarea', command: 'sddStudio.runTask', args });
    }
    if (task.requirements.length > 0) {
      lenses.push({
        line: task.line,
        title: 'Ver requisitos',
        command: 'sddStudio.openRequirements',
        args: [ctx.folder, ctx.spec, task.requirements],
      });
    }
  }
  return lenses;
}
```

`src/ui/taskLens.ts`:

```ts
import * as vscode from 'vscode';
import { SpecStore } from '../workspace/specStore';
import { computeLenses } from './lensModel';

export class SpecLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly store: SpecStore) {
    this.subscription = store.onDidChange(() => this.emitter.fire());
  }

  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const location = this.store.locate(document.uri);
    if (!location) return [];
    const snap = await this.store.snapshot(location.folder, location.name);
    return computeLenses({
      folder: location.folder.name,
      spec: location.name,
      kind: location.kind,
      text: document.getText(),
      type: snap.type,
      states: snap.states,
    }).map(
      (lens) =>
        new vscode.CodeLens(new vscode.Range(lens.line, 0, lens.line, 0), {
          title: lens.title,
          command: lens.command ?? '',
          arguments: lens.args,
        }),
    );
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }
}
```

`src/ui/diagnostics.ts`:

```ts
import * as vscode from 'vscode';
import { parseTasks } from '../specs/tasks';
import { SpecStore } from '../workspace/specStore';

export class TaskDiagnostics implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection('sdd-studio');
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly store: SpecStore) {
    this.subscriptions = [
      vscode.workspace.onDidOpenTextDocument((d) => this.update(d)),
      vscode.workspace.onDidChangeTextDocument((e) => this.update(e.document)),
      vscode.workspace.onDidCloseTextDocument((d) => this.collection.delete(d.uri)),
    ];
    vscode.workspace.textDocuments.forEach((d) => this.update(d));
  }

  private update(document: vscode.TextDocument): void {
    const location = this.store.locate(document.uri);
    if (!location || location.kind !== 'tasks') return;
    const { warnings } = parseTasks(document.getText());
    this.collection.set(
      document.uri,
      warnings.map((w) => {
        const diagnostic = new vscode.Diagnostic(document.lineAt(w.line).range, w.message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = 'SDD Studio';
        return diagnostic;
      }),
    );
  }

  dispose(): void {
    this.subscriptions.forEach((s) => s.dispose());
    this.collection.dispose();
  }
}
```

`src/ui/taskCommands.ts`:

```ts
import * as vscode from 'vscode';
import { nextPhasePrompt, runTaskPrompt } from '../copilot/prompts';
import { SpecError } from '../specs/errors';
import { DocKind } from '../specs/phase';
import { findRequirementLine } from '../specs/requirements';
import { parseTasks } from '../specs/tasks';
import { CommandDeps } from './specCommands';

async function guarded(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof SpecError) {
      void vscode.window.showErrorMessage(`SDD Studio: ${e.message}`);
      return;
    }
    throw e;
  }
}

function folderArg(deps: CommandDeps, folder: string): string | undefined {
  return deps.store.folders().length > 1 ? folder : undefined;
}

export function registerTaskCommands(deps: CommandDeps): vscode.Disposable {
  const runTask = (folder: string, spec: string, taskId: string) =>
    guarded(async () => {
      if (!vscode.workspace.isTrusted) {
        void vscode.window.showWarningMessage('SDD Studio: confía en este workspace para ejecutar tareas.');
        return;
      }
      await deps.service.setTaskStatus({ folder, spec, taskId, status: 'in_progress' });
      const wsFolder = await deps.store.resolveFolder(spec, folder, true);
      const snap = await deps.store.snapshot(wsFolder, spec);
      const text = (await deps.store.readText(deps.store.docUri(wsFolder, spec, 'tasks'))) ?? '';
      const task = parseTasks(text).tasks.find((t) => t.id === taskId)!;
      await deps.getBridge().openAgent(
        'sdd-implement',
        runTaskPrompt({
          specsFolder: deps.store.specsFolder,
          spec,
          folder: folderArg(deps, folder),
          type: snap.type,
          task: { id: task.id, title: task.title, requirements: task.requirements },
        }),
      );
    });

  const markTaskDone = (folder: string, spec: string, taskId: string) =>
    guarded(async () => {
      const message = await deps.service.setTaskStatus({ folder, spec, taskId, status: 'done' });
      void vscode.window.showInformationMessage(`SDD Studio: ${message}`);
    });

  const approveAndContinue = (folder: string, spec: string, kind: DocKind) =>
    guarded(async () => {
      await deps.service.approvePhase({ folder, spec, doc: kind });
      const next = nextPhasePrompt({ spec, folder: folderArg(deps, folder), approved: kind });
      if (next) {
        await deps.getBridge().openAgent(next.agent, next.prompt);
      } else {
        void vscode.window.showInformationMessage('SDD Studio: tareas aprobadas. Usa ▶ Ejecutar tarea en tasks.md.');
      }
    });

  const openRequirements = (folder: string, spec: string, reqIds: string[]) =>
    guarded(async () => {
      const wsFolder = await deps.store.resolveFolder(spec, folder, true);
      const snap = await deps.store.snapshot(wsFolder, spec);
      const uri = deps.store.docUri(wsFolder, spec, snap.type === 'bugfix' ? 'bugfix' : 'requirements');
      const document = await vscode.workspace.openTextDocument(uri);
      const line = reqIds[0] ? (findRequirementLine(document.getText(), reqIds[0]) ?? 0) : 0;
      const position = new vscode.Position(line, 0);
      await vscode.window.showTextDocument(document, { selection: new vscode.Range(position, position) });
    });

  return vscode.Disposable.from(
    vscode.commands.registerCommand('sddStudio.runTask', runTask),
    vscode.commands.registerCommand('sddStudio.markTaskDone', markTaskDone),
    vscode.commands.registerCommand('sddStudio.approveAndContinue', approveAndContinue),
    vscode.commands.registerCommand('sddStudio.openRequirements', openRequirements),
  );
}
```

`src/extension.ts`: a `activate` de la Tarea 9 añádele los imports y registros siguientes. Las demás líneas no cambian.

```ts
import { TaskDiagnostics } from './ui/diagnostics';
import { registerTaskCommands } from './ui/taskCommands';
import { SpecLensProvider } from './ui/taskLens';
```

```ts
  const lensProvider = new SpecLensProvider(store);
  context.subscriptions.push(
    lensProvider,
    vscode.languages.registerCodeLensProvider({ language: 'markdown', scheme: 'file' }, lensProvider),
    registerTaskCommands(deps),
    new TaskDiagnostics(store),
  );
```

Coloca este bloque justo después del `context.subscriptions.push(...)` existente.

En `package.json`, añade a `contributes.commands`:

```json
{ "command": "sddStudio.runTask", "title": "Ejecutar tarea", "category": "SDD Studio", "enablement": "isWorkspaceTrusted" },
{ "command": "sddStudio.markTaskDone", "title": "Marcar tarea hecha", "category": "SDD Studio" },
{ "command": "sddStudio.approveAndContinue", "title": "Aprobar y continuar", "category": "SDD Studio" },
{ "command": "sddStudio.openRequirements", "title": "Ver requisitos", "category": "SDD Studio" }
```

y a `contributes.menus`:

```json
"commandPalette": [
  { "command": "sddStudio.runTask", "when": "false" },
  { "command": "sddStudio.markTaskDone", "when": "false" },
  { "command": "sddStudio.approveAndContinue", "when": "false" },
  { "command": "sddStudio.openRequirements", "when": "false" }
]
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:integration`
Expected: PASS. La integración da `23 passing`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): CodeLens de fases y tareas, comandos de tarea y avisos en tasks.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Agentes SDD y prompt files

**Files:**
- Create: `agents/sdd-requirements.agent.md`, `agents/sdd-design.agent.md`, `agents/sdd-tasks.agent.md`, `agents/sdd-implement.agent.md`, `agents/sdd-steering.agent.md`
- Create: `prompts/spec-new.prompt.md`, `prompts/spec-bugfix.prompt.md`, `prompts/spec-run.prompt.md`, `prompts/spec-steering.prompt.md`
- Modify: `package.json`: añadir `contributes.chatAgents` y `contributes.chatPromptFiles`
- Test: `test/unit/manifest.test.ts`

**Interfaces:**
- Consumes:
  - Los nombres de herramientas de la Tarea 7.
  - Los ids de toolsets integrados de la fila 5 de `docs/spike-findings.md`. Los archivos de abajo suponen `search`, `read`, `edit` y `execute`; si el spike dio otros, sustitúyelos en los cinco agentes.
  - Los ids de herramientas de extensión de la fila 4. Abajo se usa el `toolReferenceName`.
- Produces: los agentes `sdd-*` y los prompts `/spec-*` disponibles en Copilot Chat.

- [ ] **Step 1: Escribir el test de manifiesto, que debe fallar**

`test/unit/manifest.test.ts`:

```ts
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { frontMatterFields } from '../../src/specs/frontMatter';

const root = join(__dirname, '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const AGENTS = ['sdd-requirements', 'sdd-design', 'sdd-tasks', 'sdd-implement', 'sdd-steering'];

describe('manifiesto', () => {
  it('registra los 5 agentes y sus archivos existen con name correcto', () => {
    const paths: string[] = pkg.contributes.chatAgents.map((a: { path: string }) => a.path);
    expect(paths).toHaveLength(5);
    for (const name of AGENTS) {
      const file = join(root, 'agents', `${name}.agent.md`);
      expect(paths).toContain(`./agents/${name}.agent.md`);
      expect(existsSync(file)).toBe(true);
      expect(frontMatterFields(readFileSync(file, 'utf8')).get('name')).toBe(name);
    }
  });

  it('los handoffs apuntan a agentes existentes', () => {
    for (const name of AGENTS) {
      const text = readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8');
      for (const match of text.matchAll(/^\s+agent: (\S+)$/gm)) expect(AGENTS).toContain(match[1]);
    }
  });

  it('los agentes de fase no tienen la herramienta de edición genérica', () => {
    for (const name of ['sdd-requirements', 'sdd-design', 'sdd-tasks']) {
      const tools = frontMatterFields(readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8')).get('tools')!;
      expect(tools).toContain('writeSpecDoc');
      expect(tools).not.toMatch(/'edit'/);
    }
  });

  it('registra los 4 prompt files y existen', () => {
    const paths: string[] = pkg.contributes.chatPromptFiles.map((p: { path: string }) => p.path);
    expect(paths.sort()).toEqual(
      ['spec-bugfix', 'spec-new', 'spec-run', 'spec-steering'].map((n) => `./prompts/${n}.prompt.md`),
    );
    paths.forEach((p) => expect(existsSync(join(root, p))).toBe(true));
  });

  it('cada herramienta registrada en código está declarada en el manifiesto', () => {
    const names = pkg.contributes.languageModelTools.map((t: { name: string }) => t.name);
    expect(names).toEqual(['sdd_writeSpecDoc', 'sdd_approvePhase', 'sdd_setTaskStatus']);
  });
});
```

- [ ] **Step 2: Ejecutar el test para ver que falla**

Run: `npx vitest run test/unit/manifest.test.ts`
Expected: FAIL. `pkg.contributes.chatAgents` es `undefined`.

- [ ] **Step 3: Escribir los agentes**

`agents/sdd-requirements.agent.md`:

````markdown
---
name: sdd-requirements
description: SDD Studio — redacta los requisitos (EARS) o el reporte de bug de un spec. No escribe código.
tools: ['search', 'read', 'writeSpecDoc', 'approvePhase']
handoffs:
  - label: "✓ Aprobar requisitos → Diseño"
    agent: sdd-design
    prompt: "Apruebo el documento de requisitos (o bugfix.md) de este spec. Primero llama a approvePhase para ese documento y después redacta design.md."
    send: true
  - label: "✎ Refinar requisitos"
    agent: sdd-requirements
    prompt: "Quiero refinar los requisitos. Hazme las preguntas que falten, una a la vez, y después reescribe el documento."
    send: false
---
Eres el agente de **requisitos** de SDD Studio. Tu única salida es un documento de spec; nunca escribes ni modificas código.

## Cómo trabajas
1. Lee el steering del proyecto (`.github/instructions/`) y el código relevante para entender el contexto.
2. Si la descripción es ambigua, haz como máximo 3 preguntas, **una por mensaje**, antes de escribir.
3. Escribe el documento con la herramienta `writeSpecDoc` (doc = `requirements` para una feature, `bugfix` para un bug). No edites archivos de ninguna otra forma.
4. Termina con un resumen corto: número de requisitos/criterios y dudas abiertas. Recuerda al usuario que puede aprobar con el botón.
5. Llama a `approvePhase` solo si el usuario aprueba explícitamente en el chat.

## Formato de requirements.md
```
# Requisitos — <spec>

## Introducción
## Glosario
## Requisitos
### Requisito N: <título>
**Historia:** Como <rol>, quiero <capacidad>, para <beneficio>.
#### Criterios de aceptación
1. WHEN <condición> THE SYSTEM SHALL <comportamiento>.
2. IF <condición> THEN THE SYSTEM SHALL <comportamiento>.
3. WHILE <estado> THE SYSTEM SHALL <comportamiento>.
4. THE SYSTEM SHALL NOT <comportamiento>.
```
- Cada criterio es verificable con un test. Numera requisitos y criterios: otros documentos los citan como `N.M`.
- Las palabras clave EARS van siempre en inglés; el resto en el idioma que te pidan.

## Formato de bugfix.md
```
# Bug — <spec>

## Comportamiento actual (defecto)
1. WHEN <condición> THEN the system <comportamiento incorrecto>.
## Comportamiento esperado
1. WHEN <condición> THEN the system <comportamiento correcto>.
## Comportamiento que no debe cambiar (regresión)
1. WHEN <condición> THEN the system <comportamiento que se conserva>.
```
````

`agents/sdd-design.agent.md`:

````markdown
---
name: sdd-design
description: SDD Studio — redacta design.md a partir de requisitos aprobados y del código existente. No escribe código.
tools: ['search', 'read', 'writeSpecDoc', 'approvePhase']
handoffs:
  - label: "✓ Aprobar diseño → Tareas"
    agent: sdd-tasks
    prompt: "Apruebo design.md de este spec. Primero llama a approvePhase con doc=design y después redacta tasks.md."
    send: true
  - label: "✎ Refinar diseño"
    agent: sdd-design
    prompt: "Quiero ajustar el diseño. Pregúntame lo que necesites, una cosa a la vez, y reescribe design.md."
    send: false
---
Eres el agente de **diseño** de SDD Studio. Tu única salida es `design.md`; nunca escribes ni modificas código.

## Cómo trabajas
1. Si el mensaje dice que el usuario aprobó el documento anterior, llama primero a `approvePhase` con ese documento (`requirements` o `bugfix`).
2. Lee el documento de requisitos (o bugfix.md), el steering y el código afectado.
3. Escribe `design.md` con `writeSpecDoc` (doc = `design`).
4. Termina con un resumen de las decisiones principales y lo que queda abierto.

## Formato de design.md
```
# Diseño — <spec>

## Resumen
## Arquitectura          (diagrama Mermaid si ayuda)
## Componentes e interfaces
## Modelos de datos
## Manejo de errores
## Estrategia de tests
## Archivos a crear o modificar   (tabla: archivo | cambio)
## Alternativas consideradas
```
- Para un bugfix, añade **## Causa raíz** justo después del resumen, con la evidencia que la demuestra.
- Cita los requisitos por su número (`Requisito 2`, criterio `2.3`).
````

`agents/sdd-tasks.agent.md`:

````markdown
---
name: sdd-tasks
description: SDD Studio — divide el diseño aprobado en tareas pequeñas y trazables (tasks.md). No escribe código.
tools: ['search', 'read', 'writeSpecDoc', 'approvePhase']
handoffs:
  - label: "✓ Aprobar tareas → Implementar"
    agent: sdd-implement
    prompt: "Apruebo tasks.md de este spec. Llama a approvePhase con doc=tasks. Después dime cuál es la primera tarea pendiente y espera: la ejecutaré con ▶ Ejecutar tarea o te pediré empezar."
    send: true
  - label: "✎ Refinar tareas"
    agent: sdd-tasks
    prompt: "Quiero ajustar el plan de tareas. Dime qué cambiarías y reescribe tasks.md."
    send: false
---
Eres el agente de **tareas** de SDD Studio. Tu única salida es `tasks.md`; nunca escribes ni modificas código.

## Cómo trabajas
1. Si el mensaje dice que el usuario aprobó design.md, llama primero a `approvePhase` con doc = `design`.
2. Lee requisitos (o bugfix.md) y diseño.
3. Escribe `tasks.md` con `writeSpecDoc` (doc = `tasks`).

## Formato de tasks.md
```
# Plan de implementación — <spec>

- [ ] 1. <tarea>
  - <detalle concreto: archivos, comportamiento, test>
  - _Requisitos: 1.1, 1.2_
- [ ] 2. <tarea padre>
  - [ ] 2.1 <subtarea>
    - _Requisitos: 2.3_
- [ ]* 3. <tarea opcional>
```
- Cada tarea hoja cabe en una sesión: un cambio con su test.
- Cada tarea hoja termina con `_Requisitos: …_` citando los criterios que cubre. Todo criterio debe quedar cubierto por al menos una tarea.
- Orden: primero lo que otras tareas necesitan. Para un bugfix, la primera tarea es un test que reproduce el bug.
- Marca con `*` (justo después de `]`) solo lo que de verdad es opcional.
````

`agents/sdd-implement.agent.md`:

```markdown
---
name: sdd-implement
description: SDD Studio — implementa UNA tarea de tasks.md con tests y verificación.
tools: ['search', 'read', 'edit', 'execute', 'setTaskStatus']
handoffs:
  - label: "✓ Marcar hecha → siguiente"
    agent: sdd-implement
    prompt: "Confirmo que la tarea que acabas de implementar está hecha. Llama a setTaskStatus con status=done para esa tarea. Después busca la siguiente tarea hoja pendiente en tasks.md, márcala in_progress con setTaskStatus e impleméntala."
    send: true
  - label: "↺ Revisar contra requisitos"
    agent: sdd-implement
    prompt: "Revisa la implementación de esta tarea contra sus criterios de aceptación y el diseño. Lista cualquier hueco y propón cómo cerrarlo."
    send: true
---
Eres el agente de **implementación** de SDD Studio. Implementas exactamente **una** tarea por turno.

## Cómo trabajas
1. Lee la tarea, los criterios que cita (`_Requisitos: …_`) y las secciones del diseño relacionadas.
2. Escribe primero un test que falle por la razón correcta; después el código mínimo para que pase.
3. Ejecuta los tests y el lint del proyecto y muestra el resultado real.
4. Termina con: archivos cambiados, tests ejecutados y su resultado, y cómo se cumplen los criterios.
5. **No** marques la tarea como hecha tú mismo: el usuario lo confirma con el botón "✓ Marcar hecha". Solo llama a `setTaskStatus` con `done` cuando el mensaje del usuario lo confirme.
6. Si la tarea no se puede completar (diseño incorrecto, dependencia faltante), detente y explica qué cambiarías en el spec.
```

`agents/sdd-steering.agent.md`:

````markdown
---
name: sdd-steering
description: SDD Studio — genera o actualiza el steering del proyecto (product, tech, structure) en .github/instructions/.
tools: ['search', 'read', 'edit']
---
Eres el agente de **steering** de SDD Studio. Solo creas o editas archivos dentro de `.github/instructions/`; no toques ningún otro archivo.

Genera o actualiza:
- `product.instructions.md`: propósito, usuarios, objetivos, glosario del negocio.
- `tech.instructions.md`: stack, librerías clave, comandos de build/test/lint, restricciones técnicas.
- `structure.instructions.md`: organización de carpetas, convenciones de nombres, patrones de arquitectura.

Cada archivo empieza con este front matter:
```
---
applyTo: "**"
description: <una línea>
---
```
Usa `applyTo` con un glob más específico solo si la guía aplica a un tipo de archivo (por ejemplo `"**/*.tsx"`). Basa todo en lo que ves en el repo; si algo no se puede deducir, déjalo como pregunta al final de tu respuesta, no lo inventes.
````

Los prompt files son los siguientes.

`prompts/spec-new.prompt.md`:

```markdown
---
name: spec-new
description: SDD Studio — crear un spec de feature
agent: sdd-requirements
argument-hint: <qué quieres construir>
---
Crea un spec de **feature** para lo siguiente: ${input:descripcion}
Elige un nombre kebab-case corto para el spec y escribe requirements.md con writeSpecDoc.
```

`prompts/spec-bugfix.prompt.md`:

```markdown
---
name: spec-bugfix
description: SDD Studio — crear un spec de bugfix
agent: sdd-requirements
argument-hint: <qué falla y cómo se reproduce>
---
Crea un spec de **bugfix** para este problema: ${input:descripcion}
Elige un nombre kebab-case corto para el spec y escribe bugfix.md con writeSpecDoc.
```

`prompts/spec-run.prompt.md`:

```markdown
---
name: spec-run
description: SDD Studio — ejecutar una tarea de un spec
agent: sdd-implement
argument-hint: <spec> <id de tarea>
---
Ejecuta esta tarea: ${input:tarea}
Primero márcala in_progress con setTaskStatus. Lee requisitos, diseño y tasks.md del spec e implementa solo esa tarea.
```

`prompts/spec-steering.prompt.md`:

```markdown
---
name: spec-steering
description: SDD Studio — generar o actualizar el steering del proyecto
agent: sdd-steering
---
Analiza este repositorio y genera o actualiza product.instructions.md, tech.instructions.md y structure.instructions.md en .github/instructions/.
```

En `package.json`, añade dentro de `contributes` (con los campos que confirmó la fila 2 del spike):

```json
"chatAgents": [
  { "path": "./agents/sdd-requirements.agent.md" },
  { "path": "./agents/sdd-design.agent.md" },
  { "path": "./agents/sdd-tasks.agent.md" },
  { "path": "./agents/sdd-implement.agent.md" },
  { "path": "./agents/sdd-steering.agent.md" }
],
"chatPromptFiles": [
  { "path": "./prompts/spec-new.prompt.md" },
  { "path": "./prompts/spec-bugfix.prompt.md" },
  { "path": "./prompts/spec-run.prompt.md" },
  { "path": "./prompts/spec-steering.prompt.md" }
]
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run && npm run test:integration`
Expected: PASS. El manifiesto da 5 tests verdes y la integración sigue en `23 passing`.

- [ ] **Step 5: Comprobación manual rápida**

Run: `code --extensionDevelopmentPath=$(pwd) test/fixtures/workspace`. Antes ejecuta `npm run build` y abre la carpeta del fixture tras un test, o copia `test/fixtures/pristine/*` a una carpeta temporal.
Expected:
- En el selector de agentes de Copilot Chat aparecen `sdd-requirements` … `sdd-steering`.
- Al escribir `/spec-` en el chat aparecen los cuatro prompts.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(agents): agentes SDD con handoffs y prompt files /spec-*

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Diagnóstico ("SDD Studio: Diagnóstico")

**Files:**
- Create: `src/doctor/checks.ts`, `src/doctor/doctor.ts`
- Modify: `src/extension.ts`: añadir el registro
- Modify: `package.json`: añadir el comando `sddStudio.doctor`
- Test: `test/unit/doctor/checks.test.ts`

**Interfaces:**
- Consumes: el setting de la fila 7 de `docs/spike-findings.md`.
- Produces:
  - `interface DoctorEnv { vscodeVersion: string; minVersion: string; copilotChatInstalled: boolean; githubSignedIn: boolean; agentModeEnabled: boolean; extensionToolsEnabled: boolean; strictPluginOnly: boolean }`
  - `interface CheckResult { id: string; ok: boolean; severity: 'error' | 'warning'; message: string; action?: string }`
  - `runChecks(env: DoctorEnv): CheckResult[]`
  - `compareVersions(a: string, b: string): number`
  - `registerDoctor(context: vscode.ExtensionContext): vscode.Disposable`
  - `runDoctorOnce(context: vscode.ExtensionContext): Promise<void>`

- [ ] **Step 1: Escribir el test que falla**

`test/unit/doctor/checks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compareVersions, DoctorEnv, runChecks } from '../../../src/doctor/checks';

const healthy: DoctorEnv = {
  vscodeVersion: '1.140.0',
  minVersion: '1.140.0',
  copilotChatInstalled: true,
  githubSignedIn: true,
  agentModeEnabled: true,
  extensionToolsEnabled: true,
  strictPluginOnly: false,
};

describe('compareVersions', () => {
  it('compara numéricamente e ignora sufijos', () => {
    expect(compareVersions('1.140.0', '1.139.9')).toBeGreaterThan(0);
    expect(compareVersions('1.99.0', '1.140.0')).toBeLessThan(0);
    expect(compareVersions('1.140.0-insider', '1.140.0')).toBe(0);
  });
});

describe('runChecks', () => {
  it('todo bien', () => {
    expect(runChecks(healthy).every((c) => c.ok)).toBe(true);
  });
  it('cada problema da su check con acción', () => {
    const results = runChecks({
      ...healthy,
      vscodeVersion: '1.120.0',
      copilotChatInstalled: false,
      githubSignedIn: false,
      agentModeEnabled: false,
      extensionToolsEnabled: false,
      strictPluginOnly: true,
    });
    const failed = results.filter((c) => !c.ok);
    expect(failed.map((c) => c.id)).toEqual([
      'vscode-version',
      'copilot-chat',
      'github-session',
      'agent-mode',
      'extension-tools',
      'strict-policy',
    ]);
    expect(failed.every((c) => c.action)).toBe(true);
    expect(failed.find((c) => c.id === 'strict-policy')!.severity).toBe('warning');
    expect(failed.find((c) => c.id === 'copilot-chat')!.severity).toBe('error');
  });
});
```

- [ ] **Step 2: Ejecutar el test para ver que falla**

Run: `npx vitest run test/unit/doctor`
Expected: FAIL. El módulo no existe.

- [ ] **Step 3: Implementación**

`src/doctor/checks.ts`:

```ts
export interface DoctorEnv {
  vscodeVersion: string;
  minVersion: string;
  copilotChatInstalled: boolean;
  githubSignedIn: boolean;
  agentModeEnabled: boolean;
  extensionToolsEnabled: boolean;
  strictPluginOnly: boolean;
}

export interface CheckResult {
  id: string;
  ok: boolean;
  severity: 'error' | 'warning';
  message: string;
  action?: string;
}

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^[^\d]*/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function runChecks(env: DoctorEnv): CheckResult[] {
  const versionOk = compareVersions(env.vscodeVersion, env.minVersion) >= 0;
  return [
    {
      id: 'vscode-version',
      ok: versionOk,
      severity: 'error',
      message: versionOk ? `VS Code ${env.vscodeVersion}` : `VS Code ${env.vscodeVersion} es menor que la mínima (${env.minVersion}).`,
      action: versionOk ? undefined : 'Actualiza VS Code (Ayuda → Buscar actualizaciones).',
    },
    {
      id: 'copilot-chat',
      ok: env.copilotChatInstalled,
      severity: 'error',
      message: env.copilotChatInstalled ? 'GitHub Copilot Chat instalado' : 'GitHub Copilot Chat no está instalado.',
      action: env.copilotChatInstalled ? undefined : 'Instala la extensión "GitHub Copilot Chat".',
    },
    {
      id: 'github-session',
      ok: env.githubSignedIn,
      severity: 'warning',
      message: env.githubSignedIn ? 'Sesión de GitHub activa' : 'No detecté una sesión de GitHub.',
      action: env.githubSignedIn ? undefined : 'Inicia sesión en Copilot desde el icono de cuentas (abajo a la izquierda).',
    },
    {
      id: 'agent-mode',
      ok: env.agentModeEnabled,
      severity: 'error',
      message: env.agentModeEnabled ? 'Agent mode habilitado' : 'Agent mode está desactivado.',
      action: env.agentModeEnabled ? undefined : 'Activa "chat.agent.enabled" o pide a TI habilitar la política ChatAgentMode.',
    },
    {
      id: 'extension-tools',
      ok: env.extensionToolsEnabled,
      severity: 'error',
      message: env.extensionToolsEnabled ? 'Herramientas de extensiones permitidas' : 'Las herramientas de extensiones están bloqueadas.',
      action: env.extensionToolsEnabled
        ? undefined
        : 'Activa "chat.extensionTools.enabled" o pide a TI habilitar la política ChatAgentExtensionTools.',
    },
    {
      id: 'strict-policy',
      ok: !env.strictPluginOnly,
      severity: 'warning',
      message: env.strictPluginOnly
        ? 'La política ChatStrictPluginOnlyCustomization está activa: no se cargarán las instructions de steering de .github/instructions (ni, más adelante, los Powers del repo).'
        : 'Customizaciones de workspace permitidas',
      action: env.strictPluginOnly ? 'Pide a TI permitir customizaciones de workspace para SDD Studio.' : undefined,
    },
  ];
}
```

`src/doctor/doctor.ts`. Sustituye `STRICT_SETTING` por la clave de la fila 7 del spike:

```ts
import * as vscode from 'vscode';
import { CheckResult, DoctorEnv, runChecks } from './checks';

/** Fijado por el spike (docs/spike-findings.md, fila 7). */
const STRICT_SETTING = 'chat.strictPluginOnlyCustomization';
const RAN_FOR_KEY = 'sddStudio.doctorRanFor';

async function collectEnv(context: vscode.ExtensionContext): Promise<DoctorEnv> {
  const chat = vscode.workspace.getConfiguration('chat');
  let githubSignedIn = false;
  try {
    githubSignedIn = (await vscode.authentication.getSession('github', ['user:email'], { silent: true })) !== undefined;
  } catch {
    githubSignedIn = false;
  }
  const engines: string = context.extension.packageJSON.engines.vscode;
  return {
    vscodeVersion: vscode.version,
    minVersion: engines.replace(/^[^\d]*/, ''),
    copilotChatInstalled: vscode.extensions.getExtension('GitHub.copilot-chat') !== undefined,
    githubSignedIn,
    agentModeEnabled: chat.get<boolean>('agent.enabled', true),
    extensionToolsEnabled: chat.get<boolean>('extensionTools.enabled', true),
    strictPluginOnly: vscode.workspace.getConfiguration().get<boolean>(STRICT_SETTING, false),
  };
}

function report(channel: vscode.OutputChannel, results: CheckResult[]): void {
  channel.clear();
  channel.appendLine(`SDD Studio — Diagnóstico (${new Date().toLocaleString()})`);
  for (const r of results) {
    channel.appendLine(`${r.ok ? '✓' : r.severity === 'error' ? '✗' : '!'} ${r.message}`);
    if (r.action) channel.appendLine(`    → ${r.action}`);
  }
  const problems = results.filter((r) => !r.ok);
  if (problems.length === 0) {
    void vscode.window.showInformationMessage('SDD Studio: todo listo ✓');
    return;
  }
  void vscode.window
    .showWarningMessage(`SDD Studio: ${problems.length} problema(s) de configuración.`, 'Ver detalles')
    .then((pick) => {
      if (pick) channel.show();
    });
}

export function registerDoctor(context: vscode.ExtensionContext): vscode.Disposable {
  const channel = vscode.window.createOutputChannel('SDD Studio');
  const command = vscode.commands.registerCommand('sddStudio.doctor', async () => {
    report(channel, runChecks(await collectEnv(context)));
  });
  return vscode.Disposable.from(channel, command);
}

export async function runDoctorOnce(context: vscode.ExtensionContext): Promise<void> {
  const version: string = context.extension.packageJSON.version;
  if (context.globalState.get(RAN_FOR_KEY) === version) return;
  await context.globalState.update(RAN_FOR_KEY, version);
  await vscode.commands.executeCommand('sddStudio.doctor');
}
```

`src/extension.ts`: añade `import { registerDoctor, runDoctorOnce } from './doctor/doctor';`. En `activate`, añade `registerDoctor(context)` al primer `context.subscriptions.push(...)`, y justo antes del `return` añade `void runDoctorOnce(context);`.

En `package.json`, añade a `contributes.commands`:

```json
{ "command": "sddStudio.doctor", "title": "Diagnóstico", "category": "SDD Studio", "icon": "$(pulse)" }
```

y a `contributes.menus["view/title"]`:

```json
{ "command": "sddStudio.doctor", "when": "view == sddStudio.specs", "group": "navigation@3" }
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(doctor): diagnóstico de Copilot, agent mode y políticas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Tema "SDD Studio Dark" y oferta única de activarlo

**Files:**
- Create: `themes/sdd-studio-dark-color-theme.json`, `NOTICE`, `src/ui/themePrompt.ts`
- Modify: `src/extension.ts` y `package.json` (`contributes.themes`)
- Test: `test/unit/theme.test.ts`

**Interfaces:**
- Produces: `offerThemeOnce(context: vscode.ExtensionContext): Promise<void>`, y el tema con label `SDD Studio Dark`.

- [ ] **Step 1: Escribir el test que falla**

`test/unit/theme.test.ts`:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../..');

describe('tema', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  it('está registrado como SDD Studio Dark', () => {
    expect(pkg.contributes.themes).toEqual([
      { label: 'SDD Studio Dark', uiTheme: 'vs-dark', path: './themes/sdd-studio-dark-color-theme.json' },
    ]);
  });
  it('usa la paleta Kiro', () => {
    const theme = JSON.parse(readFileSync(join(root, 'themes/sdd-studio-dark-color-theme.json'), 'utf8'));
    expect(theme.colors['editor.background']).toBe('#211d25');
    expect(theme.colors['focusBorder']).toBe('#b080ff');
    expect(theme.colors['button.background']).toBe('#7138cc');
    expect(theme.tokenColors.length).toBeGreaterThan(5);
  });
  it('NOTICE da crédito al tema original', () => {
    expect(readFileSync(join(root, 'NOTICE'), 'utf8')).toContain('MohdZaid.kiro-theme');
  });
});
```

- [ ] **Step 2: Ejecutar el test para ver que falla**

Run: `npx vitest run test/unit/theme.test.ts`
Expected: FAIL. `contributes.themes` es `undefined`.

- [ ] **Step 3: Implementación**

`themes/sdd-studio-dark-color-theme.json`:

```json
{
  "$schema": "vscode://schemas/color-theme",
  "name": "SDD Studio Dark",
  "type": "dark",
  "colors": {
    "focusBorder": "#b080ff",
    "foreground": "#e8e3ef",
    "descriptionForeground": "#9a92a6",
    "errorForeground": "#ff7a90",
    "widget.shadow": "#00000066",
    "selection.background": "#7138cc80",
    "textLink.foreground": "#b080ff",
    "textLink.activeForeground": "#c9a6ff",
    "button.background": "#7138cc",
    "button.foreground": "#ffffff",
    "button.hoverBackground": "#8247e0",
    "button.secondaryBackground": "#3a3342",
    "button.secondaryForeground": "#e8e3ef",
    "badge.background": "#7138cc",
    "badge.foreground": "#ffffff",
    "activityBar.background": "#1a171e",
    "activityBar.foreground": "#b080ff",
    "activityBar.inactiveForeground": "#9a92a6",
    "activityBar.activeBorder": "#b080ff",
    "activityBarBadge.background": "#7138cc",
    "activityBarBadge.foreground": "#ffffff",
    "sideBar.background": "#1d1a21",
    "sideBar.foreground": "#d8d2e0",
    "sideBar.border": "#2f2936",
    "sideBarTitle.foreground": "#9a92a6",
    "sideBarSectionHeader.background": "#1d1a21",
    "sideBarSectionHeader.foreground": "#9a92a6",
    "list.activeSelectionBackground": "#b080ff2e",
    "list.activeSelectionForeground": "#ffffff",
    "list.inactiveSelectionBackground": "#b080ff1f",
    "list.hoverBackground": "#2a2530",
    "list.highlightForeground": "#b080ff",
    "editor.background": "#211d25",
    "editor.foreground": "#e8e3ef",
    "editorLineNumber.foreground": "#5c5466",
    "editorLineNumber.activeForeground": "#b080ff",
    "editorCursor.foreground": "#b080ff",
    "editor.selectionBackground": "#7138cc66",
    "editor.inactiveSelectionBackground": "#7138cc33",
    "editor.lineHighlightBackground": "#2a253080",
    "editor.findMatchBackground": "#b080ff55",
    "editor.findMatchHighlightBackground": "#b080ff2a",
    "editorIndentGuide.background1": "#2f2936",
    "editorIndentGuide.activeBackground1": "#5c5466",
    "editorWhitespace.foreground": "#3a3342",
    "editorBracketMatch.border": "#b080ff",
    "editorCodeLens.foreground": "#9a92a6",
    "editorWarning.foreground": "#ffd27a",
    "editorError.foreground": "#ff7a90",
    "editorGutter.addedBackground": "#80ffb5",
    "editorGutter.modifiedBackground": "#8dc8fb",
    "editorGutter.deletedBackground": "#ff7a90",
    "editorGroupHeader.tabsBackground": "#1a171e",
    "tab.activeBackground": "#211d25",
    "tab.activeForeground": "#ffffff",
    "tab.activeBorderTop": "#b080ff",
    "tab.inactiveBackground": "#1a171e",
    "tab.inactiveForeground": "#9a92a6",
    "tab.border": "#1a171e",
    "titleBar.activeBackground": "#1a171e",
    "titleBar.activeForeground": "#d8d2e0",
    "titleBar.inactiveBackground": "#1a171e",
    "statusBar.background": "#1a171e",
    "statusBar.foreground": "#9a92a6",
    "statusBar.border": "#2f2936",
    "statusBarItem.remoteBackground": "#7138cc",
    "statusBarItem.remoteForeground": "#ffffff",
    "panel.background": "#1d1a21",
    "panel.border": "#2f2936",
    "panelTitle.activeBorder": "#b080ff",
    "panelTitle.activeForeground": "#ffffff",
    "terminal.background": "#1d1a21",
    "terminal.foreground": "#e8e3ef",
    "terminal.ansiMagenta": "#b080ff",
    "terminal.ansiBrightMagenta": "#c9a6ff",
    "terminal.ansiGreen": "#80ffb5",
    "terminal.ansiBlue": "#8dc8fb",
    "terminal.ansiYellow": "#ffd27a",
    "terminal.ansiRed": "#ff7a90",
    "input.background": "#2a2530",
    "input.border": "#3a3342",
    "input.foreground": "#e8e3ef",
    "input.placeholderForeground": "#7a7286",
    "dropdown.background": "#2a2530",
    "dropdown.border": "#3a3342",
    "quickInput.background": "#1d1a21",
    "editorWidget.background": "#1d1a21",
    "editorWidget.border": "#3a3342",
    "scrollbarSlider.background": "#b080ff22",
    "scrollbarSlider.hoverBackground": "#b080ff44",
    "scrollbarSlider.activeBackground": "#b080ff66",
    "progressBar.background": "#b080ff",
    "notifications.background": "#1d1a21",
    "notificationLink.foreground": "#b080ff",
    "gitDecoration.addedResourceForeground": "#80ffb5",
    "gitDecoration.modifiedResourceForeground": "#8dc8fb",
    "gitDecoration.deletedResourceForeground": "#ff7a90",
    "gitDecoration.untrackedResourceForeground": "#80ffb5"
  },
  "tokenColors": [
    { "scope": ["comment", "punctuation.definition.comment"], "settings": { "foreground": "#7a7286", "fontStyle": "italic" } },
    { "scope": ["keyword", "storage.type", "storage.modifier", "keyword.control"], "settings": { "foreground": "#e2d3fe" } },
    { "scope": ["keyword.operator"], "settings": { "foreground": "#c9a6ff" } },
    { "scope": ["entity.name.function", "support.function", "meta.function-call"], "settings": { "foreground": "#8dc8fb" } },
    { "scope": ["string", "string.quoted", "string.template"], "settings": { "foreground": "#80ffb5" } },
    { "scope": ["constant.numeric", "constant.language", "constant.character"], "settings": { "foreground": "#ffd27a" } },
    { "scope": ["entity.name.type", "entity.name.class", "support.type", "support.class"], "settings": { "foreground": "#b080ff" } },
    { "scope": ["variable", "meta.definition.variable"], "settings": { "foreground": "#e8e3ef" } },
    { "scope": ["variable.parameter"], "settings": { "foreground": "#f0c6ff" } },
    { "scope": ["entity.other.attribute-name", "support.type.property-name"], "settings": { "foreground": "#c9a6ff" } },
    { "scope": ["entity.name.tag"], "settings": { "foreground": "#b080ff" } },
    { "scope": ["markup.heading", "entity.name.section"], "settings": { "foreground": "#b080ff", "fontStyle": "bold" } },
    { "scope": ["markup.bold"], "settings": { "fontStyle": "bold" } },
    { "scope": ["markup.italic"], "settings": { "fontStyle": "italic" } },
    { "scope": ["markup.inline.raw", "markup.fenced_code"], "settings": { "foreground": "#80ffb5" } },
    { "scope": ["markup.underline.link"], "settings": { "foreground": "#8dc8fb" } },
    { "scope": ["invalid"], "settings": { "foreground": "#ff7a90" } }
  ]
}
```

`NOTICE`:

```
SDD Studio
Copyright (c) 2026 Enrique Cordero

El tema "SDD Studio Dark" está basado en la paleta de "Kiro Theme"
(Visual Studio Marketplace: MohdZaid.kiro-theme, https://github.com/BioHazard786/kiro-theme-vscode),
publicado bajo licencia MIT:

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software
  and associated documentation files (the "Software"), to deal in the Software without restriction,
  including without limitation the rights to use, copy, modify, merge, publish, distribute,
  sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or
  substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
```

Antes del commit, abre `https://github.com/BioHazard786/kiro-theme-vscode/blob/main/LICENSE`. Copia la línea `Copyright (c) <año> <autor>` del original justo encima de "Permission is hereby granted".

`src/ui/themePrompt.ts`:

```ts
import * as vscode from 'vscode';

const OFFERED_KEY = 'sddStudio.themeOffered';
export const THEME_LABEL = 'SDD Studio Dark';

export async function offerThemeOnce(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get(OFFERED_KEY)) return;
  if (vscode.workspace.getConfiguration('workbench').get<string>('colorTheme') === THEME_LABEL) return;
  await context.globalState.update(OFFERED_KEY, true);
  const pick = await vscode.window.showInformationMessage(`¿Activar el tema ${THEME_LABEL}?`, 'Activar', 'Ahora no');
  if (pick === 'Activar') {
    await vscode.workspace.getConfiguration('workbench').update('colorTheme', THEME_LABEL, vscode.ConfigurationTarget.Global);
  }
}
```

`src/extension.ts`: añade `import { offerThemeOnce } from './ui/themePrompt';`, y justo antes del `return` añade `void offerThemeOnce(context);`.

En `package.json`, añade dentro de `contributes`:

```json
"themes": [
  { "label": "SDD Studio Dark", "uiTheme": "vs-dark", "path": "./themes/sdd-studio-dark-color-theme.json" }
]
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(theme): tema SDD Studio Dark con atribución y oferta única

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: CI, release del VSIX, README, ejemplo y checklist manual

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `README.md`, `docs/manual-checklist.md`
- Create: `examples/todo-app/package.json`, `examples/todo-app/src/todo.ts`, `examples/todo-app/README.md`

**Interfaces:**
- Consumes: todos los scripts de `package.json`.
- Produces: el `.vsix` instalable y el proceso de release por tag.

- [ ] **Step 1: Workflows**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: xvfb-run -a npm run test:integration
```

`.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    tags: ['v*']
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run test:unit
      - run: npx vsce package --no-dependencies -o "sdd-studio-${GITHUB_REF_NAME#v}.vsix"
      - run: gh release create "$GITHUB_REF_NAME" sdd-studio-*.vsix --generate-notes
        env:
          GH_TOKEN: ${{ github.token }}
```

- [ ] **Step 2: README, ejemplo y checklist**

`README.md`:

````markdown
# SDD Studio

Spec-Driven Development estilo Kiro para VS Code, con GitHub Copilot.

## Instalar
1. Descarga `sdd-studio-<versión>.vsix` del último Release interno.
2. `code --install-extension sdd-studio-<versión>.vsix`
3. Ejecuta **SDD Studio: Diagnóstico** y resuelve lo que indique.

Requisitos: VS Code ≥ la versión de `engines.vscode`, GitHub Copilot Chat con sesión iniciada y agent mode habilitado.

## Flujo
1. Panel **SDD Studio → Specs → Nuevo spec** (feature o bugfix).
2. `sdd-requirements` escribe `specs/<spec>/requirements.md`. Revisa y pulsa **✓ Aprobar requisitos → Diseño** (o la CodeLens "✓ Aprobar y continuar").
3. `sdd-design` escribe `design.md` → apruebas → `sdd-tasks` escribe `tasks.md` → apruebas.
4. En `tasks.md`, pulsa **▶ Ejecutar tarea** en cada tarea. Al terminar, **✓ Marcar hecha**.

Steering del proyecto: **Generar steering** (crea `.github/instructions/{product,tech,structure}.instructions.md`).

## Formato
- Front matter de cada documento: `status: draft | approved`.
- Tareas: `[ ]` pendiente, `[-]` en curso, `[x]` hecha, `[ ]*` opcional; `_Requisitos: 1.1, 2.3_` para trazabilidad.

## Desarrollo
```bash
npm ci
npm run test:unit
npm run test:integration
npm run package      # genera el .vsix
```
Publicar: `git tag v0.1.0 && git push --tags` (el workflow Release adjunta el `.vsix`).

## Créditos
Ver `NOTICE`.
````

`examples/todo-app/package.json`:

```json
{
  "name": "todo-app-example",
  "private": true,
  "scripts": { "test": "vitest run" },
  "devDependencies": { "vitest": "*", "typescript": "*" }
}
```

`examples/todo-app/src/todo.ts`:

```ts
export interface Todo {
  id: number;
  title: string;
  done: boolean;
}

const todos: Todo[] = [];

export function addTodo(title: string): Todo {
  const todo = { id: todos.length + 1, title, done: false };
  todos.push(todo);
  return todo;
}

export function listTodos(): Todo[] {
  return [...todos];
}
```

`examples/todo-app/README.md`:

```markdown
# todo-app (ejemplo para SDD Studio)

Repo mínimo para probar el flujo completo a mano. Sigue `docs/manual-checklist.md` del repo de SDD Studio.
Feature sugerida: "Marcar tareas como completadas y filtrar por estado".
```

`docs/manual-checklist.md`:

```markdown
# Checklist manual (antes de cada release)

Abrir `examples/todo-app` en una ventana con el `.vsix` instalado y Copilot con sesión iniciada.

- [ ] El Diagnóstico dice "todo listo" (o solo avisos esperados).
- [ ] La primera activación pregunta una vez por el tema; "Activar" aplica SDD Studio Dark.
- [ ] Nuevo spec (feature) → se abre Copilot con `sdd-requirements` y el prompt.
- [ ] `sdd-requirements` escribe `specs/<spec>/requirements.md` con front matter `status: draft`, criterios EARS numerados y sin tocar otros archivos.
- [ ] Botón "✓ Aprobar requisitos → Diseño": requirements queda `approved`, `sdd-design` escribe `design.md` con todas las secciones.
- [ ] Aprobar diseño → `sdd-tasks` escribe `tasks.md` con `_Requisitos: …_` en cada hoja.
- [ ] Aprobar tareas → aparecen "▶ Ejecutar tarea" en cada hoja.
- [ ] "▶ Ejecutar tarea" marca `[-]` y `sdd-implement` implementa solo esa tarea con tests ejecutados.
- [ ] "✓ Marcar hecha → siguiente" marca `[x]` y continúa con la siguiente.
- [ ] Editar requirements.md aprobado vía agente devuelve design y tasks a borrador.
- [ ] Nuevo spec (bugfix) → `bugfix.md` con las tres secciones; diseño incluye "Causa raíz".
- [ ] Generar steering crea los tres `.instructions.md` con `applyTo`.
- [ ] Workspace no confiable: "Nuevo spec" y "Ejecutar tarea" desactivados.
- [ ] `/spec-new`, `/spec-bugfix`, `/spec-run`, `/spec-steering` aparecen en el chat.
```

- [ ] **Step 3: Generar el VSIX en local**

Run: `npm run package`
Expected: se crea `sdd-studio-0.1.0.vsix` sin preguntas interactivas. Revisa el listado de archivos: no debe haber `src/`, `test/` ni `node_modules/`.

- [ ] **Step 4: Instalar y hacer la prueba de humo**

Run: `code --install-extension sdd-studio-0.1.0.vsix --force`
Expected: tras recargar VS Code aparece el icono ⚡ "SDD Studio" y el comando "SDD Studio: Diagnóstico".

- [ ] **Step 5: Verificación final completa**

Run: `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: CI, release del VSIX, README, ejemplo y checklist manual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Cobertura del spec

| Sección del spec | Tarea |
|---|---|
| 1 Objetivo / 2 Alcance | Todas; lo que queda fuera de alcance no tiene tarea |
| 3.1 Repositorios | 1, 14 |
| 3.2 Módulos | 3–13 (un módulo por tarea, según la tabla de estructura) |
| 4.1 Estructura y `specsFolder` | 2 (setting), 6 |
| 4.2 Front matter | 3 |
| 4.3 Tipo, fase y progreso | 4, 5, 6 |
| 4.4–4.6 Formatos de requisitos, bugfix y diseño | 11 (agentes) |
| 4.7 tasks.md | 4 |
| 5 Agentes y prompt files | 11 |
| 6 Herramientas | 7 |
| 7 UI | 9, 10 |
| 8 Integración con Copilot | 1 (spike), 8 |
| 9 Diagnóstico y políticas | 12 |
| 10 Tema | 13 |
| 11 Tests | 2–13; checklist manual en 14 |
| 12 Build y distribución | 2, 14 |
| 13 Spike | 1 |
| 14 Preguntas abiertas | No bloquean. El nombre se cambia en `package.json` y el remoto de GitHub se añade al publicar |
