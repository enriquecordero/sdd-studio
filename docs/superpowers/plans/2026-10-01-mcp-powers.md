# SDD Studio · Powers con MCP (Spec 3) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un Power pueda traer servidores MCP además de su skill: se activan por repo desde la galería, se fusionan en `.vscode/mcp.json` sin secretos, los de nube arrancan en solo lectura y el diagnóstico explica los bloqueos de la organización; con 7 Powers nuevos y la versión 0.5.0.

**Architecture:**
- **Núcleo puro nuevo** en `src/powers/mcp/` (sin `vscode`): `spec.ts` (tipos y validación de `mcp.vscode.json`), `mcpJson.ts` (edición JSONC de `.vscode/mcp.json` con `jsonc-parser`), `policy.ts`, `gitignore.ts`, `messages.ts` y `prereqs.ts` (solo `fs`).
- **Datos versionados:** catálogo `schemaVersion: 2` (el v1 se sigue publicando sin Powers MCP) y lock v2 (solo si hay algún Power con MCP).
- **Capa VS Code:** el instalador amplía activar / actualizar / desactivar y añade `setMode`, todo con un único `planMcp` que calcula el nuevo `.vscode/mcp.json` antes de tocar nada. El servicio, los comandos, la galería y el diagnóstico se apoyan en él.

**Tech Stack:** TypeScript 6, esbuild, vitest, `@vscode/test-electron` + mocha, `tsx` (scripts) y la dependencia nueva `jsonc-parser` (MIT, de Microsoft).

**Spec:** `docs/superpowers/specs/2026-10-01-mcp-powers-design.md`. Depende del Spec 2 (`docs/superpowers/specs/2026-10-01-powers-design.md`) y de su plan (`docs/superpowers/plans/2026-10-01-powers.md`).

## Global Constraints

### Repositorio y entorno

- **Repo:** `/Users/enriquecordero/Documents/sdd-studio`, rama `feat/mcp-powers`. Todas las rutas son relativas a esa carpeta.
- **npm:** el registro por defecto de la máquina tiene un token caducado. Toda orden `npm` o `npx` que descargue paquetes se ejecuta con `npm_config_registry=https://registry.npmjs.org/`.
- **Commits:** cada commit termina con una línea en blanco y `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **VS Code:** `engines.vscode` sigue en `^1.140.0`. No se sube `@types/vscode`.
- **Comandos de verificación del repo:**

  | Qué | Orden |
  |---|---|
  | Tests unitarios | `npx vitest run` (o `npx vitest run <archivo>`) |
  | Lint | `npm run lint` |
  | Tipos | `npm run typecheck` |
  | Catálogo | `npm run build:catalog -- --check` |
  | Web | `npm run build:site` |
  | Integración (VS Code real) | `npm run test:integration` |

### Código

- **Módulos puros, sin importar `vscode`** (ESLint lo verifica): los de siempre y todo `src/powers/mcp/**/*.ts`. `prereqs.ts` usa `fs`, pero nunca ejecuta nada.
- **Ids de comando:** prefijo `sddStudio.` como el resto del repo. El comando nuevo es `sddStudio.setPowerMode` (el spec lo llama `sdd.setPowerMode`; se sigue la convención del repo).
- **Tests de integración:** no usar `instanceof` con clases de error que crucen el bundle. Comparar `.code`, `.name` o los textos.
- **Idioma:** textos de UI, mensajes, `presentation.json`, `plugin.json.description` y `mcp.vscode.json` (`credentials`, `example`, `warning`, descripciones de `inputs`) en español. El cuerpo de cada `SKILL.md` en inglés; su `description` en una línea, con disparadores en inglés y en español, de 1024 caracteres como máximo, y sin `FORBIDDEN_TERMS` (`mcp__`, `TodoWrite`, `Claude Code`, `Cursor`, nombres de modelo…).

### Servidores MCP

| Regla | Valor exacto |
|---|---|
| Nombre de servidor | `^sdd-[a-z0-9-]+$` |
| Id de input | `^sdd_[a-z0-9_]+$` |
| Transporte | `type` ∈ `stdio` \| `http`; si es `http`, la `url` empieza por `https://` |
| Versiones | prohibido `@latest`; con `npx`/`uvx`, el primer argumento que no empieza por `-` termina en `@<semver>` (admite prerelease) |
| Secretos | nunca en el repo: se rechaza `ghp_`, `gho_`, `github_pat_`, `AKIA`, `xox` y `Bearer ` no seguido de `${input:`. Solo `${input:sdd_…}` u OAuth de VS Code |
| `approxTools` | entero > 0 por servidor; aviso si la suma de los activos pasa de 100 (límite de Copilot: 128 por petición) |

| Power | Servidor | Definición en modo por defecto |
|---|---|---|
| `github-mcp` | `sdd-github` | `{"type":"http","url":"https://api.githubcopilot.com/mcp/readonly","headers":{"X-MCP-Toolsets":"repos,issues,pull_requests,actions"}}` (Operar: `url` → `https://api.githubcopilot.com/mcp/`) |
| `playwright-mcp` | `sdd-playwright` | `{"type":"stdio","command":"npx","args":["-y","@playwright/mcp@0.0.83","--headless","--isolated"]}` |
| `context7` | `sdd-context7` | `{"type":"http","url":"https://mcp.context7.com/mcp"}` (remoto: no se usa el paquete `@upstash/context7-mcp`) |
| `microsoft-learn` | `sdd-mslearn` | `{"type":"http","url":"https://learn.microsoft.com/api/mcp"}` |
| `aws-docs` | `sdd-awsdocs` | `{"type":"stdio","command":"uvx","args":["awslabs.aws-documentation-mcp-server@1.2.2"],"env":{"FASTMCP_LOG_LEVEL":"ERROR","AWS_DOCUMENTATION_PARTITION":"aws"}}` |
| `aws` | `sdd-aws` | `{"type":"stdio","command":"uvx","args":["awslabs.aws-api-mcp-server@1.5.6"],"env":{"AWS_REGION":"${input:sdd_aws_region}","AWS_API_MCP_PROFILE_NAME":"${input:sdd_aws_profile}","READ_OPERATIONS_ONLY":"true","AWS_API_MCP_ALLOW_UNRESTRICTED_LOCAL_FILE_ACCESS":"no-access"}}` (Operar: sin `READ_OPERATIONS_ONLY`, con `REQUIRE_MUTATION_CONSENT=true`) |
| `azure` | `sdd-azure` | `{"type":"stdio","command":"npx","args":["-y","@azure/mcp@3.0.0-beta.48","server","start","--read-only"]}` (Operar: sin `--read-only`; `beta: true`) |

### Rutas y formatos

| Concepto | Valor |
|---|---|
| Config MCP del repo | `.vscode/mcp.json` (JSONC: `servers` + `inputs`) |
| Lock | `.github/powers.lock.json`: `schemaVersion: 2` solo si algún Power tiene `mcp`; si no, `1` |
| Catálogo del VSIX | `dist/catalog.json` con `schemaVersion: 2` |
| Catálogos web | `powers/catalog-v2.json` (todos) y `powers/catalog.json` (`schemaVersion: 1`, sin Powers MCP) |
| URL online | `https://enriquecordero.github.io/sdd-studio/powers/catalog-v2.json` |
| Fuente de un Power MCP | `powers/<id>/` con `plugin.json`, `presentation.json`, `mcp.vscode.json`, `skills/<id>/SKILL.md`, `LICENSE` (MIT) y `UPSTREAM.md` |
| Categorías nuevas | `devcore` ("Dev core"), `docs` ("Documentación"), `cloud` ("Cloud"), en ese orden y después de las actuales |

### Decisiones tomadas al escribir el plan (el spec no las fijaba)

1. **Hash del catálogo:** `sha256 = powerHash({...files, "mcp.vscode.json": canonicalJson(mcp)})`. El lock guarda, en cambio, `powerHash(files)` (solo el skill), para que la detección de "cambios locales" siga funcionando. En Powers sin MCP ambos valores coinciden.
2. **`validateMcpSpec(x, where): string[]`** devuelve la lista de errores, como `validatePresentation`, para que `build:catalog` los acumule.
3. **`MCP_EDITED`** es el motivo de una confirmación (`OverwriteReason = 'SKILL_EDITED' | 'MCP_EDITED'`), no una excepción: la tabla del spec dice "Confirmación: Sobrescribir / Cancelar". Se añade el código `MCP_NO_OPERATE` (cambiar a Operar un Power que no lo tiene).
4. **`mcp.vscode.json` gana dos campos obligatorios:** `credentials` (texto para la franja) y `example` (prompt de ejemplo para la web y el README).
5. **`newestCatalog`** prefiere el `schemaVersion` mayor: un catálogo v1 cacheado por v0.4.0 no tapa al v2 incluido.
6. **`createdFile`** se hereda: si el archivo lo creó SDD Studio para otro Power activo, el nuevo también lo marca, y el último en desactivarse lo borra.
7. **Reparar (diagnóstico)** = `sddStudio.setPowerMode` con el modo del lock: reescribe las entradas que faltan.
8. **`.gitignore`:** se evalúa solo el de la raíz con un comprobador propio; no se ejecuta `git` (un repo no confiable podría ejecutar hooks).
9. **Tests del instalador:** el repo no tiene sistema de archivos en memoria; son tests de integración (VS Code real), como los del Spec 2. El de `MCP_BLOCKED` inyecta la política en `new PowerInstaller(readPolicy)` en lugar de escribir `chat.mcp.access`, que puede no estar registrado con `--disable-extensions`.
10. **esbuild** necesita `mainFields: ['module', 'main']`: el build UMD de `jsonc-parser` hace `require()` dinámicos que esbuild no resuelve.

## Review Focus

1. **El `.vscode/mcp.json` del equipo tiene comentarios, comas finales y servidores propios.** Activar y desactivar los conserva tal cual. → Tarea 2 (`añade conservando comentarios…`, `quita solo lo pedido…`) y Tarea 6 (`desactivar deja el archivo ajeno como estaba…`).
2. **Alguien editó a mano `sdd-aws` (por ejemplo, la región) y después cambia de modo, actualiza o desactiva.** Se le pregunta (`MCP_EDITED`) y, si cancela, no se toca nada. → Tarea 6 (`MCP_EDITED: entrada editada…`, `update con entrada editada…`, `desactivar con una entrada editada…`).
3. **Tras actualizar a v0.5.0, la caché guarda un catálogo v1 más reciente que el incluido.** Gana el v2 incluido y los Powers MCP aparecen. → Tarea 3 (`gana el de schemaVersion mayor…`).
4. **La organización bloquea MCP (`chat.mcp.access = none` o política estricta).** Activar un Power MCP falla antes de escribir nada; los Powers sin MCP siguen funcionando; la galería muestra 🔒. → Tarea 6 (`MCP_BLOCKED…`, `un Power sin MCP se activa aunque…`) y Tarea 8 (`política bloqueada…`).
5. **Dos Powers comparten un input o el archivo lo creó el primero.** Desactivar uno no borra lo que el otro usa; el archivo se borra solo con el último. → Tarea 6 (`inputs compartidos…`, `el archivo creado por el primer Power…`).

---

## Estructura de archivos

```
src/powers/mcp/
  spec.ts        PURO  McpSpec, McpServer, McpInput, McpMode, PREREQUISITES, validateMcpSpec, serversForMode, serverKind, serverCommandLine
  mcpJson.ts     PURO  addEntries, removeEntries, readEntries, readInputIds, isEmptyMcpFile, entryHash, McpJsonError (jsonc-parser)
  policy.ts      PURO  McpPolicyEnv, mcpPolicyState
  gitignore.ts   PURO  isIgnoredBy(.gitignore de la raíz)
  messages.ts    PURO  activationDetail, overwriteQuestion
  prereqs.ts     fs    findOnPath (no ejecuta nada)
src/powers/
  types.ts        categorías devcore/docs/cloud, CatalogPower.mcp?, Catalog.schemaVersion 1|2
  hash.ts         canonicalJson, catalogPowerHash, MCP_HASH_KEY
  catalog.ts      catálogo v1|v2, catalogV1, newestCatalog por schemaVersion
  lock.ts         lock v2 (LockMcp), inputsInUse, mcpFileCreatedByUs
  validateSource.ts  mcp.vscode.json en el guardián
  fetcher.ts      CATALOG_URL → catalog-v2.json
  installer.ts    activate/update/deactivate con MCP, setMode, planMcp, códigos MCP_*
  powersService.ts  policy(), setMode, PowerView.mode
  commands.ts     modal de activación, sddStudio.setPowerMode, errores MCP
  galleryPanel.ts mensajes setMode y doctor, política al renderizar
  render/card.ts  distintivo, franja MCP, selector de modo, 🔒
  render/gallery.ts  chip "Con MCP", FILTER_SCRIPT
  render/webview.ts  modos y bloqueo
  render/styles.ts   estilos nuevos
src/doctor/
  checks.ts       mcpChecks (tabla del spec §7), severidad 'info', fix
  mcpEnv.ts       collectMcpEnv (lock + mcp.json + PATH + .gitignore)
  doctor.ts       readMcpPolicyEnv, botón Reparar
scripts/build-catalog.ts  lee mcp.vscode.json; catálogo v2
scripts/build-site.ts     catalog-v2.json + catalog.json v1; sección "Cómo usarlo"
powers/{context7,microsoft-learn,aws-docs,github-mcp,playwright-mcp,aws,azure}/
```

---

### Task 0 — Spike manual (lo hace el usuario; no se despacha a un subagente)

> **Esta tarea no la ejecuta ningún subagente.** La hace el usuario en su VS Code 1.140 con su cuenta de Copilot Enterprise. El controlador anota el resultado en el ledger y en `docs/follow-ups.md` (sección `## Spike MCP (v0.5.0)`) antes de despachar la Tarea 12. Las Tareas 1–11 pueden avanzar en paralelo: usan los valores por defecto de abajo y se ajustan cuando llegue el resultado.

**Preparación:** un repo de pruebas cualquiera abierto en VS Code 1.140, con Copilot Chat y la sesión de GitHub activas.

- [ ] **Comprobación 1 — herramientas de un servidor no instalado en un agente (decide la Tarea 12).**
  1. Crea `.github/agents/prueba.agent.md` con este contenido:
     ```markdown
     ---
     name: prueba
     description: prueba de herramientas MCP ausentes
     tools: ['read', 'sdd-context7/*']
     ---
     Responde "hola".
     ```
  2. Sin ningún `.vscode/mcp.json`, abre Copilot Chat, elige el agente `prueba` y escribe "hola".
  3. Anota: ¿aparece algún error, aviso o insignia (en el chat, en el selector de herramientas, en el panel de problemas o en el archivo `.agent.md`)? ¿Responde con normalidad?
  4. **Resultado:** "sin avisos" → la Tarea 12 usa la **variante A**; "avisa o falla" → **variante B**. Borra el archivo de prueba.

- [ ] **Comprobación 2 — GitHub remoto con OAuth y la cuenta Enterprise.**
  1. Crea `.vscode/mcp.json` con `{"servers":{"sdd-github":{"type":"http","url":"https://api.githubcopilot.com/mcp/readonly","headers":{"X-MCP-Toolsets":"repos,issues,pull_requests,actions"}}}}`.
  2. Inicia el servidor desde la lista de servidores MCP, acepta la confianza y el inicio de sesión de GitHub.
  3. En Copilot Chat (modo Agent) pide: "Lista los 3 últimos issues abiertos de este repo".
  4. **Resultado:** "funciona" o "no funciona (mensaje exacto)". Si no funciona, el Power `github-mcp` se publica igual y se anota en `docs/follow-ups.md` "añadir input PAT opcional en v0.5.x"; no cambia ninguna tarea.

- [ ] **Comprobación 3 — id del comando que lista los servidores MCP.**
  1. Paleta de comandos → "MCP: List Servers". Abre *Preferencias: Atajos de teclado*, busca "MCP: List Servers" y copia el id del comando (clic derecho → *Copiar id de comando*).
  2. **Resultado:** el id exacto. Valor por defecto del plan: `workbench.mcp.listServer` (constante `MCP_LIST_SERVERS_COMMAND` en la Tarea 7). Si difiere, el implementador de la Tarea 7 (o un commit `fix:` posterior) cambia esa constante.

- [ ] **Comprobación 4 — medir `approxTools`.**
  1. Con los 7 servidores en `.vscode/mcp.json` (usa los bloques de la tabla de Global Constraints; para `aws` y `azure` necesitas `uv` + perfil de AWS y Node + `az login`), inicia cada uno.
  2. En Copilot Chat → icono de herramientas, cuenta las herramientas que muestra cada servidor.
  3. **Resultado:** un número por servidor. Valores por defecto del plan (estimaciones conservadoras): `sdd-github` 60, `sdd-playwright` 25, `sdd-context7` 2, `sdd-mslearn` 3, `sdd-awsdocs` 5, `sdd-aws` 3, `sdd-azure` 50. Si una medida es mayor, se redondea hacia arriba y se cambia en el `mcp.vscode.json` del Power (Tareas 9 y 10); ningún test fija esos números.

- [ ] **Registro:** añade al final de `docs/follow-ups.md`:
  ```markdown
  ## Spike MCP (v0.5.0)
  - Herramientas de servidores ausentes en `.agent.md`: <sin avisos | avisa: …> → Tarea 12 variante <A|B>
  - GitHub remoto + OAuth (Enterprise): <funciona | no funciona: …>
  - Comando para listar servidores MCP: `<id>`
  - approxTools medidos: github <n>, playwright <n>, context7 <n>, mslearn <n>, awsdocs <n>, aws <n>, azure <n>
  ```
  y commitea: `git add docs/follow-ups.md && git commit -m "docs: resultado del spike MCP"` (con la línea `Co-Authored-By`).

---

### Task 1: Tipos y validación de `mcp.vscode.json`, categorías nuevas

**Files:**
- Create: `src/powers/mcp/spec.ts`
- Modify: `src/powers/types.ts` (categorías y `CatalogPower.mcp?`), `eslint.config.mjs` (módulos puros), `test/support/powerFixtures.ts` (fixture `mcpSpec`)
- Test: `test/unit/powers/mcpSpec.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces (`src/powers/mcp/spec.ts`):
  - `type McpMode = 'readOnly' | 'operate'`, `MCP_MODES: readonly McpMode[]`, `MODE_LABELS: Record<McpMode, string>` (`'Solo lectura'`, `'Operar'`).
  - `type Prerequisite = 'node' | 'uv' | 'docker' | 'az' | 'aws'`, `PREREQUISITES: Record<Prerequisite, { label: string; executable: string; url: string }>`.
  - `interface McpInput { id; type: 'promptString'; description; default?; password? }`.
  - `type McpServer = McpStdioServer | McpHttpServer` (`{type:'stdio', command, args?, env?}` / `{type:'http', url, headers?}`).
  - `interface McpSpec { prerequisites: Prerequisite[]; inputs: McpInput[]; servers: Record<string, McpServer>; approxTools: Record<string, number>; beta: boolean; credentials: string; example: string; operate?: { servers: Record<string, McpServer>; warning: string } }`.
  - `SERVER_NAME_RE`, `INPUT_ID_RE`.
  - `validateMcpSpec(x: unknown, where: string): string[]` (vacío = válido).
  - `serversForMode(spec: McpSpec, mode: McpMode): Record<string, McpServer>`, `serverKind(server): 'local' | 'remote'`, `serverCommandLine(server): string`.
  - `types.ts`: `PowerCategory` con `'devcore' | 'docs' | 'cloud'`; `CatalogPower.mcp?: McpSpec`.
  - `test/support/powerFixtures.ts`: `mcpSpec(over?: Partial<McpSpec>): McpSpec` (servidor stdio `sdd-x` con inputs `sdd_x_profile`/`sdd_x_region` y `operate`).

- [ ] **Step 1: Añadir la fixture `mcpSpec`**

En `test/support/powerFixtures.ts`, cambia la importación de tipos:

```ts
import type { McpSpec } from '../../src/powers/mcp/spec';
import { Catalog, CatalogPower, Presentation } from '../../src/powers/types';
```

y añade al final del archivo:

```ts
/** McpSpec válido de tipo "cloud": un servidor stdio con dos inputs y modo Operar. */
export function mcpSpec(over: Partial<McpSpec> = {}): McpSpec {
  return {
    prerequisites: ['uv'],
    inputs: [
      { id: 'sdd_x_profile', type: 'promptString', description: 'Perfil', default: 'default' },
      { id: 'sdd_x_region', type: 'promptString', description: 'Región', default: 'us-east-1' },
    ],
    servers: {
      'sdd-x': {
        type: 'stdio',
        command: 'uvx',
        args: ['x-mcp-server@1.0.0'],
        env: { PROFILE: '${input:sdd_x_profile}', REGION: '${input:sdd_x_region}', READ_ONLY: 'true' },
      },
    },
    approxTools: { 'sdd-x': 3 },
    beta: false,
    credentials: 'Perfil local',
    example: 'Lista mis recursos',
    operate: {
      servers: {
        'sdd-x': {
          type: 'stdio',
          command: 'uvx',
          args: ['x-mcp-server@1.0.0'],
          env: { PROFILE: '${input:sdd_x_profile}', REGION: '${input:sdd_x_region}', CONSENT: 'true' },
        },
      },
      warning: 'Copilot podrá cambiar recursos.',
    },
    ...over,
  };
}
```

- [ ] **Step 2: Escribir el test, que debe fallar**

`test/unit/powers/mcpSpec.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { serverCommandLine, serverKind, serversForMode, validateMcpSpec } from '../../../src/powers/mcp/spec';
import { CATEGORIES, CATEGORY_LABELS } from '../../../src/powers/types';
import { mcpSpec } from '../../support/powerFixtures';

const errs = (x: unknown) => validateMcpSpec(x, 'p').join('\n');
const http = (url: string, headers?: Record<string, string>) => ({ type: 'http' as const, url, ...(headers ? { headers } : {}) });
const remote = (over: Record<string, unknown> = {}) =>
  mcpSpec({ inputs: [], servers: { 'sdd-r': http('https://example.com/mcp') }, approxTools: { 'sdd-r': 2 }, operate: undefined, ...over });

describe('validateMcpSpec', () => {
  it('acepta un spec válido (stdio con inputs y operate) y uno remoto sin operate', () => {
    expect(validateMcpSpec(mcpSpec(), 'p')).toEqual([]);
    expect(validateMcpSpec(remote(), 'p')).toEqual([]);
  });

  it('regla 1: nombres de servidor sdd-… e ids de input sdd_…', () => {
    expect(errs(remote({ servers: { github: http('https://x.dev') }, approxTools: { github: 1 } }))).toMatch(/\^sdd-\[a-z0-9-\]\+\$/);
    const badInput = mcpSpec({ inputs: [{ id: 'profile', type: 'promptString', description: 'P' }, mcpSpec().inputs[1]] });
    expect(errs(badInput)).toMatch(/\^sdd_\[a-z0-9_\]\+\$/);
  });

  it('regla 2: type stdio|http y url https', () => {
    expect(errs(remote({ servers: { 'sdd-r': { type: 'sse', url: 'https://x' } } }))).toMatch(/"type" debe ser stdio o http/);
    expect(errs(remote({ servers: { 'sdd-r': http('http://example.com/mcp') } }))).toMatch(/https:\/\//);
  });

  it('regla 3: sin @latest y npx/uvx con paquete fijado (admite prerelease)', () => {
    const stdio = (args: string[], command = 'npx') =>
      remote({ prerequisites: ['node'], servers: { 'sdd-r': { type: 'stdio', command, args } } });
    expect(errs(stdio(['-y', '@playwright/mcp@latest']))).toMatch(/@latest/);
    expect(errs(stdio(['-y', '@playwright/mcp']))).toMatch(/versión exacta/);
    expect(errs(stdio(['awslabs.aws-api-mcp-server'], 'uvx'))).toMatch(/versión exacta/);
    expect(validateMcpSpec(stdio(['-y', '@azure/mcp@3.0.0-beta.48', 'server', 'start']), 'p')).toEqual([]);
    expect(validateMcpSpec(stdio(['-y', '@playwright/mcp@0.0.83', '--headless']), 'p')).toEqual([]);
  });

  it('regla 4: rechaza secretos literales y acepta Bearer ${input:…}', () => {
    for (const secret of ['ghp_abc', 'gho_abc', 'github_pat_abc', 'AKIAABCDEF', 'xoxb-1', 'Bearer abc']) {
      expect(errs(remote({ servers: { 'sdd-r': http('https://x.dev', { Authorization: secret }) } })), secret).toMatch(/secreto literal/);
    }
    const env = mcpSpec();
    (env.servers['sdd-x'] as { env: Record<string, string> }).env.TOKEN = 'AKIAXXXX';
    expect(errs(env)).toMatch(/secreto literal/);
    const ok = remote({
      inputs: [{ id: 'sdd_r_key', type: 'promptString', description: 'K', password: true }],
      servers: { 'sdd-r': http('https://x.dev', { Authorization: 'Bearer ${input:sdd_r_key}' }) },
    });
    expect(validateMcpSpec(ok, 'p')).toEqual([]);
  });

  it('regla 5: operate con las mismas claves y warning no vacío', () => {
    const spec = mcpSpec();
    expect(errs({ ...spec, operate: { servers: {}, warning: 'w' } })).toMatch(/mismos servidores/);
    expect(errs({ ...spec, operate: { ...spec.operate, warning: ' ' } })).toMatch(/"operate.warning" no puede estar vacío/);
  });

  it('regla 6: todo input usado está declarado y todo declarado se usa', () => {
    expect(errs(mcpSpec({ inputs: [mcpSpec().inputs[0]] }))).toMatch(/\$\{input:sdd_x_region\} se usa pero no está declarado/);
    const extra = mcpSpec({ inputs: [...mcpSpec().inputs, { id: 'sdd_x_extra', type: 'promptString', description: 'E' }] });
    expect(errs(extra)).toMatch(/"sdd_x_extra" está declarado pero no se usa/);
  });

  it('regla 7: approxTools entero > 0 por servidor', () => {
    expect(errs(mcpSpec({ approxTools: {} }))).toMatch(/approxTools.sdd-x/);
    expect(errs(mcpSpec({ approxTools: { 'sdd-x': 0 } }))).toMatch(/entero mayor que 0/);
    expect(errs(mcpSpec({ approxTools: { 'sdd-x': 2.5 } }))).toMatch(/entero mayor que 0/);
  });

  it('campos de presentación: prerrequisitos conocidos, beta, credentials y example', () => {
    expect(errs(mcpSpec({ prerequisites: ['python' as never] }))).toMatch(/prerequisites/);
    expect(errs({ ...mcpSpec(), beta: 'no' })).toMatch(/"beta"/);
    expect(errs(mcpSpec({ credentials: '' }))).toMatch(/credentials/);
    expect(errs(mcpSpec({ example: '' }))).toMatch(/example/);
    expect(errs('x')).toMatch(/debe ser un objeto/);
  });
});

describe('helpers de McpSpec', () => {
  it('serversForMode elige operate solo si existe', () => {
    const spec = mcpSpec();
    expect(serversForMode(spec, 'readOnly')).toBe(spec.servers);
    expect(serversForMode(spec, 'operate')).toBe(spec.operate!.servers);
    const r = remote();
    expect(serversForMode(r, 'operate')).toBe(r.servers);
  });
  it('serverKind y serverCommandLine', () => {
    const s = mcpSpec().servers['sdd-x'];
    expect(serverKind(s)).toBe('local');
    expect(serverCommandLine(s)).toBe('uvx x-mcp-server@1.0.0');
    expect(serverKind(http('https://x.dev'))).toBe('remote');
    expect(serverCommandLine(http('https://x.dev'))).toBe('https://x.dev');
  });
});

describe('categorías nuevas', () => {
  it('Dev core, Documentación y Cloud al final, en ese orden', () => {
    expect(CATEGORIES.slice(-3)).toEqual(['devcore', 'docs', 'cloud']);
    expect(CATEGORIES.slice(-3).map((c) => CATEGORY_LABELS[c])).toEqual(['Dev core', 'Documentación', 'Cloud']);
  });
});
```

- [ ] **Step 3: Ejecutarlo y ver que falla**

Run: `npx vitest run test/unit/powers/mcpSpec.test.ts`
Expected: FAIL, `Failed to resolve import "../../../src/powers/mcp/spec"`.

- [ ] **Step 4: Implementar `src/powers/mcp/spec.ts`**

```ts
export type McpMode = 'readOnly' | 'operate';
export const MCP_MODES: readonly McpMode[] = ['readOnly', 'operate'];
export const MODE_LABELS: Record<McpMode, string> = { readOnly: 'Solo lectura', operate: 'Operar' };

export type Prerequisite = 'node' | 'uv' | 'docker' | 'az' | 'aws';
export const PREREQUISITES: Record<Prerequisite, { label: string; executable: string; url: string }> = {
  node: { label: 'Node.js', executable: 'node', url: 'https://nodejs.org/' },
  uv: { label: 'uv', executable: 'uv', url: 'https://docs.astral.sh/uv/getting-started/installation/' },
  docker: { label: 'Docker', executable: 'docker', url: 'https://docs.docker.com/get-started/get-docker/' },
  az: { label: 'Azure CLI', executable: 'az', url: 'https://learn.microsoft.com/cli/azure/install-azure-cli' },
  aws: { label: 'AWS CLI', executable: 'aws', url: 'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html' },
};

export interface McpInput {
  id: string;
  type: 'promptString';
  description: string;
  default?: string;
  password?: boolean;
}

export interface McpStdioServer {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
export interface McpHttpServer {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}
export type McpServer = McpStdioServer | McpHttpServer;

export interface McpSpec {
  prerequisites: Prerequisite[];
  inputs: McpInput[];
  servers: Record<string, McpServer>;
  approxTools: Record<string, number>;
  beta: boolean;
  /** Texto corto para la franja del póster, p. ej. "OAuth de VS Code (GitHub)" o "Ninguna". */
  credentials: string;
  /** Prompt de ejemplo, en español, para el README y la página del Power. */
  example: string;
  operate?: { servers: Record<string, McpServer>; warning: string };
}

export const SERVER_NAME_RE = /^sdd-[a-z0-9-]+$/;
export const INPUT_ID_RE = /^sdd_[a-z0-9_]+$/;
const PINNED_RE = /@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SECRET_RE = /ghp_|gho_|github_pat_|AKIA|xox|Bearer (?!\$\{input:)/;
const INPUT_REF_RE = /\$\{input:([^}]*)\}/g;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isStringMap = (v: unknown): v is Record<string, string> => isObj(v) && Object.values(v).every((x) => typeof x === 'string');

/** Servidores que se escriben en `.vscode/mcp.json` para un modo. Sin `operate`, siempre los de solo lectura. */
export function serversForMode(spec: McpSpec, mode: McpMode): Record<string, McpServer> {
  return mode === 'operate' && spec.operate ? spec.operate.servers : spec.servers;
}

/** `local` si ejecuta un proceso en la máquina del dev (stdio); `remote` si es un servicio HTTP. */
export function serverKind(server: McpServer): 'local' | 'remote' {
  return server.type === 'stdio' ? 'local' : 'remote';
}

/** Línea de comando legible de un servidor stdio, o la URL de uno http. */
export function serverCommandLine(server: McpServer): string {
  return server.type === 'stdio' ? [server.command, ...(server.args ?? [])].join(' ') : server.url;
}

function validateServer(name: string, s: unknown, where: string, errors: string[], usedInputs: Set<string>): void {
  const at = `${where}: servidor "${name}"`;
  if (!SERVER_NAME_RE.test(name)) errors.push(`${at}: el nombre debe cumplir ^sdd-[a-z0-9-]+$.`);
  if (!isObj(s)) {
    errors.push(`${at}: debe ser un objeto.`);
    return;
  }
  const values: string[] = [];
  if (s.type === 'stdio') {
    if (!isText(s.command)) errors.push(`${at}: "command" es obligatorio.`);
    if (s.args !== undefined && !(Array.isArray(s.args) && s.args.every((a) => typeof a === 'string'))) {
      errors.push(`${at}: "args" debe ser una lista de textos.`);
    }
    if (s.env !== undefined && !isStringMap(s.env)) errors.push(`${at}: "env" debe ser un objeto de textos.`);
    const args = Array.isArray(s.args) ? s.args.filter((a): a is string => typeof a === 'string') : [];
    const env = isStringMap(s.env) ? s.env : {};
    if (args.some((a) => a.includes('@latest'))) errors.push(`${at}: prohibido "@latest"; fija la versión.`);
    if (s.command === 'npx' || s.command === 'uvx') {
      const pkg = args.find((a) => !a.startsWith('-'));
      if (pkg === undefined || !PINNED_RE.test(pkg)) errors.push(`${at}: el paquete debe terminar en @<versión exacta> (ej. pkg@1.2.3).`);
    }
    values.push(...args, ...Object.values(env));
    if (typeof s.command === 'string') values.push(s.command);
  } else if (s.type === 'http') {
    if (typeof s.url !== 'string' || !s.url.startsWith('https://')) errors.push(`${at}: "url" debe empezar por https://.`);
    if (s.headers !== undefined && !isStringMap(s.headers)) errors.push(`${at}: "headers" debe ser un objeto de textos.`);
    if (typeof s.url === 'string') values.push(s.url);
    if (isStringMap(s.headers)) values.push(...Object.values(s.headers));
  } else {
    errors.push(`${at}: "type" debe ser stdio o http.`);
    return;
  }
  if (values.some((v) => SECRET_RE.test(v))) errors.push(`${at}: contiene lo que parece un secreto literal; usa \${input:sdd_…} u OAuth.`);
  for (const v of values) for (const m of v.matchAll(INPUT_REF_RE)) usedInputs.add(m[1]);
}

/** Valida `mcp.vscode.json` (reglas 1–7 del spec §4.1). Devuelve la lista de errores; vacía si es válido. */
export function validateMcpSpec(x: unknown, where: string): string[] {
  if (!isObj(x)) return [`${where}: mcp.vscode.json debe ser un objeto.`];
  const errors: string[] = [];
  const prereqs = x.prerequisites;
  if (!Array.isArray(prereqs) || !prereqs.every((p) => typeof p === 'string' && p in PREREQUISITES)) {
    errors.push(`${where}: "prerequisites" debe ser una lista con valores de: ${Object.keys(PREREQUISITES).join(', ')}.`);
  }
  if (typeof x.beta !== 'boolean') errors.push(`${where}: "beta" debe ser true o false.`);
  if (!isText(x.credentials)) errors.push(`${where}: falta "credentials".`);
  if (!isText(x.example)) errors.push(`${where}: falta "example".`);

  const declared = new Set<string>();
  if (!Array.isArray(x.inputs)) {
    errors.push(`${where}: "inputs" debe ser una lista (puede estar vacía).`);
  } else {
    x.inputs.forEach((i, n) => {
      if (!isObj(i) || typeof i.id !== 'string' || !INPUT_ID_RE.test(i.id)) {
        errors.push(`${where}: el input ${n + 1} necesita un "id" que cumpla ^sdd_[a-z0-9_]+$.`);
        return;
      }
      if (i.type !== 'promptString') errors.push(`${where}: el input "${i.id}" debe ser de tipo promptString.`);
      if (!isText(i.description)) errors.push(`${where}: el input "${i.id}" necesita "description".`);
      if (declared.has(i.id)) errors.push(`${where}: input duplicado "${i.id}".`);
      declared.add(i.id);
    });
  }

  const used = new Set<string>();
  const servers = x.servers;
  if (!isObj(servers) || Object.keys(servers).length === 0) {
    errors.push(`${where}: "servers" necesita al menos un servidor.`);
  } else {
    for (const [name, s] of Object.entries(servers)) validateServer(name, s, where, errors, used);
    const tools = isObj(x.approxTools) ? x.approxTools : {};
    for (const name of Object.keys(servers)) {
      const n = tools[name];
      if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) errors.push(`${where}: "approxTools.${name}" debe ser un entero mayor que 0.`);
    }
  }

  if (x.operate !== undefined) {
    const op = x.operate;
    if (!isObj(op) || !isObj(op.servers)) {
      errors.push(`${where}: "operate.servers" debe ser un objeto.`);
    } else {
      const a = Object.keys(isObj(servers) ? servers : {}).sort().join(',');
      const b = Object.keys(op.servers).sort().join(',');
      if (a !== b) errors.push(`${where}: "operate.servers" debe tener exactamente los mismos servidores que "servers".`);
      for (const [name, s] of Object.entries(op.servers)) validateServer(name, s, `${where} (operate)`, errors, used);
      if (!isText(op.warning)) errors.push(`${where}: "operate.warning" no puede estar vacío.`);
    }
  }

  for (const id of used) if (!declared.has(id)) errors.push(`${where}: \${input:${id}} se usa pero no está declarado en "inputs".`);
  for (const id of declared) if (!used.has(id)) errors.push(`${where}: el input "${id}" está declarado pero no se usa.`);
  return errors;
}
```

En `src/powers/types.ts`, sustituye las dos primeras líneas (tipo y lista de categorías) por:

```ts
import type { McpSpec } from './mcp/spec';

export type PowerCategory = 'planning' | 'testing' | 'debugging' | 'architecture' | 'research' | 'modes' | 'devcore' | 'docs' | 'cloud';
export const CATEGORIES: readonly PowerCategory[] = [
  'planning',
  'testing',
  'debugging',
  'architecture',
  'research',
  'modes',
  'devcore',
  'docs',
  'cloud',
];
```

añade estas tres etiquetas al final de `CATEGORY_LABELS` (después de `modes: 'Modos',`):

```ts
  devcore: 'Dev core',
  docs: 'Documentación',
  cloud: 'Cloud',
```

y añade el campo al final de `interface CatalogPower` (después de `sha256: string;`):

```ts
  /** Servidores MCP del Power (contenido validado de `mcp.vscode.json`). Solo en catálogos v2. */
  mcp?: McpSpec;
```

En `eslint.config.mjs`, dentro de la lista `files` de la regla `no-restricted-imports`, añade después de `'src/powers/render/**/*.ts',`:

```js
      'src/powers/mcp/**/*.ts',
```

- [ ] **Step 5: Ejecutar los tests y ver que pasan**

Run: `npx vitest run test/unit/powers/mcpSpec.test.ts && npm run typecheck && npm run lint`
Expected: PASS (12 tests), sin errores de tipos ni de lint.

- [ ] **Step 6: Commit**

```bash
git add src/powers/mcp/spec.ts src/powers/types.ts eslint.config.mjs test/support/powerFixtures.ts test/unit/powers/mcpSpec.test.ts
git commit -m "feat(mcp): tipos y validación de mcp.vscode.json; categorías Dev core, Documentación y Cloud

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Edición de `.vscode/mcp.json` con `jsonc-parser`

**Files:**
- Create: `src/powers/mcp/mcpJson.ts`
- Modify: `src/powers/hash.ts` (`canonicalJson`), `package.json` + `package-lock.json` (dependencia `jsonc-parser`), `esbuild.mjs` (`mainFields`)
- Test: `test/unit/powers/mcpJson.test.ts`

**Interfaces:**
- Consumes: de la Tarea 1, `McpServer`, `McpInput`.
- Produces:
  - `hash.ts`: `canonicalJson(value: unknown): string` (claves ordenadas a cualquier profundidad; ignora `undefined`).
  - `mcpJson.ts`:
    - `class McpJsonError extends Error` (archivo no es JSONC válido o no tiene la forma `{servers?: {}, inputs?: []}`).
    - `readEntries(text: string | undefined, names: string[]): Record<string, unknown>` — solo las presentes; sin archivo = `{}`.
    - `readInputIds(text: string | undefined): string[]`.
    - `isEmptyMcpFile(text: string | undefined): boolean`.
    - `addEntries(text: string | undefined, servers: Record<string, McpServer>, inputs: McpInput[]): string` — añade o reemplaza servidores; añade solo los inputs cuyo id falta.
    - `removeEntries(text: string | undefined, names: string[], inputIds: string[]): string` — deja `"servers": {}` si no queda nada.
    - `entryHash(server: unknown): string` — sha256 de `canonicalJson`.
  - Todas lanzan `McpJsonError` con texto inválido y conservan comentarios, formato y entradas ajenas.

- [ ] **Step 1: Instalar la dependencia**

```bash
npm_config_registry=https://registry.npmjs.org/ npm install jsonc-parser@^3.3.1
```

Expected: `package.json` gana `"dependencies": { "jsonc-parser": "^3.3.1" }` y `package-lock.json` cambia. (Ya estaba en `node_modules` como dependencia transitiva de `@vscode/vsce`; ahora es directa porque va en el bundle).

- [ ] **Step 2: Escribir el test, que debe fallar**

`test/unit/powers/mcpJson.test.ts`:

```ts
import { parse } from 'jsonc-parser';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../../src/powers/hash';
import { addEntries, entryHash, isEmptyMcpFile, McpJsonError, readEntries, readInputIds, removeEntries } from '../../../src/powers/mcp/mcpJson';
import type { McpInput, McpServer } from '../../../src/powers/mcp/spec';

const c7: Record<string, McpServer> = { 'sdd-context7': { type: 'http', url: 'https://mcp.context7.com/mcp' } };
const aws: Record<string, McpServer> = {
  'sdd-aws': { type: 'stdio', command: 'uvx', args: ['awslabs.aws-api-mcp-server@1.5.6'], env: { AWS_REGION: '${input:sdd_aws_region}' } },
};
const region: McpInput = { id: 'sdd_aws_region', type: 'promptString', description: 'Región AWS', default: 'us-east-1' };
const FOREIGN = `{
  // servidores del equipo
  "servers": {
    "mine": { "type": "stdio", "command": "my-server" }, // no tocar
  },
  "inputs": [
    { "id": "my_token", "type": "promptString", "description": "Token", "password": true }
  ]
}
`;

describe('mcpJson', () => {
  it('añade a un archivo inexistente o vacío', () => {
    for (const text of [undefined, '', '  \n']) {
      const out = addEntries(text, c7, []);
      expect(parse(out)).toEqual({ servers: c7 });
      expect(out.endsWith('\n')).toBe(true);
    }
  });

  it('añade conservando comentarios, servidores e inputs ajenos', () => {
    const out = addEntries(FOREIGN, aws, [region]);
    expect(out).toContain('// servidores del equipo');
    expect(out).toContain('// no tocar');
    const json = parse(out);
    expect(json.servers.mine).toEqual({ type: 'stdio', command: 'my-server' });
    expect(json.servers['sdd-aws']).toEqual(aws['sdd-aws']);
    expect(readInputIds(out)).toEqual(['my_token', 'sdd_aws_region']);
  });

  it('no duplica inputs que ya están y crea "inputs" si falta', () => {
    const once = addEntries('{ "servers": {} }', aws, [region]);
    const twice = addEntries(once, aws, [region]);
    expect(readInputIds(twice)).toEqual(['sdd_aws_region']);
    expect(parse(twice).servers).toEqual(aws);
  });

  it('reemplaza una entrada existente con el mismo nombre', () => {
    const before = addEntries(undefined, c7, []);
    const other = { 'sdd-context7': { type: 'http' as const, url: 'https://example.com/mcp' } };
    expect(parse(addEntries(before, other, [])).servers).toEqual(other);
  });

  it('quita solo lo pedido y deja "servers": {} si no queda nada', () => {
    const full = addEntries(FOREIGN, { ...aws, ...c7 }, [region]);
    const out = removeEntries(full, ['sdd-aws', 'sdd-context7'], ['sdd_aws_region']);
    expect(out).toContain('// no tocar');
    expect(parse(out).servers).toEqual({ mine: { type: 'stdio', command: 'my-server' } });
    expect(readInputIds(out)).toEqual(['my_token']);
    const alone = removeEntries(addEntries(undefined, c7, []), ['sdd-context7'], []);
    expect(parse(alone)).toEqual({ servers: {} });
    expect(isEmptyMcpFile(alone)).toBe(true);
    expect(isEmptyMcpFile(out)).toBe(false);
  });

  it('readEntries devuelve solo las presentes', () => {
    const text = addEntries(FOREIGN, c7, []);
    expect(readEntries(text, ['sdd-context7', 'sdd-aws'])).toEqual(c7);
    expect(readEntries(undefined, ['sdd-context7'])).toEqual({});
  });

  it('detecta un conflicto de nombre: la entrada ya existe', () => {
    const theirs = '{ "servers": { "sdd-context7": { "type": "http", "url": "https://otro.dev/mcp" } } }';
    expect(Object.keys(readEntries(theirs, ['sdd-context7']))).toEqual(['sdd-context7']);
  });

  it('JSONC inválido o con forma inesperada lanza McpJsonError', () => {
    for (const bad of ['{ roto', '[]', '{ "servers": [] }', '{ "inputs": {} }']) {
      expect(() => readEntries(bad, []), bad).toThrow(McpJsonError);
      expect(() => addEntries(bad, c7, []), bad).toThrow(McpJsonError);
    }
    expect(() => readEntries('{ roto', [])).toThrow(/no es JSONC válido/);
  });

  it('entryHash es estable aunque cambie el orden de las claves', () => {
    const a = { type: 'stdio', command: 'uvx', env: { B: '2', A: '1' }, args: ['x@1.0.0'] };
    const b = { args: ['x@1.0.0'], env: { A: '1', B: '2' }, command: 'uvx', type: 'stdio' };
    expect(entryHash(a)).toBe(entryHash(b));
    expect(entryHash(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(entryHash({ ...a, command: 'npx' })).not.toBe(entryHash(a));
  });

  it('canonicalJson ordena claves a cualquier profundidad e ignora undefined', () => {
    expect(canonicalJson({ b: [{ z: 1, a: 2 }], a: undefined, c: 'x' })).toBe('{"b":[{"a":2,"z":1}],"c":"x"}');
  });
});
```

- [ ] **Step 3: Ejecutarlo y ver que falla**

Run: `npx vitest run test/unit/powers/mcpJson.test.ts`
Expected: FAIL, `canonicalJson` no se exporta de `hash.ts` y no se resuelve `mcp/mcpJson`.

- [ ] **Step 4: Implementar**

Añade al final de `src/powers/hash.ts`:

```ts
/** JSON con las claves de los objetos ordenadas, a cualquier profundidad: el mismo valor da siempre el mismo texto. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
```

`src/powers/mcp/mcpJson.ts`:

```ts
import { createHash } from 'crypto';
import { applyEdits, FormattingOptions, modify, parse, ParseError, printParseErrorCode } from 'jsonc-parser';
import { canonicalJson } from '../hash';
import { McpInput, McpServer } from './spec';

/** `.vscode/mcp.json` no se puede leer como JSONC con la forma esperada. */
export class McpJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpJsonError';
  }
}

const FORMAT: FormattingOptions = { insertSpaces: true, tabSize: 2, eol: '\n' };
const EMPTY = '{\n  "servers": {}\n}\n';

interface McpFile {
  servers: Record<string, unknown>;
  inputs: { id?: unknown }[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function load(text: string | undefined): McpFile {
  if (text === undefined || text.trim() === '') return { servers: {}, inputs: [] };
  const errors: ParseError[] = [];
  const root: unknown = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0) throw new McpJsonError(`.vscode/mcp.json no es JSONC válido (${printParseErrorCode(errors[0].error)} en la posición ${errors[0].offset}).`);
  if (!isObj(root)) throw new McpJsonError('.vscode/mcp.json debe ser un objeto.');
  if (root.servers !== undefined && !isObj(root.servers)) throw new McpJsonError('.vscode/mcp.json: "servers" debe ser un objeto.');
  if (root.inputs !== undefined && !Array.isArray(root.inputs)) throw new McpJsonError('.vscode/mcp.json: "inputs" debe ser una lista.');
  return { servers: (root.servers as Record<string, unknown>) ?? {}, inputs: (root.inputs as { id?: unknown }[]) ?? [] };
}

const hasKey = (text: string, key: string): boolean => key in (parse(text) as Record<string, unknown>);

const edit = (text: string, path: (string | number)[], value: unknown): string =>
  applyEdits(text, modify(text, path, value, { formattingOptions: FORMAT }));

/** Hash estable de una entrada de servidor: no cambia si solo cambia el orden de las claves. */
export function entryHash(server: unknown): string {
  return createHash('sha256').update(canonicalJson(server)).digest('hex');
}

/** Entradas presentes de entre `names`. Lanza McpJsonError si el archivo no es válido. Sin archivo = vacío. */
export function readEntries(text: string | undefined, names: string[]): Record<string, unknown> {
  const { servers } = load(text);
  const out: Record<string, unknown> = {};
  for (const name of names) if (name in servers) out[name] = servers[name];
  return out;
}

/** Ids de los inputs declarados en el archivo. */
export function readInputIds(text: string | undefined): string[] {
  return load(text)
    .inputs.map((i) => (isObj(i) && typeof i.id === 'string' ? i.id : undefined))
    .filter((id): id is string => id !== undefined);
}

/** true si el archivo no tiene servidores ni inputs. */
export function isEmptyMcpFile(text: string | undefined): boolean {
  const f = load(text);
  return Object.keys(f.servers).length === 0 && f.inputs.length === 0;
}

/** Añade o reemplaza `servers` y añade los `inputs` cuyo id aún no está. Conserva comentarios, formato y entradas ajenas. */
export function addEntries(text: string | undefined, servers: Record<string, McpServer>, inputs: McpInput[]): string {
  let out = text === undefined || text.trim() === '' ? EMPTY : text;
  load(out);
  for (const [name, server] of Object.entries(servers)) out = edit(out, ['servers', name], server);
  const have = new Set(readInputIds(out));
  const missing = inputs.filter((i) => !have.has(i.id));
  if (missing.length > 0 && !hasKey(out, 'inputs')) out = edit(out, ['inputs'], []);
  for (const input of missing) out = edit(out, ['inputs', -1], input);
  return out;
}

/** Quita los servidores `names` y los inputs `inputIds`. Deja `"servers": {}` si no queda ninguno. */
export function removeEntries(text: string | undefined, names: string[], inputIds: string[]): string {
  let out = text === undefined || text.trim() === '' ? EMPTY : text;
  const servers = load(out).servers;
  for (const name of names) if (name in servers) out = edit(out, ['servers', name], undefined);
  for (const id of inputIds) {
    const index = load(out).inputs.findIndex((i) => isObj(i) && i.id === id);
    if (index >= 0) out = edit(out, ['inputs', index], undefined);
  }
  return out;
}
```

En `esbuild.mjs`, añade después de `platform: 'node',`:

```js
  // jsonc-parser: su build UMD hace require() dinámicos que esbuild no resuelve; el ESM sí.
  mainFields: ['module', 'main'],
```

- [ ] **Step 5: Ejecutar los tests y comprobar el bundle**

Run: `npx vitest run test/unit/powers/mcpJson.test.ts && npm run typecheck && npm run lint`
Expected: PASS (10 tests).

Run (comprueba que esbuild empaqueta `jsonc-parser` con la misma opción que `esbuild.mjs`):

```bash
node -e "require('esbuild').build({stdin:{contents:\"import { addEntries } from './src/powers/mcp/mcpJson'; console.log(addEntries(undefined, { 'sdd-a': { type: 'http', url: 'https://a.dev' } }, []));\",resolveDir:'.',loader:'ts'},bundle:true,platform:'node',format:'cjs',mainFields:['module','main'],write:false}).then(r=>require('vm').runInNewContext(r.outputFiles[0].text,{console,require,module:{},exports:{}}))"
```

Expected: imprime `{ "servers": { "sdd-a": { "type": "http", "url": "https://a.dev" } } }` formateado. Sin `mainFields` falla con `Cannot find module './impl/format'`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json esbuild.mjs src/powers/hash.ts src/powers/mcp/mcpJson.ts test/unit/powers/mcpJson.test.ts
git commit -m "feat(mcp): fusionar y retirar entradas de .vscode/mcp.json respetando JSONC

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Catálogo v2 (`build:catalog`, `build:site` y la URL online)

**Files:**
- Modify: `src/powers/types.ts`, `src/powers/hash.ts`, `src/powers/catalog.ts`, `src/powers/validateSource.ts`, `src/powers/fetcher.ts`, `scripts/build-catalog.ts`, `scripts/build-site.ts`, `test/support/powerFixtures.ts`
- Test: `test/unit/powers/catalog.test.ts`, `test/unit/powers/validateSource.test.ts`, `test/unit/powers/fetcher.test.ts`, `test/unit/scripts/buildCatalog.test.ts`, `test/unit/scripts/buildSite.test.ts`, `test/integration/powers.service.test.ts`

**Interfaces:**
- Consumes: de la Tarea 1, `McpSpec`, `validateMcpSpec`; de la Tarea 2, `canonicalJson`.
- Produces:
  - `types.ts`: `type CatalogSchemaVersion = 1 | 2`; `Catalog.schemaVersion: CatalogSchemaVersion`.
  - `hash.ts`: `MCP_HASH_KEY = 'mcp.vscode.json'`, `catalogPowerHash(files: Record<string, string>, mcp?: unknown): string`.
  - `catalog.ts`: `validateCatalog` acepta 1 y 2 (un Power con `mcp` en v1 es inválido; servidores únicos entre Powers; `files` no puede tener `mcp.vscode.json`); `newestCatalog` prefiere el `schemaVersion` mayor; `catalogV1(catalog: Catalog): Catalog`.
  - `validateSource.ts`: `PowerSourceInput.mcpText?: string`.
  - `fetcher.ts`: `CATALOG_URL = 'https://enriquecordero.github.io/sdd-studio/powers/catalog-v2.json'`.
  - `build-catalog.ts`: `CatalogPower.mcp` y catálogo con `schemaVersion: 2`.
  - `build-site.ts`: escribe `powers/catalog-v2.json` y `powers/catalog.json` (v1).
  - `powerFixtures.ts`: `catalog(powers, generatedAt?, schemaVersion: 1 | 2 = 2)` y `mcpPower(id = 'cloudy', spec = mcpSpec(), files?, version = '1.0.0'): CatalogPower` (hash con `catalogPowerHash`; el `SKILL.md` por defecto nombra sus servidores).

- [ ] **Step 1: Fixtures**

En `test/support/powerFixtures.ts`, cambia la importación del hash a:

```ts
import { catalogPowerHash, powerHash } from '../../src/powers/hash';
```

y sustituye la función `catalog` por:

```ts
export function catalog(powers: CatalogPower[], generatedAt = '2026-10-01T00:00:00.000Z', schemaVersion: 1 | 2 = 2): Catalog {
  return { schemaVersion, generatedAt, powers };
}

/** Power con MCP: hash del catálogo calculado sobre los archivos y el spec. */
export function mcpPower(
  id = 'cloudy',
  spec: McpSpec = mcpSpec(),
  files: Record<string, string> = { 'SKILL.md': `---\nname: ${id}\ndescription: Test skill\n---\nUse ${Object.keys(spec.servers).join(', ')}.\n` },
  version = '1.0.0',
): CatalogPower {
  return { ...power(id, files, version), mcp: spec, sha256: catalogPowerHash(files, spec) };
}
```

(El catálogo de las fixtures pasa a ser v2 por defecto: el catálogo incluido en el VSIX será v2, y con la regla nueva de `newestCatalog` un v1 nunca le ganaría en los tests de servicio).

- [ ] **Step 2: Escribir los tests, que deben fallar**

En `test/unit/powers/catalog.test.ts`:

- Cambia las importaciones por:
  ```ts
  import { catalogV1, compareSemver, isSafeRelativePath, newestCatalog, validateCatalog, validatePresentation } from '../../../src/powers/catalog';
  import { catalogPowerHash, powerHash } from '../../../src/powers/hash';
  import { catalog, mcpPower, mcpSpec, power, presentation } from '../../support/powerFixtures';
  ```
- En `rechaza schemaVersion y fecha inválidas`, cambia `schemaVersion: 2` por `schemaVersion: 3`.
- Sustituye la línea `describe('newestCatalog', () => {` por este bloque (el `describe` nuevo y el primer `it` del de `newestCatalog`; el resto de ese `describe` sigue igual):

```ts
describe('catálogo v2 (MCP)', () => {
  it('acepta v1 y v2 sin MCP, y v2 con MCP', () => {
    expect(validateCatalog(catalog([power('alpha')], undefined, 1)).ok).toBe(true);
    expect(validateCatalog(catalog([power('alpha')], undefined, 2)).ok).toBe(true);
    expect(validateCatalog(catalog([power('alpha'), mcpPower('cloudy')])).ok).toBe(true);
  });
  it('un Power con mcp en un catálogo v1 es inválido', () => {
    expect(errorsOf(catalog([mcpPower('cloudy')], undefined, 1)).join()).toMatch(/schemaVersion 2/);
  });
  it('el hash cubre mcp: cambiar el spec sin recalcular lo invalida', () => {
    const p = mcpPower('cloudy');
    expect(p.sha256).toBe(catalogPowerHash(p.files, p.mcp));
    expect(p.sha256).not.toBe(powerHash(p.files));
    const tampered = { ...p, mcp: mcpSpec({ approxTools: { 'sdd-x': 99 } }) };
    expect(errorsOf(catalog([tampered])).join()).toMatch(/hash no coincide/);
  });
  it('valida el mcp con validateMcpSpec', () => {
    const bad = mcpPower('cloudy', mcpSpec({ approxTools: {} }));
    expect(errorsOf(catalog([bad])).join()).toMatch(/approxTools.sdd-x/);
  });
  it('rechaza nombres de servidor repetidos entre Powers y un archivo llamado mcp.vscode.json', () => {
    expect(errorsOf(catalog([mcpPower('uno'), mcpPower('dos')])).join()).toMatch(/Servidor MCP duplicado entre Powers: sdd-x/);
    const sneaky = power('alpha', { 'SKILL.md': '---\nname: alpha\ndescription: d\n---\n', 'mcp.vscode.json': '{}' });
    expect(errorsOf(catalog([sneaky])).join()).toMatch(/ruta de archivo no permitida "mcp.vscode.json"/);
  });
  it('catalogV1 deja fuera los Powers con MCP y sigue siendo válido', () => {
    const v1 = catalogV1(catalog([power('alpha'), mcpPower('cloudy')]));
    expect(v1.schemaVersion).toBe(1);
    expect(v1.powers.map((p) => p.id)).toEqual(['alpha']);
    expect(validateCatalog(v1).ok).toBe(true);
  });
});

describe('newestCatalog', () => {
  it('gana el de schemaVersion mayor aunque el otro sea más reciente', () => {
    const oldV2 = catalog([], '2026-01-01T00:00:00.000Z', 2);
    const newV1 = catalog([], '2026-12-01T00:00:00.000Z', 1);
    expect(newestCatalog(oldV2, newV1)).toBe(oldV2);
    expect(newestCatalog(newV1, oldV2)).toBe(oldV2);
  });
```

En `test/unit/powers/validateSource.test.ts`, cambia la importación de fixtures por `import { mcpSpec, presentation } from '../../support/powerFixtures';` y añade dentro del `describe('validatePowerSource', …)`, antes de su `});` final:

```ts
  describe('mcp.vscode.json', () => {
    const skillNaming = (names: string) => ({ 'SKILL.md': `---\nname: alpha\ndescription: Use when x.\n---\nUse ${names}.\n` });
    it('acepta un spec válido cuyo servidor nombra el SKILL.md', () => {
      expect(validatePowerSource(input({ mcpText: JSON.stringify(mcpSpec()), skillFiles: skillNaming('sdd-x') }))).toEqual([]);
    });
    it('JSON roto o spec inválido', () => {
      expect(validatePowerSource(input({ mcpText: '{ roto', skillFiles: skillNaming('sdd-x') })).join()).toMatch(/mcp.vscode.json no es JSON válido/);
      expect(validatePowerSource(input({ mcpText: JSON.stringify(mcpSpec({ approxTools: {} })), skillFiles: skillNaming('sdd-x') })).join()).toMatch(
        /alpha\/mcp.vscode.json: "approxTools.sdd-x"/,
      );
    });
    it('el SKILL.md debe nombrar cada servidor', () => {
      expect(validatePowerSource(input({ mcpText: JSON.stringify(mcpSpec()) })).join()).toMatch(/SKILL.md debe nombrar el servidor "sdd-x"/);
    });
  });
```

En `test/unit/powers/fetcher.test.ts`, sustituye el último `it` por:

```ts
  it('la URL oficial es el catálogo v2 de GitHub Pages', () => {
    expect(CATALOG_URL).toBe('https://enriquecordero.github.io/sdd-studio/powers/catalog-v2.json');
  });
```

En `test/unit/scripts/buildCatalog.test.ts`:

- Importaciones: añade `import { catalogPowerHash } from '../../../src/powers/hash';` y cambia la de fixtures a `import { mcpSpec, presentation } from '../../support/powerFixtures';`.
- `writePower` acepta `mcp?: string` en `opts` y, al final, escribe el archivo:
  ```ts
  function writePower(root: string, id: string, opts: { license?: boolean; extra?: Record<string, string>; mcp?: string } = {}): void {
  ```
  ```ts
    if (opts.mcp !== undefined) writeFileSync(join(dir, 'mcp.vscode.json'), opts.mcp);
  ```
- En el primer `it`, antes de `expect(validateCatalog(catalog).ok).toBe(true);`, añade `expect(catalog.schemaVersion).toBe(2);`.
- Añade después del primer `it`:

```ts
  it('incluye mcp.vscode.json en "mcp" y en el hash, pero no en los archivos del skill', () => {
    const root = mkdtempSync(join(tmpdir(), 'powers-'));
    writePower(root, 'cloudy', {
      mcp: JSON.stringify(mcpSpec()),
      extra: { 'SKILL.md': '---\nname: cloudy\ndescription: Use when x. En español: y.\n---\nUse sdd-x.\n' },
    });
    const { catalog, errors } = buildCatalog(root);
    expect(errors).toEqual([]);
    const [p] = catalog.powers;
    expect(p.mcp).toEqual(mcpSpec());
    expect(Object.keys(p.files)).not.toContain('mcp.vscode.json');
    expect(p.sha256).toBe(catalogPowerHash(p.files, mcpSpec()));
    expect(validateCatalog(catalog).ok).toBe(true);
  });
  it('un mcp.vscode.json inválido es un error del Power', () => {
    const root = mkdtempSync(join(tmpdir(), 'powers-'));
    writePower(root, 'cloudy', { mcp: JSON.stringify(mcpSpec({ servers: { github: { type: 'http', url: 'https://x.dev' } }, operate: undefined })) });
    const { catalog, errors } = buildCatalog(root);
    expect(errors.join('\n')).toMatch(/cloudy\/mcp.vscode.json: servidor "github"/);
    expect(catalog.powers).toEqual([]);
  });
```

En `test/unit/scripts/buildSite.test.ts`, cambia la importación a `import { catalog, mcpPower, power } from '../../support/powerFixtures';` y añade dentro del `describe`, después del `it` existente:

```ts
  it('publica catalog-v2.json con todos y catalog.json (v1) sin los Powers MCP', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'site-'));
    const outDir = join(tmp, '_site');
    buildSite({ siteDir: join(tmp, 'no-site'), outDir, catalog: catalog([power('alpha'), mcpPower('cloudy')]) });
    const v2 = JSON.parse(readFileSync(join(outDir, 'powers', 'catalog-v2.json'), 'utf8'));
    const v1 = JSON.parse(readFileSync(join(outDir, 'powers', 'catalog.json'), 'utf8'));
    expect(v2.schemaVersion).toBe(2);
    expect(v2.powers.map((p: { id: string }) => p.id)).toEqual(['alpha', 'cloudy']);
    expect(v1.schemaVersion).toBe(1);
    expect(v1.powers.map((p: { id: string }) => p.id)).toEqual(['alpha']);
    expect(validateCatalog(v1).ok).toBe(true);
    expect(validateCatalog(v2).ok).toBe(true);
  });
```

En `test/integration/powers.service.test.ts`, el catálogo incluido pasa a ser v2: en `carga el catálogo incluido (válido)` y en `error de red mantiene el catálogo`, cambia `schemaVersion, 1)` por `schemaVersion, 2)` (y el título del primero a `'carga el catálogo incluido (válido, v2)'`).

- [ ] **Step 3: Ejecutarlos y ver que fallan**

Run: `npx vitest run test/unit/powers test/unit/scripts`
Expected: FAIL en los tests nuevos (`catalogV1` y `catalogPowerHash` no existen, `schemaVersion` sigue en 1, la URL sigue siendo `catalog.json`).

- [ ] **Step 4: Implementar**

`src/powers/types.ts` — sustituye `interface Catalog` por:

```ts
/** 1: sin MCP (v0.3–v0.4). 2: admite Powers con `mcp` (v0.5+). */
export type CatalogSchemaVersion = 1 | 2;

export interface Catalog {
  schemaVersion: CatalogSchemaVersion;
  generatedAt: string;
  powers: CatalogPower[];
}
```

`src/powers/hash.ts` — añade al final:

```ts
/** Clave con la que `mcp.vscode.json` entra en el hash del catálogo. No es un archivo del skill. */
export const MCP_HASH_KEY = 'mcp.vscode.json';

/** Hash del catálogo: los archivos del skill y, si hay MCP, `mcp.vscode.json` en forma canónica. */
export function catalogPowerHash(files: Record<string, string>, mcp?: unknown): string {
  return powerHash(mcp === undefined ? files : { ...files, [MCP_HASH_KEY]: canonicalJson(mcp) });
}
```

`src/powers/catalog.ts` — archivo completo:

```ts
import { catalogPowerHash, MCP_HASH_KEY } from './hash';
import { validateMcpSpec } from './mcp/spec';
import { CATEGORIES, Catalog, MAX_EDGE, MAX_ITEM, MAX_LABEL, NODE_LIMITS, TONES } from './types';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const SHA_RE = /^[a-f0-9]{64}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isTextList = (v: unknown, min: number): v is string[] => Array.isArray(v) && v.length >= min && v.every(isText);
const isTone = (v: unknown): boolean => v === undefined || TONES.includes(v as never);

export function isValidId(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 64 && ID_RE.test(v);
}

export function isSemver(v: unknown): v is string {
  return typeof v === 'string' && SEMVER_RE.test(v);
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

export function isSafeRelativePath(p: string): boolean {
  if (p === '' || p.startsWith('/') || p.includes('\\') || /^[A-Za-z]:/.test(p)) return false;
  return p.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

function checkLabel(text: string, max: number, what: string, where: string, errors: string[]): void {
  if (text.length > max) errors.push(`${where}: ${what} "${text}" supera ${max} caracteres.`);
}

function validateDiagram(d: unknown, where: string, errors: string[]): void {
  if (!isObj(d)) {
    errors.push(`${where}: "diagram" debe ser un objeto.`);
    return;
  }
  if (d.kind === 'split') {
    const cols = d.columns;
    if (!Array.isArray(cols) || cols.length !== 2) {
      errors.push(`${where}: un diagrama "split" necesita exactamente 2 columnas.`);
      return;
    }
    cols.forEach((c, i) => {
      if (!isObj(c) || !isText(c.label) || !isTextList(c.items, 1) || c.items.length > 6) {
        errors.push(`${where}: la columna ${i + 1} necesita "label" y entre 1 y 6 "items".`);
        return;
      }
      if (!isTone(c.tone)) errors.push(`${where}: tono inválido "${String(c.tone)}".`);
      checkLabel(c.label, MAX_LABEL, 'la etiqueta', where, errors);
      c.items.forEach((item) => checkLabel(item, MAX_ITEM, 'el ítem', where, errors));
    });
    return;
  }
  if (d.kind !== 'cycle' && d.kind !== 'steps' && d.kind !== 'funnel') {
    errors.push(`${where}: "diagram.kind" debe ser cycle, steps, funnel o split.`);
    return;
  }
  const [min, max] = NODE_LIMITS[d.kind];
  const nodes = d.nodes;
  if (!Array.isArray(nodes) || nodes.length < min || nodes.length > max) {
    errors.push(`${where}: un diagrama "${d.kind}" necesita entre ${min} y ${max} nodos.`);
    return;
  }
  nodes.forEach((n, i) => {
    if (!isObj(n) || !isText(n.label)) {
      errors.push(`${where}: el nodo ${i + 1} necesita "label".`);
      return;
    }
    if (!isTone(n.tone)) errors.push(`${where}: tono inválido "${String(n.tone)}".`);
    checkLabel(n.label, MAX_LABEL, 'la etiqueta', where, errors);
    if (n.edge !== undefined) {
      if (typeof n.edge !== 'string') errors.push(`${where}: "edge" del nodo ${i + 1} debe ser texto.`);
      else checkLabel(n.edge, MAX_EDGE, 'el texto de flecha', where, errors);
    }
  });
}

export function validatePresentation(p: unknown, where: string): string[] {
  if (!isObj(p)) return [`${where}: la presentación debe ser un objeto.`];
  const errors: string[] = [];
  for (const key of ['displayName', 'icon', 'summary'] as const) if (!isText(p[key])) errors.push(`${where}: falta "${key}".`);
  if (!CATEGORIES.includes(p.category as never)) errors.push(`${where}: "category" debe ser una de: ${CATEGORIES.join(', ')}.`);
  if (!isTextList(p.triggers, 1)) errors.push(`${where}: "triggers" necesita al menos 1 texto.`);
  if (!isTextList(p.gets, 1)) errors.push(`${where}: "gets" necesita al menos 1 texto.`);
  validateDiagram(p.diagram, where, errors);
  const s = p.source;
  if (!isObj(s)) errors.push(`${where}: falta "source".`);
  else for (const key of ['repo', 'path', 'commit', 'author', 'license'] as const) if (!isText(s[key])) errors.push(`${where}: falta "source.${key}".`);
  return errors;
}

function validatePower(p: unknown, index: number, schemaVersion: unknown): string[] {
  const where = `powers[${index}]`;
  if (!isObj(p)) return [`${where}: debe ser un objeto.`];
  const name = isValidId(p.id) ? p.id : where;
  const errors: string[] = [];
  if (!isValidId(p.id)) errors.push(`${where}: "id" inválido.`);
  if (!isSemver(p.version)) errors.push(`${name}: "version" debe ser semver (1.2.3).`);
  if (!isValidId(p.skillName)) errors.push(`${name}: "skillName" inválido.`);
  let mcpOk = true;
  if (p.mcp !== undefined) {
    if (schemaVersion !== 2) errors.push(`${name}: un Power con "mcp" necesita un catálogo con schemaVersion 2.`);
    const mcpErrors = validateMcpSpec(p.mcp, name);
    errors.push(...mcpErrors);
    mcpOk = mcpErrors.length === 0;
  }
  if (!isObj(p.files) || !('SKILL.md' in p.files)) {
    errors.push(`${name}: "files" debe incluir SKILL.md.`);
  } else {
    const fileErrors: string[] = [];
    for (const [path, content] of Object.entries(p.files)) {
      if (!isSafeRelativePath(path) || path === MCP_HASH_KEY) fileErrors.push(`${name}: ruta de archivo no permitida "${path}".`);
      if (typeof content !== 'string') fileErrors.push(`${name}: el contenido de "${path}" debe ser texto.`);
    }
    errors.push(...fileErrors);
    if (typeof p.sha256 !== 'string' || !SHA_RE.test(p.sha256)) errors.push(`${name}: "sha256" inválido.`);
    else if (fileErrors.length === 0 && mcpOk && catalogPowerHash(p.files as Record<string, string>, p.mcp) !== p.sha256) {
      errors.push(`${name}: el hash no coincide con los archivos.`);
    }
  }
  errors.push(...validatePresentation(p.presentation, name));
  return errors;
}

export function validateCatalog(json: unknown): ValidationResult<Catalog> {
  if (!isObj(json)) return { ok: false, errors: ['El catálogo debe ser un objeto.'] };
  const errors: string[] = [];
  if (json.schemaVersion !== 1 && json.schemaVersion !== 2) errors.push('"schemaVersion" debe ser 1 o 2.');
  if (typeof json.generatedAt !== 'string' || Number.isNaN(Date.parse(json.generatedAt))) errors.push('"generatedAt" debe ser una fecha ISO.');
  if (!Array.isArray(json.powers)) {
    errors.push('"powers" debe ser una lista.');
  } else {
    json.powers.forEach((p, i) => errors.push(...validatePower(p, i, json.schemaVersion)));
    const ids = json.powers.map((p) => (isObj(p) ? p.id : undefined));
    const dup = ids.find((id, i) => id !== undefined && ids.indexOf(id) !== i);
    if (dup !== undefined) errors.push(`Id duplicado: ${String(dup)}.`);
    const servers = json.powers.flatMap((p) => (isObj(p) && isObj(p.mcp) && isObj(p.mcp.servers) ? Object.keys(p.mcp.servers) : []));
    const dupServer = servers.find((s, i) => servers.indexOf(s) !== i);
    if (dupServer !== undefined) errors.push(`Servidor MCP duplicado entre Powers: ${dupServer}.`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: json as unknown as Catalog };
}

/** El catálogo que se usa: gana el de schemaVersion mayor; con la misma, el de generatedAt más reciente (empate: el actual). */
export function newestCatalog(current: Catalog | undefined, candidate: Catalog | undefined): Catalog | undefined {
  if (!current) return candidate;
  if (!candidate) return current;
  if (candidate.schemaVersion !== current.schemaVersion) return candidate.schemaVersion > current.schemaVersion ? candidate : current;
  return Date.parse(candidate.generatedAt) > Date.parse(current.generatedAt) ? candidate : current;
}

/** Catálogo v1 para v0.4.0 y anteriores: solo los Powers sin MCP. */
export function catalogV1(catalog: Catalog): Catalog {
  return { schemaVersion: 1, generatedAt: catalog.generatedAt, powers: catalog.powers.filter((p) => p.mcp === undefined) };
}
```

`src/powers/validateSource.ts`:
- Añade `import { validateMcpSpec } from './mcp/spec';` después de la importación de `./catalog`.
- Añade al final de `interface PowerSourceInput`:
  ```ts
    /** Texto de `mcp.vscode.json`, si existe. */
    mcpText?: string;
  ```
- Añade, justo antes de `if (!input.hasLicense) errors.push(…)`:

```ts
  if (input.mcpText !== undefined) {
    let mcp: unknown;
    try {
      mcp = JSON.parse(input.mcpText);
    } catch {
      errors.push(`${d}: mcp.vscode.json no es JSON válido.`);
    }
    if (mcp !== undefined) {
      const mcpErrors = validateMcpSpec(mcp, `${d}/mcp.vscode.json`);
      errors.push(...mcpErrors);
      const servers = (mcp as { servers?: unknown }).servers;
      if (mcpErrors.length === 0 && skill !== undefined && typeof servers === 'object' && servers !== null) {
        for (const name of Object.keys(servers)) {
          if (!skill.includes(name)) errors.push(`${d}: SKILL.md debe nombrar el servidor "${name}".`);
        }
      }
    }
  }
```

`src/powers/fetcher.ts`: `CATALOG_URL` pasa a `'https://enriquecordero.github.io/sdd-studio/powers/catalog-v2.json'`.

`scripts/build-catalog.ts`:
- Importaciones: sustituye `import { powerHash } from '../src/powers/hash';` por:
  ```ts
  import { catalogPowerHash } from '../src/powers/hash';
  import { McpSpec } from '../src/powers/mcp/spec';
  ```
- En `readPowerSource`, añade al objeto devuelto (después de `hasUpstream`):
  ```ts
      mcpText: existsSync(join(root, 'mcp.vscode.json')) ? readFileSync(join(root, 'mcp.vscode.json'), 'utf8') : undefined,
  ```
- En `buildCatalog`, sustituye desde `const files = …` hasta la línea `const catalog: Catalog = …` por:

```ts
    const files = { ...input.skillFiles, LICENSE: readFileSync(join(powersDir, dirName, 'LICENSE'), 'utf8') };
    const mcp = input.mcpText === undefined ? undefined : (JSON.parse(input.mcpText) as McpSpec);
    powers.push({
      id: dirName,
      version: (input.pluginJson as { version: string }).version,
      presentation: input.presentation as Presentation,
      skillName: dirName,
      files,
      sha256: catalogPowerHash(files, mcp),
      ...(mcp ? { mcp } : {}),
    });
  }
  const catalog: Catalog = { schemaVersion: 2, generatedAt: now.toISOString(), powers };
```

`scripts/build-site.ts`:
- Importa `catalogV1`: `import { catalogV1, validateCatalog } from '../src/powers/catalog';`.
- Sustituye la línea que escribe `catalog.json` por:
  ```ts
    writeFileSync(join(dir, 'catalog-v2.json'), `${JSON.stringify(catalog)}\n`);
    writeFileSync(join(dir, 'catalog.json'), `${JSON.stringify(catalogV1(catalog))}\n`);
  ```

- [ ] **Step 5: Ejecutar los tests y los scripts**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build:catalog -- --check && npm run build:site && npm run test:integration`
Expected: todo PASS (también `powers.service.test.ts` con el catálogo incluido en v2); `✓ 10 Powers válidos` y `✓ Sitio generado en _site/ (10 Powers)`. Comprueba:

```bash
node -e "for (const f of ['catalog','catalog-v2']) { const c = require('./_site/powers/'+f+'.json'); console.log(f, c.schemaVersion, c.powers.length); }"
```

Expected: `catalog 1 10` y `catalog-v2 2 10`.

- [ ] **Step 6: Commit**

```bash
git add src/powers/types.ts src/powers/hash.ts src/powers/catalog.ts src/powers/validateSource.ts src/powers/fetcher.ts scripts/build-catalog.ts scripts/build-site.ts test/support/powerFixtures.ts test/unit/powers/catalog.test.ts test/unit/powers/validateSource.test.ts test/unit/powers/fetcher.test.ts test/unit/scripts/buildCatalog.test.ts test/unit/scripts/buildSite.test.ts test/integration/powers.service.test.ts
git commit -m "feat(catalog): catálogo v2 con mcp; el sitio publica catalog-v2.json y un v1 sin Powers MCP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lock v2

**Files:**
- Modify: `src/powers/lock.ts`
- Test: `test/unit/powers/lock.test.ts`

**Interfaces:**
- Consumes: de la Tarea 1, `McpMode`, `MCP_MODES`, `SERVER_NAME_RE`, `INPUT_ID_RE`.
- Produces:
  - `interface LockMcp { mode: McpMode; servers: Record<string, string> /* nombre → entryHash */; inputs: string[]; createdFile: boolean }`.
  - `LockEntry.mcp?: LockMcp`; `Lockfile.schemaVersion: 1 | 2` (siempre calculado: 2 si alguna entrada tiene `mcp`).
  - `parseLock` lee v1 y v2 (rechaza `mcp` en un v1 y `mcp` mal formado); `serializeLock`, `withEntry`, `withoutEntry` recalculan la versión.
  - `inputsInUse(lock: Lockfile, exceptId: string): Set<string>`, `mcpFileCreatedByUs(lock: Lockfile, exceptId: string): boolean`.

- [ ] **Step 1: Escribir los tests, que deben fallar**

En `test/unit/powers/lock.test.ts`:
- Sustituye la importación de `lock` por:

```ts
import { describe, expect, it } from 'vitest';
import {
  emptyLock,
  inputsInUse,
  LockEntry,
  mcpFileCreatedByUs,
  parseLock,
  powerStatus,
  serializeLock,
  withEntry,
  withoutEntry,
} from '../../../src/powers/lock';
```

- En `JSON inválido o formato desconocido lanza`, cambia `'{"schemaVersion":2,"powers":{}}'` por `'{"schemaVersion":3,"powers":{}}'`.
- Añade dentro del `describe('lockfile', …)`, antes de su `});` final:

```ts
  describe('v2 (MCP)', () => {
    const mcpEntry = (over: Partial<NonNullable<LockEntry['mcp']>> = {}): LockEntry => ({
      ...entry(),
      skillName: 'aws',
      mcp: { mode: 'readOnly', servers: { 'sdd-aws': 'b'.repeat(64) }, inputs: ['sdd_aws_profile', 'sdd_aws_region'], createdFile: false, ...over },
    });

    it('lee el v1 de siempre', () => {
      const text = JSON.stringify({ schemaVersion: 1, powers: { alpha: entry() } });
      expect(parseLock(text)).toEqual({ schemaVersion: 1, powers: { alpha: entry() } });
    });
    it('lee y reescribe igual un v2 con mcp', () => {
      const lock = withEntry(withEntry(emptyLock(), 'alpha', entry()), 'aws', mcpEntry({ mode: 'operate', createdFile: true }));
      const text = serializeLock(lock);
      expect(JSON.parse(text).schemaVersion).toBe(2);
      expect(parseLock(text)).toEqual(lock);
    });
    it('escribe v1 si no hay MCP y v2 si lo hay', () => {
      const plain = withEntry(emptyLock(), 'alpha', entry());
      expect(JSON.parse(serializeLock(plain)).schemaVersion).toBe(1);
      const withMcp = withEntry(plain, 'aws', mcpEntry());
      expect(JSON.parse(serializeLock(withMcp)).schemaVersion).toBe(2);
      expect(JSON.parse(serializeLock(withoutEntry(withMcp, 'aws'))).schemaVersion).toBe(1);
    });
    it('rechaza mcp en un lock v1 y mcp mal formado', () => {
      expect(() => parseLock(JSON.stringify({ schemaVersion: 1, powers: { aws: mcpEntry() } }))).toThrow(/"aws" no es válida/);
      for (const bad of [{ mode: 'admin' }, { servers: { github: 'b'.repeat(64) } }, { servers: { 'sdd-aws': 'corto' } }, { inputs: ['AWS'] }, { createdFile: 'no' }]) {
        const text = JSON.stringify({ schemaVersion: 2, powers: { aws: mcpEntry(bad as never) } });
        expect(() => parseLock(text), JSON.stringify(bad)).toThrow(/"aws" no es válida/);
      }
    });
    it('inputsInUse y mcpFileCreatedByUs ignoran el Power indicado', () => {
      const lock = withEntry(withEntry(emptyLock(), 'aws', mcpEntry({ createdFile: true })), 'aws-docs', mcpEntry({ inputs: ['sdd_aws_region'], servers: { 'sdd-awsdocs': 'c'.repeat(64) } }));
      expect([...inputsInUse(lock, 'aws')]).toEqual(['sdd_aws_region']);
      expect([...inputsInUse(lock, 'aws-docs')].sort()).toEqual(['sdd_aws_profile', 'sdd_aws_region']);
      expect(mcpFileCreatedByUs(lock, 'aws-docs')).toBe(true);
      expect(mcpFileCreatedByUs(lock, 'aws')).toBe(false);
    });
  });
});
```

(La última línea `});` de este bloque ya es el cierre del `describe('lockfile')`: sustituye el cierre original).

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx vitest run test/unit/powers/lock.test.ts`
Expected: FAIL, `inputsInUse` y `mcpFileCreatedByUs` no existen y el v2 se rechaza.

- [ ] **Step 3: Implementar — `src/powers/lock.ts` completo**

```ts
import { compareSemver, isSafeRelativePath, isSemver, isValidId } from './catalog';
import { INPUT_ID_RE, MCP_MODES, McpMode, SERVER_NAME_RE } from './mcp/spec';

export interface LockMcp {
  mode: McpMode;
  /** Nombre del servidor → `entryHash` de la entrada que escribimos en `.vscode/mcp.json`. */
  servers: Record<string, string>;
  inputs: string[];
  /** true si fue SDD Studio quien creó `.vscode/mcp.json`. */
  createdFile: boolean;
}

export interface LockEntry {
  version: string;
  skillName: string;
  sha256: string;
  files: string[];
  installedAt: string;
  mcp?: LockMcp;
}

export interface Lockfile {
  /** 2 solo si algún Power tiene `mcp`; si no, 1, para que v0.4.0 lo siga leyendo. */
  schemaVersion: 1 | 2;
  powers: Record<string, LockEntry>;
}

export type PowerStatus = 'available' | 'active' | 'update';

const HASH_RE = /^[a-f0-9]{64}$/;

function lockOf(powers: Record<string, LockEntry>): Lockfile {
  return { schemaVersion: Object.values(powers).some((e) => e.mcp) ? 2 : 1, powers };
}

export function emptyLock(): Lockfile {
  return lockOf({});
}

function parseMcp(raw: unknown): LockMcp | undefined {
  const m = raw as Partial<LockMcp> | null;
  if (typeof m !== 'object' || m === null) return undefined;
  const servers = m.servers as Record<string, unknown> | undefined;
  const valid =
    MCP_MODES.includes(m.mode as McpMode) &&
    typeof servers === 'object' &&
    servers !== null &&
    Object.entries(servers).every(([name, hash]) => SERVER_NAME_RE.test(name) && typeof hash === 'string' && HASH_RE.test(hash)) &&
    Array.isArray(m.inputs) &&
    m.inputs.every((i) => typeof i === 'string' && INPUT_ID_RE.test(i)) &&
    typeof m.createdFile === 'boolean';
  if (!valid) return undefined;
  return { mode: m.mode as McpMode, servers: { ...(servers as Record<string, string>) }, inputs: [...(m.inputs as string[])], createdFile: m.createdFile as boolean };
}

export function parseLock(text: string | undefined): Lockfile {
  if (text === undefined || text.trim() === '') return emptyLock();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('powers.lock.json no es JSON válido.');
  }
  const obj = json as { schemaVersion?: unknown; powers?: unknown };
  if (
    typeof json !== 'object' ||
    json === null ||
    (obj.schemaVersion !== 1 && obj.schemaVersion !== 2) ||
    typeof obj.powers !== 'object' ||
    obj.powers === null
  ) {
    throw new Error('powers.lock.json no tiene el formato esperado (schemaVersion 1 o 2).');
  }
  const powers: Record<string, LockEntry> = {};
  for (const [id, raw] of Object.entries(obj.powers as Record<string, unknown>)) {
    const e = (raw ?? {}) as Partial<LockEntry>;
    const files = e.files;
    const mcp = e.mcp === undefined ? undefined : parseMcp(e.mcp);
    const valid =
      isValidId(id) &&
      isSemver(e.version) &&
      isValidId(e.skillName) &&
      typeof e.sha256 === 'string' &&
      Array.isArray(files) &&
      files.every((f) => typeof f === 'string' && isSafeRelativePath(f)) &&
      typeof e.installedAt === 'string' &&
      (e.mcp === undefined || mcp !== undefined) &&
      (mcp === undefined || obj.schemaVersion === 2);
    if (!valid) throw new Error(`powers.lock.json: la entrada "${id}" no es válida.`);
    powers[id] = {
      version: e.version as string,
      skillName: e.skillName as string,
      sha256: e.sha256 as string,
      files: [...(files as string[])],
      installedAt: e.installedAt as string,
      ...(mcp ? { mcp } : {}),
    };
  }
  return lockOf(powers);
}

export function serializeLock(lock: Lockfile): string {
  const powers: Record<string, LockEntry> = {};
  for (const id of Object.keys(lock.powers).sort()) powers[id] = lock.powers[id];
  return `${JSON.stringify(lockOf(powers), null, 2)}\n`;
}

export function withEntry(lock: Lockfile, id: string, entry: LockEntry): Lockfile {
  return lockOf({ ...lock.powers, [id]: entry });
}

export function withoutEntry(lock: Lockfile, id: string): Lockfile {
  const powers = { ...lock.powers };
  delete powers[id];
  return lockOf(powers);
}

/** Ids de inputs que usan los Powers activos, salvo `exceptId`. */
export function inputsInUse(lock: Lockfile, exceptId: string): Set<string> {
  return new Set(
    Object.entries(lock.powers)
      .filter(([id]) => id !== exceptId)
      .flatMap(([, e]) => e.mcp?.inputs ?? []),
  );
}

/** true si algún Power activo, salvo `exceptId`, registra que SDD Studio creó `.vscode/mcp.json`. */
export function mcpFileCreatedByUs(lock: Lockfile, exceptId: string): boolean {
  return Object.entries(lock.powers).some(([id, e]) => id !== exceptId && e.mcp?.createdFile === true);
}

export function powerStatus(power: { version: string }, entry: LockEntry | undefined): PowerStatus {
  if (!entry) return 'available';
  return compareSemver(power.version, entry.version) > 0 ? 'update' : 'active';
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: PASS (los tests de lock existentes siguen en verde: un lock sin MCP se lee y escribe como v1).

- [ ] **Step 5: Commit**

```bash
git add src/powers/lock.ts test/unit/powers/lock.test.ts
git commit -m "feat(lock): lock v2 con la parte MCP de cada Power (v1 si no hay MCP)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Política, prerrequisitos y diagnóstico MCP

**Files:**
- Create: `src/powers/mcp/policy.ts`, `src/powers/mcp/prereqs.ts`, `src/powers/mcp/gitignore.ts`, `src/doctor/mcpEnv.ts`
- Modify: `src/doctor/checks.ts`, `src/doctor/doctor.ts`, `src/extension.ts`
- Test: `test/unit/powers/mcpPolicy.test.ts`, `test/unit/doctor/checks.test.ts`

**Interfaces:**
- Consumes: de la Tarea 1, `McpMode`, `Prerequisite`, `PREREQUISITES`; de la Tarea 2, `readEntries`; de la Tarea 4, `LockEntry.mcp`; `PowersService.active()` (existente).
- Produces:
  - `policy.ts`: `interface McpPolicyEnv { access: unknown; strictPluginOnly: boolean }`, `type McpPolicyStateName = 'allowed' | 'registryOnly' | 'blocked'`, `interface McpPolicyState { state; reason? }`, `mcpPolicyState(env: McpPolicyEnv): McpPolicyState`.
  - `prereqs.ts`: `findOnPath(cmd: string, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform): Promise<boolean>`.
  - `gitignore.ts`: `isIgnoredBy(gitignore: string, rel: string): boolean`.
  - `checks.ts`: `CheckResult.severity` admite `'info'`; `CheckResult.fix?: { label; command; args }`; `interface ActiveMcpServer { name; inFile; approxTools }`, `interface ActiveMcpPower { id; displayName; mode; prerequisites; servers }`; `DoctorEnv` gana `mcpAccess`, `workspaceTrusted`, `mcpJsonIgnored: boolean | 'unknown'`, `prereqs: Partial<Record<Prerequisite, boolean>>`, `activeMcp: ActiveMcpPower[]`; `mcpChecks(env): CheckResult[]` (lo llama `runChecks`); `GITHUB_MCP_POLICY_URL`, `MAX_TOOLS_WARNING = 100`.
  - `doctor.ts`: `readMcpPolicyEnv(): McpPolicyEnv` (lo usa el instalador en la Tarea 6); `registerDoctor(context, powers?: PowersService)`.
  - `mcpEnv.ts`: `collectMcpEnv(powers: PowersService | undefined, folder: vscode.WorkspaceFolder | undefined): Promise<Pick<DoctorEnv, 'mcpJsonIgnored' | 'prereqs' | 'activeMcp'>>`.
  - El fix de `mcp-drift` es `{ label: 'Reparar', command: 'sddStudio.setPowerMode', args: [{ id, mode }] }`; ese comando lo registra la Tarea 7.

- [ ] **Step 1: Escribir los tests, que deben fallar**

`test/unit/powers/mcpPolicy.test.ts`:

```ts
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, join } from 'path';
import { describe, expect, it } from 'vitest';
import { isIgnoredBy } from '../../../src/powers/mcp/gitignore';
import { mcpPolicyState } from '../../../src/powers/mcp/policy';
import { findOnPath } from '../../../src/powers/mcp/prereqs';

describe('mcpPolicyState', () => {
  it('allowed por defecto', () => {
    expect(mcpPolicyState({ access: 'all', strictPluginOnly: false })).toEqual({ state: 'allowed' });
    expect(mcpPolicyState({ access: undefined, strictPluginOnly: false })).toEqual({ state: 'allowed' });
  });
  it('blocked con access none (o false) o con la política estricta', () => {
    expect(mcpPolicyState({ access: 'none', strictPluginOnly: false })).toEqual({ state: 'blocked', reason: 'chat.mcp.access = none' });
    expect(mcpPolicyState({ access: false, strictPluginOnly: false }).state).toBe('blocked');
    expect(mcpPolicyState({ access: 'all', strictPluginOnly: true })).toEqual({ state: 'blocked', reason: 'política ChatStrictPluginOnlyCustomization' });
  });
  it('registryOnly con access registry', () => {
    expect(mcpPolicyState({ access: 'registry', strictPluginOnly: false })).toEqual({ state: 'registryOnly', reason: 'chat.mcp.access = registry' });
  });
});

describe('findOnPath', () => {
  const bin = () => {
    const dir = mkdtempSync(join(tmpdir(), 'path-'));
    const file = join(dir, 'uv');
    writeFileSync(file, '#!/bin/sh\n');
    chmodSync(file, 0o755);
    mkdirSync(join(dir, 'aws'));
    return dir;
  };
  it('encuentra un ejecutable y no confunde carpetas con archivos', async () => {
    const dir = bin();
    const env = { PATH: ['/no/existe', dir].join(delimiter) };
    expect(await findOnPath('uv', env, 'linux')).toBe(true);
    expect(await findOnPath('aws', env, 'linux')).toBe(false);
    expect(await findOnPath('az', env, 'linux')).toBe(false);
  });
  it('en Windows prueba las extensiones de PATHEXT', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'path-'));
    writeFileSync(join(dir, 'az.CMD'), '@echo off\r\n');
    expect(await findOnPath('az', { PATH: dir, PATHEXT: '.EXE;.CMD' }, 'win32')).toBe(true);
    expect(await findOnPath('az', { PATH: dir, PATHEXT: '.EXE' }, 'win32')).toBe(false);
  });
  it('sin PATH devuelve false', async () => {
    expect(await findOnPath('uv', {}, 'linux')).toBe(false);
  });
});

describe('isIgnoredBy (.gitignore de la raíz)', () => {
  const file = '.vscode/mcp.json';
  it.each([
    ['', false],
    ['node_modules/\ndist/', false],
    ['.vscode', true],
    ['.vscode/', true],
    ['/.vscode/', true],
    ['.vscode/*', true],
    ['.vscode/*\n!.vscode/mcp.json', false],
    ['.vscode/\n!.vscode/mcp.json', true],
    ['*.json', true],
    ['# .vscode', false],
    ['**/mcp.json', true],
    ['/mcp.json', false],
  ])('%j → %s', (gitignore, expected) => {
    expect(isIgnoredBy(gitignore, file)).toBe(expected);
  });
});
```

En `test/unit/doctor/checks.test.ts`:
- Importación: `import { ActiveMcpPower, compareVersions, DoctorEnv, runChecks } from '../../../src/doctor/checks';`
- Añade a `healthy`, después de `strictPluginOnly: false,`:
  ```ts
    mcpAccess: 'all',
    workspaceTrusted: true,
    mcpJsonIgnored: false,
    prereqs: {},
    activeMcp: [],
  ```
- En `cada problema da su check con acción`, la lista esperada termina en `'strict-policy', 'mcp-strict',` (con `strictPluginOnly: true` también falla el chequeo MCP estricto).
- Añade al final del archivo:

```ts
describe('chequeos MCP (spec §7)', () => {
  const aws = (over: Partial<ActiveMcpPower> = {}): ActiveMcpPower => ({
    id: 'aws',
    displayName: 'AWS',
    mode: 'readOnly',
    prerequisites: ['uv', 'aws'],
    servers: [{ name: 'sdd-aws', inFile: true, approxTools: 3 }],
    ...over,
  });
  const withMcp: DoctorEnv = { ...healthy, activeMcp: [aws()], prereqs: { uv: true, aws: true } };
  const find = (env: DoctorEnv, id: string) => runChecks(env).filter((c) => c.id === id);

  it('sin Powers MCP activos solo aparecen mcp-policy y mcp-strict', () => {
    expect(runChecks(healthy).map((c) => c.id).filter((id) => id.startsWith('mcp-'))).toEqual(['mcp-policy', 'mcp-strict']);
  });
  it('con Powers MCP activos y todo bien, todo ok', () => {
    expect(runChecks(withMcp).every((c) => c.ok)).toBe(true);
  });
  it('mcp-policy: none es error y registry es warning', () => {
    expect(find({ ...healthy, mcpAccess: 'none' }, 'mcp-policy')[0]).toMatchObject({ ok: false, severity: 'error' });
    expect(find({ ...healthy, mcpAccess: 'none' }, 'mcp-policy')[0].message).toMatch(/bloqueados/);
    expect(find({ ...healthy, mcpAccess: 'registry' }, 'mcp-policy')[0]).toMatchObject({ ok: false, severity: 'warning' });
    expect(find({ ...healthy, mcpAccess: 'registry' }, 'mcp-policy')[0].message).toMatch(/registro de tu organización/);
  });
  it('mcp-strict: error que nombra .vscode/mcp.json', () => {
    const [c] = find({ ...healthy, strictPluginOnly: true }, 'mcp-strict');
    expect(c).toMatchObject({ ok: false, severity: 'error' });
    expect(c.message).toMatch(/\.vscode\/mcp\.json/);
  });
  it('mcp-github-policy: info (no cuenta como problema) con el texto de la política', () => {
    const [c] = find(withMcp, 'mcp-github-policy');
    expect(c).toMatchObject({ ok: true, severity: 'info' });
    expect(c.message).toContain('MCP servers in Copilot');
    expect(find(healthy, 'mcp-github-policy')).toEqual([]);
  });
  it('mcp-prereq-<cmd>: error con enlace de instalación por cada ejecutable que falta', () => {
    const results = runChecks({ ...withMcp, prereqs: { uv: false, aws: true } });
    const [c] = results.filter((r) => r.id === 'mcp-prereq-uv');
    expect(c).toMatchObject({ ok: false, severity: 'error' });
    expect(c.message).toContain('AWS');
    expect(c.action).toContain('https://docs.astral.sh/uv/');
    expect(results.some((r) => r.id === 'mcp-prereq-aws')).toBe(false);
  });
  it('mcp-trust: warning en workspace sin confianza', () => {
    expect(find({ ...withMcp, workspaceTrusted: false }, 'mcp-trust')[0]).toMatchObject({ ok: false, severity: 'warning' });
  });
  it('mcp-gitignored: warning solo si se sabe que está ignorado', () => {
    expect(find({ ...withMcp, mcpJsonIgnored: true }, 'mcp-gitignored')[0]).toMatchObject({ ok: false, severity: 'warning' });
    expect(find({ ...withMcp, mcpJsonIgnored: 'unknown' }, 'mcp-gitignored')[0].ok).toBe(true);
  });
  it('mcp-drift: warning con acción Reparar que reescribe en el modo del lock', () => {
    const env = { ...withMcp, activeMcp: [aws({ mode: 'operate', servers: [{ name: 'sdd-aws', inFile: false, approxTools: 3 }] })] };
    const [c] = find(env, 'mcp-drift');
    expect(c).toMatchObject({ ok: false, severity: 'warning' });
    expect(c.message).toContain('sdd-aws');
    expect(c.fix).toEqual({ label: 'Reparar', command: 'sddStudio.setPowerMode', args: [{ id: 'aws', mode: 'operate' }] });
  });
  it('mcp-tools: warning si la suma de approxTools pasa de 100', () => {
    const many = (n: number) => aws({ servers: [{ name: 'sdd-aws', inFile: true, approxTools: n }] });
    expect(find({ ...withMcp, activeMcp: [many(100)] }, 'mcp-tools')[0].ok).toBe(true);
    const [c] = find({ ...withMcp, activeMcp: [many(60), aws({ id: 'azure', servers: [{ name: 'sdd-azure', inFile: true, approxTools: 50 }] })] }, 'mcp-tools');
    expect(c).toMatchObject({ ok: false, severity: 'warning' });
    expect(c.message).toMatch(/~110 herramientas/);
    expect(c.message).toMatch(/128/);
  });
});
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx vitest run test/unit/powers/mcpPolicy.test.ts test/unit/doctor`
Expected: FAIL, no existen `policy`, `prereqs`, `gitignore` ni los chequeos MCP.

- [ ] **Step 3: Implementar los módulos puros**

`src/powers/mcp/policy.ts`:

```ts
export interface McpPolicyEnv {
  /** Valor de `chat.mcp.access` ('all' | 'registry' | 'none'; versiones antiguas: boolean). */
  access: unknown;
  /** Política ChatStrictPluginOnlyCustomization activa. */
  strictPluginOnly: boolean;
}

export type McpPolicyStateName = 'allowed' | 'registryOnly' | 'blocked';

export interface McpPolicyState {
  state: McpPolicyStateName;
  reason?: string;
}

export function mcpPolicyState(env: McpPolicyEnv): McpPolicyState {
  if (env.access === 'none' || env.access === false) return { state: 'blocked', reason: 'chat.mcp.access = none' };
  if (env.strictPluginOnly) return { state: 'blocked', reason: 'política ChatStrictPluginOnlyCustomization' };
  if (env.access === 'registry') return { state: 'registryOnly', reason: 'chat.mcp.access = registry' };
  return { state: 'allowed' };
}
```

`src/powers/mcp/prereqs.ts`:

```ts
import { promises as fs } from 'fs';
import { delimiter, join } from 'path';

/**
 * ¿Hay un ejecutable `cmd` en el PATH? Solo mira el sistema de archivos; nunca ejecuta nada.
 * En Windows prueba las extensiones de PATHEXT.
 */
export async function findOnPath(
  cmd: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<boolean> {
  const dirs = (env.PATH ?? env.Path ?? '').split(delimiter).filter((d) => d !== '');
  const exts = platform === 'win32' ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter((e) => e !== '') : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      try {
        const file = join(dir, cmd + ext);
        const stat = await fs.stat(file);
        if (!stat.isFile()) continue;
        if (platform !== 'win32') await fs.access(file, fs.constants.X_OK);
        return true;
      } catch {
        // no está en esta carpeta
      }
    }
  }
  return false;
}
```

`src/powers/mcp/gitignore.ts`:

```ts
function globToRegex(glob: string): string {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return re;
}

interface Rule {
  re: RegExp;
  negate: boolean;
  dirOnly: boolean;
}

function parseRules(gitignore: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of gitignore.split(/\r?\n/)) {
    let line = raw.replace(/\s+$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.startsWith('/') || line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ re: new RegExp(`^${anchored ? '' : '(?:.*/)?'}${globToRegex(line)}$`), negate, dirOnly });
  }
  return rules;
}

function matches(rules: Rule[], path: string, isDir: boolean): boolean {
  let ignored = false;
  for (const r of rules) if ((!r.dirOnly || isDir) && r.re.test(path)) ignored = !r.negate;
  return ignored;
}

/**
 * ¿Ignora este `.gitignore` (el de la raíz) la ruta `rel`? Cubre comentarios, negación (`!`), anclaje (`/x`),
 * carpetas (`x/`), `*`, `?` y `**`, y como git, una carpeta ignorada no se puede "des-ignorar" por dentro.
 * No lee `.gitignore` anidados ni el exclude global.
 */
export function isIgnoredBy(gitignore: string, rel: string): boolean {
  const rules = parseRules(gitignore);
  const parts = rel.split('/');
  for (let i = 1; i < parts.length; i++) if (matches(rules, parts.slice(0, i).join('/'), true)) return true;
  return matches(rules, rel, false);
}
```

`src/doctor/checks.ts` completo:

```ts
import { mcpPolicyState } from '../powers/mcp/policy';
import { McpMode, Prerequisite, PREREQUISITES } from '../powers/mcp/spec';

export interface ActiveMcpServer {
  name: string;
  /** true si la entrada sigue en `.vscode/mcp.json`. */
  inFile: boolean;
  approxTools: number;
}

export interface ActiveMcpPower {
  id: string;
  displayName: string;
  mode: McpMode;
  prerequisites: Prerequisite[];
  servers: ActiveMcpServer[];
}

export interface DoctorEnv {
  vscodeVersion: string;
  minVersion: string;
  copilotChatInstalled: boolean;
  /** 'unknown' cuando VS Code no permite comprobarlo sin pedir permiso al usuario. */
  githubSignedIn: boolean | 'unknown';
  agentModeEnabled: boolean;
  extensionToolsEnabled: boolean;
  strictPluginOnly: boolean;
  /** Valor de `chat.mcp.access`. */
  mcpAccess: unknown;
  workspaceTrusted: boolean;
  /** 'unknown' si no hay carpeta o no se pudo leer `.gitignore`. */
  mcpJsonIgnored: boolean | 'unknown';
  /** Ejecutables requeridos por los Powers MCP activos → ¿está en el PATH? */
  prereqs: Partial<Record<Prerequisite, boolean>>;
  activeMcp: ActiveMcpPower[];
}

export const GITHUB_MCP_POLICY_URL =
  'https://docs.github.com/en/copilot/concepts/mcp-management';
export const MAX_TOOLS_WARNING = 100;

export interface CheckResult {
  id: string;
  ok: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  action?: string;
  /** Arreglo automático que el diagnóstico ofrece como botón. */
  fix?: { label: string; command: string; args: unknown[] };
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

export function mcpChecks(env: DoctorEnv): CheckResult[] {
  const policy = mcpPolicyState({ access: env.mcpAccess, strictPluginOnly: false });
  const results: CheckResult[] = [
    {
      id: 'mcp-policy',
      ok: policy.state === 'allowed',
      severity: policy.state === 'blocked' ? 'error' : 'warning',
      message:
        policy.state === 'blocked'
          ? 'Los servidores MCP están desactivados (chat.mcp.access = none): los Powers con MCP quedan bloqueados.'
          : policy.state === 'registryOnly'
            ? 'Solo se permiten los servidores MCP del registro de tu organización (chat.mcp.access = registry).'
            : 'Servidores MCP permitidos',
      action:
        policy.state === 'blocked'
          ? 'Pide a tu admin que habilite MCP (política ChatMCP / chat.mcp.access).'
          : policy.state === 'registryOnly'
            ? 'Pide a tu admin que añada los servidores sdd-* al registro, o usa los Powers sin MCP.'
            : undefined,
    },
    {
      id: 'mcp-strict',
      ok: !env.strictPluginOnly,
      severity: 'error',
      message: env.strictPluginOnly
        ? 'La política ChatStrictPluginOnlyCustomization bloquea .vscode/mcp.json: los Powers con MCP no se pueden activar.'
        : 'La política estricta no bloquea .vscode/mcp.json',
      action: env.strictPluginOnly ? 'Pide a TI permitir customizaciones de workspace para usar Powers con MCP.' : undefined,
    },
  ];
  if (env.activeMcp.length === 0) return results;

  results.push({
    id: 'mcp-github-policy',
    ok: true,
    severity: 'info',
    message: `Si los servidores MCP aparecen deshabilitados, pide a tu admin que active "MCP servers in Copilot" en GitHub (${GITHUB_MCP_POLICY_URL}).`,
  });
  const needed = [...new Set(env.activeMcp.flatMap((p) => p.prerequisites))].sort();
  for (const cmd of needed) {
    if (env.prereqs[cmd] !== false) continue;
    const info = PREREQUISITES[cmd];
    const users = env.activeMcp.filter((p) => p.prerequisites.includes(cmd)).map((p) => p.displayName);
    results.push({
      id: `mcp-prereq-${cmd}`,
      ok: false,
      severity: 'error',
      message: `Falta ${info.label} (\`${info.executable}\` no está en el PATH); lo necesita: ${users.join(', ')}.`,
      action: `Instálalo: ${info.url}`,
    });
  }
  results.push({
    id: 'mcp-trust',
    ok: env.workspaceTrusted,
    severity: 'warning',
    message: env.workspaceTrusted ? 'Workspace de confianza' : 'Los servidores MCP no arrancan en un workspace sin confianza.',
    action: env.workspaceTrusted ? undefined : 'Confía en este workspace (Gestionar → Confianza del workspace).',
  });
  results.push({
    id: 'mcp-gitignored',
    ok: env.mcpJsonIgnored !== true,
    severity: 'warning',
    message: env.mcpJsonIgnored === true ? '.vscode/mcp.json está ignorado por git: tu equipo no recibirá los servidores.' : '.vscode/mcp.json se versiona con el repo',
    action: env.mcpJsonIgnored === true ? 'Añade "!.vscode/mcp.json" a .gitignore (o quita la regla que lo ignora).' : undefined,
  });
  for (const p of env.activeMcp) {
    const missing = p.servers.filter((s) => !s.inFile).map((s) => s.name);
    if (missing.length === 0) continue;
    results.push({
      id: 'mcp-drift',
      ok: false,
      severity: 'warning',
      message: `Falta en .vscode/mcp.json: ${missing.join(', ')} (Power "${p.displayName}").`,
      action: 'Pulsa "Reparar" para reescribir la entrada desde el catálogo.',
      fix: { label: 'Reparar', command: 'sddStudio.setPowerMode', args: [{ id: p.id, mode: p.mode }] },
    });
  }
  const tools = env.activeMcp.flatMap((p) => p.servers).reduce((sum, s) => sum + s.approxTools, 0);
  results.push({
    id: 'mcp-tools',
    ok: tools <= MAX_TOOLS_WARNING,
    severity: 'warning',
    message:
      tools <= MAX_TOOLS_WARNING
        ? `Herramientas MCP activas: ~${tools}`
        : `Los Powers MCP activos suman ~${tools} herramientas; Copilot admite como máximo 128 por petición.`,
    action: tools <= MAX_TOOLS_WARNING ? undefined : 'Desactiva algún Power o deselecciona herramientas en el selector de herramientas del chat.',
  });
  return results;
}

export function runChecks(env: DoctorEnv): CheckResult[] {
  const versionOk = compareVersions(env.vscodeVersion, env.minVersion) >= 0;
  const sessionMissing = env.githubSignedIn === false;
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
      ok: !sessionMissing,
      severity: 'warning',
      message:
        env.githubSignedIn === 'unknown'
          ? 'Sesión de GitHub no verificada (VS Code no lo permite sin permiso)'
          : env.githubSignedIn
            ? 'Sesión de GitHub activa'
            : 'No detecté una sesión de GitHub.',
      action: sessionMissing ? 'Inicia sesión en Copilot desde el icono de cuentas (abajo a la izquierda).' : undefined,
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
        ? 'La política ChatStrictPluginOnlyCustomization está activa: puede impedir que se carguen las instructions de steering de .github/instructions (y, más adelante, los Powers del repo).'
        : 'Customizaciones de workspace permitidas',
      action: env.strictPluginOnly ? 'Pide a TI permitir customizaciones de workspace para SDD Studio.' : undefined,
    },
    ...mcpChecks(env),
  ];
}
```

- [ ] **Step 4: Ejecutar los tests unitarios**

Run: `npx vitest run test/unit/powers/mcpPolicy.test.ts test/unit/doctor`
Expected: PASS. `npm run typecheck` todavía falla en `src/doctor/doctor.ts` (faltan los campos nuevos de `DoctorEnv`): lo arregla el paso siguiente.

- [ ] **Step 5: Conectar el diagnóstico (capa VS Code)**

`src/doctor/mcpEnv.ts`:

```ts
import * as vscode from 'vscode';
import { isIgnoredBy } from '../powers/mcp/gitignore';
import { readEntries } from '../powers/mcp/mcpJson';
import { findOnPath } from '../powers/mcp/prereqs';
import { Prerequisite, PREREQUISITES } from '../powers/mcp/spec';
import type { ActivePower, PowersService } from '../powers/powersService';
import type { ActiveMcpPower, DoctorEnv } from './checks';

type McpEnv = Pick<DoctorEnv, 'mcpJsonIgnored' | 'prereqs' | 'activeMcp'>;

async function readText(uri: vscode.Uri): Promise<string | undefined> {
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return undefined;
  }
}

/** Estado MCP de la primera carpeta: Powers MCP del lock frente a `.vscode/mcp.json`, prerrequisitos y `.gitignore`. */
export async function collectMcpEnv(powers: PowersService | undefined, folder: vscode.WorkspaceFolder | undefined): Promise<McpEnv> {
  if (!powers || !folder) return { mcpJsonIgnored: 'unknown', prereqs: {}, activeMcp: [] };
  let active: ActivePower[];
  try {
    active = await powers.active(folder);
  } catch {
    active = [];
  }
  const withMcp = active.filter((a) => a.entry.mcp !== undefined);
  const names = withMcp.flatMap((a) => Object.keys(a.entry.mcp!.servers));
  let present: Record<string, unknown>;
  try {
    present = readEntries(await readText(vscode.Uri.joinPath(folder.uri, '.vscode', 'mcp.json')), names);
  } catch {
    present = {};
  }
  const activeMcp: ActiveMcpPower[] = withMcp.map((a) => ({
    id: a.id,
    displayName: a.power?.presentation.displayName ?? a.id,
    mode: a.entry.mcp!.mode,
    prerequisites: a.power?.mcp?.prerequisites ?? [],
    servers: Object.keys(a.entry.mcp!.servers).map((name) => ({
      name,
      inFile: name in present,
      approxTools: a.power?.mcp?.approxTools[name] ?? 0,
    })),
  }));
  const prereqs: Partial<Record<Prerequisite, boolean>> = {};
  for (const p of new Set(activeMcp.flatMap((a) => a.prerequisites))) prereqs[p] = await findOnPath(PREREQUISITES[p].executable);
  const gitignore = await readText(vscode.Uri.joinPath(folder.uri, '.gitignore'));
  return { mcpJsonIgnored: gitignore === undefined ? false : isIgnoredBy(gitignore, '.vscode/mcp.json'), prereqs, activeMcp };
}
```

`src/doctor/doctor.ts` completo:

```ts
import * as vscode from 'vscode';
import type { McpPolicyEnv } from '../powers/mcp/policy';
import type { PowersService } from '../powers/powersService';
import { CheckResult, DoctorEnv, runChecks } from './checks';
import { collectMcpEnv } from './mcpEnv';

/** Fijado por el spike (docs/spike-findings.md, fila 7). */
const STRICT_SETTING = 'chat.customizations.strictPluginOnlyCustomization';
const RAN_FOR_KEY = 'sddStudio.doctorRanFor';

export function isStrictPluginOnly(): boolean {
  const value = vscode.workspace.getConfiguration().get<unknown>(STRICT_SETTING, false);
  return value === true || (Array.isArray(value) && value.length > 0);
}

/** Lo que decide si los Powers con MCP se pueden activar (ver mcpPolicyState). */
export function readMcpPolicyEnv(): McpPolicyEnv {
  return { access: vscode.workspace.getConfiguration('chat').get<unknown>('mcp.access', 'all'), strictPluginOnly: isStrictPluginOnly() };
}

/**
 * getSession({ silent: true }) devuelve undefined hasta que el usuario concede acceso a esta extensión,
 * así que daba un falso "sin sesión". Usamos getAccounts (sin consentimiento) si existe en esta versión;
 * si no existe o falla, el resultado es desconocido y no se avisa.
 */
async function githubSessionState(): Promise<boolean | 'unknown'> {
  const auth: Partial<typeof vscode.authentication> = vscode.authentication;
  if (typeof auth.getAccounts !== 'function') return 'unknown';
  try {
    return (await auth.getAccounts('github')).length > 0;
  } catch {
    return 'unknown';
  }
}

async function collectEnv(context: vscode.ExtensionContext, powers: PowersService | undefined): Promise<DoctorEnv> {
  const chat = vscode.workspace.getConfiguration('chat');
  const githubSignedIn = await githubSessionState();
  const engines: string = context.extension.packageJSON.engines.vscode;
  return {
    vscodeVersion: vscode.version,
    minVersion: engines.replace(/^[^\d]*/, ''),
    copilotChatInstalled: vscode.extensions.getExtension('GitHub.copilot-chat') !== undefined,
    githubSignedIn,
    agentModeEnabled: chat.get<boolean>('agent.enabled', true),
    extensionToolsEnabled: chat.get<boolean>('extensionTools.enabled', true),
    strictPluginOnly: isStrictPluginOnly(),
    mcpAccess: readMcpPolicyEnv().access,
    workspaceTrusted: vscode.workspace.isTrusted,
    ...(await collectMcpEnv(powers, vscode.workspace.workspaceFolders?.[0])),
  };
}

function report(channel: vscode.OutputChannel, results: CheckResult[]): void {
  channel.clear();
  channel.appendLine(`SDD Studio — Diagnóstico (${new Date().toLocaleString()})`);
  for (const r of results) {
    channel.appendLine(`${r.severity === 'info' ? 'ℹ' : r.ok ? '✓' : r.severity === 'error' ? '✗' : '!'} ${r.message}`);
    if (r.action) channel.appendLine(`    → ${r.action}`);
  }
  const problems = results.filter((r) => !r.ok);
  if (problems.length === 0) {
    void vscode.window.showInformationMessage('SDD Studio: todo listo ✓');
    return;
  }
  const fixes = problems.flatMap((r) => (r.fix ? [r.fix] : []));
  const buttons = fixes.length > 0 ? ['Ver detalles', 'Reparar'] : ['Ver detalles'];
  void vscode.window.showWarningMessage(`SDD Studio: ${problems.length} problema(s) de configuración.`, ...buttons).then((pick) => {
    if (pick === 'Ver detalles') channel.show();
    if (pick === 'Reparar') for (const f of fixes) void vscode.commands.executeCommand(f.command, ...f.args);
  });
}

export function registerDoctor(context: vscode.ExtensionContext, powers?: PowersService): vscode.Disposable {
  const channel = vscode.window.createOutputChannel('SDD Studio');
  const command = vscode.commands.registerCommand('sddStudio.doctor', async () => {
    report(channel, runChecks(await collectEnv(context, powers)));
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

En `src/extension.ts`, cambia `registerDoctor(context),` por `registerDoctor(context, powers),`.

- [ ] **Step 6: Verificar**

Run: `npx vitest run && npm run typecheck && npm run lint && node esbuild.mjs`
Expected: todo PASS y el bundle se genera.

Comprueba que el enlace de GitHub responde:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L https://docs.github.com/en/copilot/concepts/mcp-management
```

Expected: `200`. Si no, busca en docs.github.com la página que menciona "MCP servers in Copilot" y cambia `GITHUB_MCP_POLICY_URL`.

- [ ] **Step 7: Commit**

```bash
git add src/powers/mcp/policy.ts src/powers/mcp/prereqs.ts src/powers/mcp/gitignore.ts src/doctor/checks.ts src/doctor/mcpEnv.ts src/doctor/doctor.ts src/extension.ts test/unit/powers/mcpPolicy.test.ts test/unit/doctor/checks.test.ts
git commit -m "feat(doctor): política MCP, prerrequisitos y chequeos MCP del diagnóstico

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Instalador con MCP (activar, actualizar, cambiar modo y desactivar)

**Files:**
- Modify: `src/powers/installer.ts` (completo), `test/integration/helpers.ts` (`restoreFixture` borra `.vscode/`)
- Test: `test/integration/powers.mcp.test.ts`

**Interfaces:**
- Consumes: Tareas 1–5 (`McpSpec`, `McpMode`, `serversForMode`; `addEntries`, `removeEntries`, `readEntries`, `isEmptyMcpFile`, `entryHash`, `McpJsonError`; `LockMcp`, `inputsInUse`, `mcpFileCreatedByUs`; `mcpPolicyState`, `McpPolicyEnv`; `readMcpPolicyEnv`).
- Produces:
  - `PowerErrorCode` gana `'MCP_BLOCKED' | 'MCP_FILE_INVALID' | 'MCP_NAME_CONFLICT' | 'MCP_NO_OPERATE'`.
  - `class PowerError { code; message; fileUri?: vscode.Uri }` (tercer parámetro opcional: archivo que conviene abrir).
  - `type OverwriteReason = 'SKILL_EDITED' | 'MCP_EDITED'`, `type ConfirmOverwrite = (reason: OverwriteReason) => Promise<boolean>`, `type ConfirmMcp = (mcp: McpSpec) => Promise<boolean>`.
  - `class PowerInstaller`:
    - `constructor(readPolicy: () => McpPolicyEnv = readMcpPolicyEnv)`, `policy(): McpPolicyState`, `mcpUri(folder)`.
    - `activate(folder, power, now = new Date(), confirmMcp: ConfirmMcp = async () => true): Promise<'activated' | 'cancelled'>`.
    - `update(folder, power, confirmOverwrite: ConfirmOverwrite, now?): Promise<'updated' | 'cancelled'>`.
    - `setMode(folder, power, mode: McpMode, confirmOverwrite: ConfirmOverwrite): Promise<'changed' | 'cancelled'>`.
    - `deactivate(folder, id, confirmDiscard: ConfirmOverwrite): Promise<'deactivated' | 'cancelled'>`.
    - `protected writeMcpJson(folder, text)` y `protected writeLock(folder, lock)` (los tests los sobrescriben para provocar fallos).
  - El `sha256` del lock pasa a ser `powerHash(power.files)` (el del skill sin MCP).

- [ ] **Step 1: `restoreFixture` limpia `.vscode/`**

En `test/integration/helpers.ts`, dentro de `restoreFixture`, justo después del bucle `for (const dir of ['specs', '.github'])`, añade:

```ts
  try {
    await vscode.workspace.fs.delete(wsUri('.vscode'), { recursive: true });
  } catch {
    // no existía
  }
```

y cambia el comentario de la función a `/** Restaura specs/ y .github/ desde pristine, borra .vscode/ y espera a que los documentos abiertos se sincronicen con el disco. */`.

- [ ] **Step 2: Escribir los tests, que deben fallar**

`test/integration/powers.mcp.test.ts`:

```ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { entryHash } from '../../src/powers/mcp/mcpJson';
import { PowerInstaller } from '../../src/powers/installer';
import { mcpPower, mcpSpec, power } from '../support/powerFixtures';
import { readWs, restoreFixture, ws, wsUri, writeWs } from './helpers';

async function exists(rel: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(wsUri(rel));
    return true;
  } catch {
    return false;
  }
}

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return (e as { code?: string }).code;
  }
}

/** Quita comentarios // de línea y comas finales para poder usar JSON.parse en los asserts. */
async function mcpJson(): Promise<{ servers: Record<string, unknown>; inputs?: { id: string }[] }> {
  const text = await readWs('.vscode/mcp.json');
  return JSON.parse(text.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'));
}

const lock = async () => JSON.parse(await readWs('.github/powers.lock.json'));
const never = async (): Promise<boolean> => {
  throw new Error('no debe pedir confirmación');
};
const yes = async () => true;

const cloudy = mcpPower('cloudy');
const profile = mcpSpec().inputs[0];
const docsy = mcpPower(
  'docsy',
  mcpSpec({
    prerequisites: [],
    inputs: [profile],
    servers: { 'sdd-y': { type: 'stdio', command: 'uvx', args: ['y-mcp@2.0.0'], env: { PROFILE: '${input:sdd_x_profile}' } } },
    approxTools: { 'sdd-y': 1 },
    operate: undefined,
  }),
);
const FOREIGN = '{\n  // mío\n  "servers": {\n    "mine": { "type": "stdio", "command": "my-server" }\n  }\n}\n';

describe('PowerInstaller con MCP', () => {
  const installer = new PowerInstaller(() => ({ access: 'all', strictPluginOnly: false }));
  beforeEach(restoreFixture);

  it('activar escribe skill, .vscode/mcp.json en solo lectura y el lock v2', async () => {
    let asked = 0;
    const r = await installer.activate(ws(), cloudy, new Date('2026-10-01T00:00:00Z'), async (mcp) => (asked++, mcp === cloudy.mcp));
    assert.deepStrictEqual([r, asked], ['activated', 1]);
    assert.match(await readWs('.github/skills/cloudy/SKILL.md'), /sdd-x/);
    const file = await mcpJson();
    assert.deepStrictEqual(file.servers['sdd-x'], cloudy.mcp!.servers['sdd-x']);
    assert.deepStrictEqual(file.inputs!.map((i) => i.id), ['sdd_x_profile', 'sdd_x_region']);
    const l = await lock();
    assert.strictEqual(l.schemaVersion, 2);
    assert.deepStrictEqual(l.powers.cloudy.mcp, {
      mode: 'readOnly',
      servers: { 'sdd-x': entryHash(cloudy.mcp!.servers['sdd-x']) },
      inputs: ['sdd_x_profile', 'sdd_x_region'],
      createdFile: true,
    });
  });

  it('activar conserva comentarios y servidores ajenos (createdFile false)', async () => {
    await writeWs('.vscode/mcp.json', FOREIGN);
    await installer.activate(ws(), cloudy);
    const text = await readWs('.vscode/mcp.json');
    assert.match(text, /\/\/ mío/);
    assert.deepStrictEqual((await mcpJson()).servers.mine, { type: 'stdio', command: 'my-server' });
    assert.strictEqual((await lock()).powers.cloudy.mcp.createdFile, false);
  });

  it('confirmación rechazada: no escribe nada', async () => {
    assert.strictEqual(await installer.activate(ws(), cloudy, new Date(), async () => false), 'cancelled');
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
    assert.strictEqual(await exists('.github/powers.lock.json'), false);
  });

  it('MCP_BLOCKED si la política lo impide, sin escribir nada ni preguntar', async () => {
    const blocked = new PowerInstaller(() => ({ access: 'none', strictPluginOnly: false }));
    assert.strictEqual(await codeOf(blocked.activate(ws(), cloudy, new Date(), never)), 'MCP_BLOCKED');
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
  });

  it('un Power sin MCP se activa aunque la política bloquee MCP', async () => {
    const blocked = new PowerInstaller(() => ({ access: 'none', strictPluginOnly: false }));
    await blocked.activate(ws(), power('alpha'));
    assert.strictEqual((await lock()).schemaVersion, 1);
  });

  it('MCP_FILE_INVALID con .vscode/mcp.json roto: no toca nada e indica el archivo', async () => {
    await writeWs('.vscode/mcp.json', '{ roto');
    let err: { code?: string; fileUri?: vscode.Uri } = {};
    await installer.activate(ws(), cloudy, new Date(), never).catch((e) => (err = e));
    assert.strictEqual(err.code, 'MCP_FILE_INVALID');
    assert.strictEqual(err.fileUri?.path, wsUri('.vscode/mcp.json').path);
    assert.strictEqual(await readWs('.vscode/mcp.json'), '{ roto');
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
  });

  it('MCP_NAME_CONFLICT si ya hay un sdd-x que no es nuestro', async () => {
    const theirs = '{ "servers": { "sdd-x": { "type": "http", "url": "https://otro.dev/mcp" } } }';
    await writeWs('.vscode/mcp.json', theirs);
    assert.strictEqual(await codeOf(installer.activate(ws(), cloudy, new Date(), never)), 'MCP_NAME_CONFLICT');
    assert.strictEqual(await readWs('.vscode/mcp.json'), theirs);
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
  });

  it('rollback si falla escribir .vscode/mcp.json: sin skill y el archivo como estaba', async () => {
    class Flaky extends PowerInstaller {
      protected async writeMcpJson(...args: Parameters<PowerInstaller['writeMcpJson']>): Promise<void> {
        if (args[1].includes('sdd-x')) throw new Error('boom');
        return super.writeMcpJson(...args);
      }
    }
    await writeWs('.vscode/mcp.json', FOREIGN);
    await assert.rejects(new Flaky(() => ({ access: 'all', strictPluginOnly: false })).activate(ws(), cloudy), /boom/);
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
    assert.strictEqual(await readWs('.vscode/mcp.json'), FOREIGN);
    assert.strictEqual(await exists('.github/powers.lock.json'), false);
  });

  it('rollback si falla el lock: .vscode/mcp.json vuelve a no existir', async () => {
    class Flaky extends PowerInstaller {
      protected async writeLock(): Promise<void> {
        throw new Error('boom');
      }
    }
    await assert.rejects(new Flaky(() => ({ access: 'all', strictPluginOnly: false })).activate(ws(), cloudy), /boom/);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
  });

  it('setMode: a Operar y de vuelta; el lock guarda el modo y el hash', async () => {
    await installer.activate(ws(), cloudy);
    assert.strictEqual(await installer.setMode(ws(), cloudy, 'operate', never), 'changed');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], cloudy.mcp!.operate!.servers['sdd-x']);
    let l = await lock();
    assert.strictEqual(l.powers.cloudy.mcp.mode, 'operate');
    assert.strictEqual(l.powers.cloudy.mcp.servers['sdd-x'], entryHash(cloudy.mcp!.operate!.servers['sdd-x']));
    await installer.setMode(ws(), cloudy, 'readOnly', never);
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], cloudy.mcp!.servers['sdd-x']);
    l = await lock();
    assert.strictEqual(l.powers.cloudy.mcp.mode, 'readOnly');
  });

  it('setMode a Operar en un Power sin operate: MCP_NO_OPERATE', async () => {
    await installer.activate(ws(), docsy);
    assert.strictEqual(await codeOf(installer.setMode(ws(), docsy, 'operate', never)), 'MCP_NO_OPERATE');
  });

  it('MCP_EDITED: entrada editada a mano pide confirmar; cancelar no toca nada', async () => {
    await installer.activate(ws(), cloudy);
    const edited = (await readWs('.vscode/mcp.json')).replace('x-mcp-server@1.0.0', 'x-mcp-server@9.9.9');
    await writeWs('.vscode/mcp.json', edited);
    const reasons: string[] = [];
    const r = await installer.setMode(ws(), cloudy, 'operate', async (why) => (reasons.push(why), false));
    assert.deepStrictEqual([r, reasons], ['cancelled', ['MCP_EDITED']]);
    assert.strictEqual(await readWs('.vscode/mcp.json'), edited);
    assert.strictEqual((await lock()).powers.cloudy.mcp.mode, 'readOnly');
    assert.strictEqual(await installer.setMode(ws(), cloudy, 'operate', yes), 'changed');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], cloudy.mcp!.operate!.servers['sdd-x']);
  });

  it('update reescribe en el modo actual y repara una entrada borrada sin preguntar', async () => {
    await installer.activate(ws(), cloudy);
    await installer.setMode(ws(), cloudy, 'operate', never);
    await writeWs('.vscode/mcp.json', '{ "servers": {}, "inputs": [] }');
    const v2 = mcpPower('cloudy', cloudy.mcp, cloudy.files, '1.1.0');
    assert.strictEqual(await installer.update(ws(), v2, never), 'updated');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-x'], cloudy.mcp!.operate!.servers['sdd-x']);
    assert.strictEqual((await lock()).powers.cloudy.version, '1.1.0');
  });

  it('update con entrada editada y confirm false: cancelled sin tocar nada', async () => {
    await installer.activate(ws(), cloudy);
    const edited = (await readWs('.vscode/mcp.json')).replace('"READ_ONLY": "true"', '"READ_ONLY": "false"');
    await writeWs('.vscode/mcp.json', edited);
    const v2 = mcpPower('cloudy', cloudy.mcp, cloudy.files, '1.1.0');
    assert.strictEqual(await installer.update(ws(), v2, async () => false), 'cancelled');
    assert.strictEqual(await readWs('.vscode/mcp.json'), edited);
    assert.strictEqual((await lock()).powers.cloudy.version, '1.0.0');
  });

  it('desactivar quita entradas e inputs y borra el archivo si lo creamos y queda vacío', async () => {
    await installer.activate(ws(), cloudy);
    assert.strictEqual(await installer.deactivate(ws(), 'cloudy', never), 'deactivated');
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
    assert.strictEqual(await exists('.github/skills/cloudy'), false);
    const l = await lock();
    assert.deepStrictEqual([l.schemaVersion, l.powers], [1, {}]);
  });

  it('desactivar deja el archivo ajeno como estaba antes de activar', async () => {
    await writeWs('.vscode/mcp.json', FOREIGN);
    await installer.activate(ws(), cloudy);
    await installer.deactivate(ws(), 'cloudy', never);
    const file = await mcpJson();
    assert.deepStrictEqual(Object.keys(file.servers), ['mine']);
    assert.deepStrictEqual(file.inputs ?? [], []);
    assert.match(await readWs('.vscode/mcp.json'), /\/\/ mío/);
  });

  it('inputs compartidos: se quitan solo cuando ningún Power activo los usa', async () => {
    await installer.activate(ws(), cloudy);
    await installer.activate(ws(), docsy);
    assert.deepStrictEqual((await mcpJson()).inputs!.map((i) => i.id), ['sdd_x_profile', 'sdd_x_region']);
    await installer.deactivate(ws(), 'cloudy', never);
    const file = await mcpJson();
    assert.deepStrictEqual(Object.keys(file.servers), ['sdd-y']);
    assert.deepStrictEqual(file.inputs!.map((i) => i.id), ['sdd_x_profile']);
    await installer.deactivate(ws(), 'docsy', never);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
  });

  it('el archivo creado por el primer Power se borra al desactivar el último', async () => {
    await installer.activate(ws(), cloudy);
    await installer.activate(ws(), docsy);
    assert.strictEqual((await lock()).powers.docsy.mcp.createdFile, true);
    await installer.deactivate(ws(), 'docsy', never);
    await installer.deactivate(ws(), 'cloudy', never);
    assert.strictEqual(await exists('.vscode/mcp.json'), false);
  });

  it('desactivar con una entrada editada pide confirmar (MCP_EDITED); cancelar conserva todo', async () => {
    await installer.activate(ws(), cloudy);
    const edited = (await readWs('.vscode/mcp.json')).replace('"READ_ONLY": "true"', '"READ_ONLY": "maybe"');
    await writeWs('.vscode/mcp.json', edited);
    const reasons: string[] = [];
    assert.strictEqual(await installer.deactivate(ws(), 'cloudy', async (why) => (reasons.push(why), false)), 'cancelled');
    assert.deepStrictEqual(reasons, ['MCP_EDITED']);
    assert.strictEqual(await readWs('.vscode/mcp.json'), edited);
    assert.strictEqual(await exists('.github/skills/cloudy/SKILL.md'), true);
  });
});
```

- [ ] **Step 3: Ejecutarlos y ver que fallan**

Run: `npm run compile:tests`
Expected: FAIL de compilación: `setMode` no existe en `PowerInstaller`, `PowerInstaller` no acepta argumentos y `writeMcpJson` no existe. (Ese es el "rojo" de esta tarea; los tests de integración no se pueden ejecutar sin compilar).

- [ ] **Step 4: Implementar — `src/powers/installer.ts` completo**

```ts
import * as vscode from 'vscode';
import { readMcpPolicyEnv } from '../doctor/doctor';
import { isSafeRelativePath, isValidId } from './catalog';
import { powerHash } from './hash';
import { inputsInUse, LockEntry, Lockfile, LockMcp, mcpFileCreatedByUs, parseLock, serializeLock, withEntry, withoutEntry } from './lock';
import { addEntries, entryHash, isEmptyMcpFile, McpJsonError, readEntries, removeEntries } from './mcp/mcpJson';
import { McpPolicyEnv, McpPolicyState, mcpPolicyState } from './mcp/policy';
import { McpMode, McpSpec, serversForMode } from './mcp/spec';
import { CatalogPower } from './types';

export type PowerErrorCode =
  | 'FOREIGN_SKILL'
  | 'NOT_INSTALLED'
  | 'UNSAFE_PATH'
  | 'NOT_FOUND'
  | 'LOCK_INVALID'
  | 'MCP_BLOCKED'
  | 'MCP_FILE_INVALID'
  | 'MCP_NAME_CONFLICT'
  | 'MCP_NO_OPERATE';

export class PowerError extends Error {
  constructor(
    readonly code: PowerErrorCode,
    message: string,
    /** Archivo que conviene abrir para arreglar el problema (MCP_FILE_INVALID). */
    readonly fileUri?: vscode.Uri,
  ) {
    super(message);
    this.name = 'PowerError';
  }
}

/** Por qué se pide confirmar antes de sobrescribir o borrar: el skill o una entrada de `.vscode/mcp.json` cambiaron a mano. */
export type OverwriteReason = 'SKILL_EDITED' | 'MCP_EDITED';
export type ConfirmOverwrite = (reason: OverwriteReason) => Promise<boolean>;
/** Confirmación modal antes de añadir servidores MCP (spec §6.3, paso 4). */
export type ConfirmMcp = (mcp: McpSpec) => Promise<boolean>;

interface McpPlan {
  before: string | undefined;
  /** undefined = borrar `.vscode/mcp.json`. */
  after: string | undefined;
  lock: LockMcp | undefined;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function isNotFound(e: unknown): boolean {
  return e instanceof vscode.FileSystemError && e.code === 'FileNotFound';
}

async function readText(uri: vscode.Uri): Promise<string | undefined> {
  try {
    return decoder.decode(await vscode.workspace.fs.readFile(uri));
  } catch (e) {
    if (isNotFound(e)) return undefined;
    throw e;
  }
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch (e) {
    if (isNotFound(e)) return false;
    throw e;
  }
}

const under = (base: vscode.Uri, rel: string) => vscode.Uri.joinPath(base, ...rel.split('/'));

export class PowerInstaller {
  constructor(private readonly readPolicy: () => McpPolicyEnv = readMcpPolicyEnv) {}

  policy(): McpPolicyState {
    return mcpPolicyState(this.readPolicy());
  }

  lockUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, '.github', 'powers.lock.json');
  }

  mcpUri(folder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, '.vscode', 'mcp.json');
  }

  skillDir(folder: vscode.WorkspaceFolder, skillName: string): vscode.Uri {
    return vscode.Uri.joinPath(folder.uri, '.github', 'skills', skillName);
  }

  async readLock(folder: vscode.WorkspaceFolder): Promise<Lockfile> {
    const text = await readText(this.lockUri(folder));
    try {
      return parseLock(text);
    } catch (e) {
      throw new PowerError('LOCK_INVALID', `${(e as Error).message} Corrígelo o bórralo para continuar.`);
    }
  }

  async activate(
    folder: vscode.WorkspaceFolder,
    power: CatalogPower,
    now: Date = new Date(),
    confirmMcp: ConfirmMcp = async () => true,
  ): Promise<'activated' | 'cancelled'> {
    this.assertSafe(power.skillName, Object.keys(power.files));
    const lock = await this.readLock(folder);
    if (lock.powers[power.id]) return 'activated';
    if (await exists(this.skillDir(folder, power.skillName))) {
      throw new PowerError(
        'FOREIGN_SKILL',
        `Ya existe un skill "${power.skillName}" que no instaló SDD Studio (.github/skills/${power.skillName}/). Renómbralo o bórralo para activar este Power.`,
      );
    }
    const plan = power.mcp ? await this.planMcp(folder, lock, power.id, { spec: power.mcp, mode: 'readOnly' }) : undefined;
    if (plan === 'cancelled') return 'cancelled';
    if (power.mcp && !(await confirmMcp(power.mcp))) return 'cancelled';
    try {
      await this.writeFiles(folder, power);
      if (plan) await this.applyMcp(folder, plan);
      await this.writeLock(folder, withEntry(lock, power.id, this.entryFor(power, now, plan?.lock)));
    } catch (e) {
      const dir = this.skillDir(folder, power.skillName);
      for (const rel of Object.keys(power.files)) await this.deleteIfExists(under(dir, rel));
      await this.pruneEmptyDirs(dir);
      if (plan) await this.restoreMcp(folder, plan.before);
      throw e;
    }
    return 'activated';
  }

  async update(
    folder: vscode.WorkspaceFolder,
    power: CatalogPower,
    confirmOverwrite: ConfirmOverwrite,
    now: Date = new Date(),
  ): Promise<'updated' | 'cancelled'> {
    this.assertSafe(power.skillName, Object.keys(power.files));
    const lock = await this.readLock(folder);
    const entry = lock.powers[power.id];
    if (!entry) throw new PowerError('NOT_INSTALLED', `El Power "${power.id}" no está activo en este repo.`);
    this.assertSafe(entry.skillName, entry.files);
    if (entry.skillName !== power.skillName) {
      throw new PowerError('UNSAFE_PATH', `El Power "${power.id}" cambió de nombre de skill; desactívalo y vuelve a activarlo.`);
    }
    const dir = this.skillDir(folder, entry.skillName);
    if (await this.skillEdited(dir, entry)) {
      if (!(await confirmOverwrite('SKILL_EDITED'))) return 'cancelled';
    }
    const mode: McpMode = power.mcp?.operate ? (entry.mcp?.mode ?? 'readOnly') : 'readOnly';
    const target = power.mcp ? { spec: power.mcp, mode } : undefined;
    const plan = power.mcp || entry.mcp ? await this.planMcp(folder, lock, power.id, target, confirmOverwrite) : undefined;
    if (plan === 'cancelled') return 'cancelled';
    await this.writeFiles(folder, power);
    for (const rel of entry.files) if (!(rel in power.files)) await this.deleteIfExists(under(dir, rel));
    await this.pruneEmptyDirs(dir);
    if (plan) await this.applyMcp(folder, plan);
    await this.writeLock(folder, withEntry(lock, power.id, this.entryFor(power, now, plan?.lock)));
    return 'updated';
  }

  /** Reescribe las entradas MCP del Power en `mode`. También repara entradas que faltan (acción "Reparar" del diagnóstico). */
  async setMode(
    folder: vscode.WorkspaceFolder,
    power: CatalogPower,
    mode: McpMode,
    confirmOverwrite: ConfirmOverwrite,
  ): Promise<'changed' | 'cancelled'> {
    const lock = await this.readLock(folder);
    const entry = lock.powers[power.id];
    if (!entry?.mcp || !power.mcp) throw new PowerError('NOT_INSTALLED', `El Power "${power.id}" no tiene servidores MCP activos en este repo.`);
    if (mode === 'operate' && !power.mcp.operate) {
      throw new PowerError('MCP_NO_OPERATE', `El Power "${power.presentation.displayName}" no tiene modo Operar.`);
    }
    const plan = await this.planMcp(folder, lock, power.id, { spec: power.mcp, mode }, confirmOverwrite);
    if (plan === 'cancelled') return 'cancelled';
    await this.applyMcp(folder, plan);
    await this.writeLock(folder, withEntry(lock, power.id, { ...entry, mcp: plan.lock }));
    return 'changed';
  }

  async deactivate(
    folder: vscode.WorkspaceFolder,
    id: string,
    confirmDiscard: ConfirmOverwrite,
  ): Promise<'deactivated' | 'cancelled'> {
    const lock = await this.readLock(folder);
    const entry = lock.powers[id];
    if (!entry) throw new PowerError('NOT_INSTALLED', `El Power "${id}" no está activo en este repo.`);
    this.assertSafe(entry.skillName, entry.files);
    const dir = this.skillDir(folder, entry.skillName);
    if (await this.skillEdited(dir, entry)) {
      if (!(await confirmDiscard('SKILL_EDITED'))) return 'cancelled';
    }
    const plan = entry.mcp ? await this.planMcp(folder, lock, id, undefined, confirmDiscard) : undefined;
    if (plan === 'cancelled') return 'cancelled';
    if (plan) await this.applyMcp(folder, plan);
    for (const rel of entry.files) await this.deleteIfExists(under(dir, rel));
    await this.pruneEmptyDirs(dir);
    await this.writeLock(folder, withoutEntry(lock, id));
    return 'deactivated';
  }

  /**
   * Calcula el nuevo `.vscode/mcp.json` para pasar de lo que el lock registra de `id` a `target` (undefined = quitar todo).
   * Lanza MCP_BLOCKED, MCP_FILE_INVALID o MCP_NAME_CONFLICT antes de tocar nada.
   */
  private async planMcp(
    folder: vscode.WorkspaceFolder,
    lock: Lockfile,
    id: string,
    target: { spec: McpSpec; mode: McpMode } | undefined,
    confirmOverwrite?: ConfirmOverwrite,
  ): Promise<McpPlan | 'cancelled'> {
    if (target) {
      const policy = this.policy();
      if (policy.state === 'blocked') {
        throw new PowerError('MCP_BLOCKED', `Tu organización bloquea los servidores MCP (${policy.reason}). Ejecuta "SDD Studio: Diagnóstico" para más detalles.`);
      }
    }
    const current = lock.powers[id]?.mcp;
    const currentNames = Object.keys(current?.servers ?? {});
    const targetServers = target ? serversForMode(target.spec, target.mode) : {};
    const before = await readText(this.mcpUri(folder));
    let present: Record<string, unknown>;
    try {
      present = readEntries(before, [...new Set([...currentNames, ...Object.keys(targetServers)])]);
    } catch (e) {
      if (!(e instanceof McpJsonError)) throw e;
      throw new PowerError('MCP_FILE_INVALID', `${e.message} Corrige .vscode/mcp.json y reintenta.`, this.mcpUri(folder));
    }
    const foreign = Object.keys(targetServers).find((n) => !currentNames.includes(n) && n in present);
    if (foreign) throw new PowerError('MCP_NAME_CONFLICT', `Ya existe un servidor "${foreign}" en .vscode/mcp.json que no instaló SDD Studio.`);
    const edited = currentNames.some((n) => n in present && entryHash(present[n]) !== current!.servers[n]);
    if (edited && confirmOverwrite && !(await confirmOverwrite('MCP_EDITED'))) return 'cancelled';

    const targetInputs = target?.spec.inputs.map((i) => i.id) ?? [];
    const keep = inputsInUse(lock, id);
    const dropInputs = (current?.inputs ?? []).filter((i) => !targetInputs.includes(i) && !keep.has(i));
    let after = removeEntries(before, currentNames.filter((n) => !(n in targetServers)), dropInputs);
    if (target) after = addEntries(after, targetServers, target.spec.inputs);
    const createdFile = current?.createdFile ?? (before === undefined || mcpFileCreatedByUs(lock, id));
    const deleteFile = !target && createdFile && isEmptyMcpFile(after);
    return {
      before,
      after: deleteFile ? undefined : after,
      lock: target
        ? {
            mode: target.mode,
            servers: Object.fromEntries(Object.entries(targetServers).map(([n, s]) => [n, entryHash(s)])),
            inputs: [...targetInputs].sort(),
            createdFile,
          }
        : undefined,
    };
  }

  private async skillEdited(dir: vscode.Uri, entry: LockEntry): Promise<boolean> {
    const onDisk: Record<string, string> = {};
    for (const rel of entry.files) {
      const text = await readText(under(dir, rel));
      if (text === undefined) return true;
      onDisk[rel] = text;
    }
    return powerHash(onDisk) !== entry.sha256;
  }

  private assertSafe(skillName: string, paths: string[]): void {
    if (!isValidId(skillName) || !paths.every(isSafeRelativePath)) {
      throw new PowerError('UNSAFE_PATH', `El Power "${skillName}" contiene rutas de archivo no permitidas; no se instaló nada.`);
    }
  }

  /** El sha256 del lock es el de los archivos del skill (sin MCP): así se detectan ediciones locales. */
  private entryFor(power: CatalogPower, now: Date, mcp: LockMcp | undefined): LockEntry {
    return {
      version: power.version,
      skillName: power.skillName,
      sha256: powerHash(power.files),
      files: Object.keys(power.files).sort(),
      installedAt: now.toISOString(),
      ...(mcp ? { mcp } : {}),
    };
  }

  private async writeFiles(folder: vscode.WorkspaceFolder, power: CatalogPower): Promise<void> {
    const dir = this.skillDir(folder, power.skillName);
    for (const [rel, content] of Object.entries(power.files)) {
      const uri = under(dir, rel);
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
      await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
    }
  }

  private async applyMcp(folder: vscode.WorkspaceFolder, plan: McpPlan): Promise<void> {
    if (plan.after === undefined) await this.deleteIfExists(this.mcpUri(folder));
    else if (plan.after !== plan.before) await this.writeMcpJson(folder, plan.after);
  }

  private async restoreMcp(folder: vscode.WorkspaceFolder, before: string | undefined): Promise<void> {
    if (before === undefined) await this.deleteIfExists(this.mcpUri(folder));
    else await this.writeMcpJson(folder, before);
  }

  protected async writeMcpJson(folder: vscode.WorkspaceFolder, text: string): Promise<void> {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, '.vscode'));
    await vscode.workspace.fs.writeFile(this.mcpUri(folder), encoder.encode(text));
  }

  protected async writeLock(folder: vscode.WorkspaceFolder, lock: Lockfile): Promise<void> {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, '.github'));
    await vscode.workspace.fs.writeFile(this.lockUri(folder), encoder.encode(serializeLock(lock)));
  }

  private async deleteIfExists(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri);
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }

  private async pruneEmptyDirs(dir: vscode.Uri): Promise<void> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dir);
    } catch (e) {
      if (isNotFound(e)) return;
      throw e;
    }
    for (const [name, type] of entries) {
      if (type === vscode.FileType.Directory) await this.pruneEmptyDirs(vscode.Uri.joinPath(dir, name));
    }
    if ((await vscode.workspace.fs.readDirectory(dir)).length === 0) await vscode.workspace.fs.delete(dir);
  }
}
```

- [ ] **Step 5: Ejecutar los tests**

Run: `npm run typecheck && npm run lint && npx vitest run && npm run test:integration`
Expected: todo PASS, incluidos los 13 tests de `PowerInstaller` existentes (sus `confirm` sin parámetros siguen siendo válidos como `ConfirmOverwrite`) y los 19 nuevos de `PowerInstaller con MCP`.

- [ ] **Step 6: Commit**

```bash
git add src/powers/installer.ts test/integration/helpers.ts test/integration/powers.mcp.test.ts
git commit -m "feat(powers): el instalador fusiona, cambia de modo y retira servidores MCP con rollback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Servicio, comandos y modal de activación (`sddStudio.setPowerMode`)

**Files:**
- Create: `src/powers/mcp/messages.ts`
- Modify: `src/powers/powersService.ts`, `src/powers/commands.ts` (completo), `package.json` (comando nuevo)
- Test: `test/unit/powers/mcpMessages.test.ts`, `test/integration/powers.mcp.service.test.ts`

**Interfaces:**
- Consumes: de la Tarea 6, `ConfirmMcp`, `ConfirmOverwrite`, `OverwriteReason`, `PowerInstaller.policy()`, `setMode`, `PowerError.fileUri`; de la Tarea 5, `findOnPath`, `McpPolicyState`; de la Tarea 1, `MCP_MODES`, `MODE_LABELS`, `PREREQUISITES`, `serverKind`, `serverCommandLine`.
- Produces:
  - `messages.ts`: `activationDetail(spec: McpSpec, missing: Prerequisite[], policy: McpPolicyState): string`, `overwriteQuestion(reason: OverwriteReason, displayName: string, skillName: string, action: 'update' | 'mode' | 'deactivate'): string`.
  - `PowersService`: `policy(): McpPolicyState`; `activate(id, folder, confirmMcp?: ConfirmMcp): Promise<'activated' | 'cancelled'>`; `setMode(id, folder, mode: McpMode, confirm: ConfirmOverwrite): Promise<'changed' | 'cancelled'>`; `update`/`deactivate` reciben `ConfirmOverwrite`; `PowerView.mode?: McpMode`.
  - `commands.ts`: `MCP_LIST_SERVERS_COMMAND = 'workbench.mcp.listServer'` (valor de la comprobación 3 del spike); comando `sddStudio.setPowerMode` con argumento `string | { id; folder?; mode?: McpMode }` (sin `mode`, pregunta con un QuickPick; a `operate`, modal con `operate.warning`).

- [ ] **Step 1: Escribir los tests, que deben fallar**

`test/unit/powers/mcpMessages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { activationDetail, overwriteQuestion } from '../../../src/powers/mcp/messages';
import { mcpSpec } from '../../support/powerFixtures';

describe('activationDetail', () => {
  it('lista servidores locales con su comando y remotos con su URL', () => {
    const spec = mcpSpec({
      inputs: [],
      servers: {
        'sdd-a': { type: 'stdio', command: 'npx', args: ['-y', 'a@1.0.0'] },
        'sdd-b': { type: 'http', url: 'https://b.dev/mcp' },
      },
      approxTools: { 'sdd-a': 1, 'sdd-b': 1 },
      operate: undefined,
    });
    const text = activationDetail(spec, [], { state: 'allowed' });
    expect(text).toContain('• sdd-a: LOCAL, ejecuta código en tu máquina: npx -y a@1.0.0');
    expect(text).toContain('• sdd-b: remoto, https://b.dev/mcp');
    expect(text).toContain('Credenciales: Perfil local.');
    expect(text).not.toContain('beta');
    expect(text).not.toContain('Falta en tu PATH');
  });
  it('avisa de prerrequisitos que faltan (con enlace), beta y política de registro', () => {
    const text = activationDetail(mcpSpec({ beta: true }), ['uv'], { state: 'registryOnly', reason: 'x' });
    expect(text).toContain('• uv: https://docs.astral.sh/uv/getting-started/installation/');
    expect(text).toContain('versión beta');
    expect(text).toContain('solo permite servidores de su registro');
  });
});

describe('overwriteQuestion', () => {
  it('nombra el skill o mcp.json según el motivo', () => {
    expect(overwriteQuestion('SKILL_EDITED', 'AWS', 'aws', 'update')).toBe('"AWS" tiene cambios hechos a mano en .github/skills/aws/. ¿Sobrescribir esos cambios?');
    expect(overwriteQuestion('MCP_EDITED', 'AWS', 'aws', 'deactivate')).toBe(
      '"AWS" tiene cambios hechos a mano en sus servidores en .vscode/mcp.json. ¿Desactivarlo y descartar esos cambios?',
    );
  });
});
```

`test/integration/powers.mcp.service.test.ts` (la galería se añade en la Tarea 8):

```ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { catalog, mcpPower, power } from '../support/powerFixtures';
import { getApi, readWs, restoreFixture, ws, writeWs } from './helpers';

const FUTURE = '2999-01-01T00:00:00.000Z';
const cloudy = mcpPower('cloudy');
const never = async (): Promise<boolean> => {
  throw new Error('no debe pedir confirmación');
};

describe('PowersService y comandos con MCP', () => {
  beforeEach(async () => {
    await restoreFixture();
    const { powers } = await getApi();
    powers.setFetcher(async () => JSON.stringify(catalog([power('alpha'), cloudy], FUTURE)));
    await powers.refreshOnline();
  });
  afterEach(async () => {
    const { powers } = await getApi();
    await powers.resetCatalog();
  });

  it('activar, ver el modo, cambiarlo y desactivar', async () => {
    const { powers } = await getApi();
    assert.strictEqual(powers.policy().state, 'allowed');
    assert.strictEqual(await powers.activate('cloudy', ws(), async () => true), 'activated');
    let view = (await powers.views(ws())).find((v) => v.power.id === 'cloudy')!;
    assert.deepStrictEqual([view.status, view.mode], ['active', 'readOnly']);
    assert.strictEqual(await powers.setMode('cloudy', ws(), 'operate', never), 'changed');
    view = (await powers.views(ws())).find((v) => v.power.id === 'cloudy')!;
    assert.strictEqual(view.mode, 'operate');
    assert.strictEqual((await powers.views(ws())).find((v) => v.power.id === 'alpha')!.mode, undefined);
    assert.strictEqual(await powers.deactivate('cloudy', ws(), never), 'deactivated');
  });

  it('activar cancelado en la confirmación no cambia nada', async () => {
    const { powers } = await getApi();
    assert.strictEqual(await powers.activate('cloudy', ws(), async () => false), 'cancelled');
    assert.deepStrictEqual(await powers.active(ws()), []);
  });

  it('sddStudio.setPowerMode en Solo lectura repara una entrada borrada (acción del diagnóstico)', async () => {
    const { powers } = await getApi();
    await powers.activate('cloudy', ws(), async () => true);
    await writeWs('.vscode/mcp.json', '{ "servers": {} }');
    await vscode.commands.executeCommand('sddStudio.setPowerMode', { id: 'cloudy', mode: 'readOnly' });
    assert.match(await readWs('.vscode/mcp.json'), /"sdd-x"/);
  });

  it('el comando sddStudio.setPowerMode está registrado', async () => {
    assert.ok((await vscode.commands.getCommands(true)).includes('sddStudio.setPowerMode'));
  });
});
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx vitest run test/unit/powers/mcpMessages.test.ts && npm run compile:tests`
Expected: FAIL, no existe `mcp/messages` y `PowersService` no tiene `policy` ni `setMode`.

- [ ] **Step 3: Implementar**

`src/powers/mcp/messages.ts`:

```ts
import type { McpPolicyState } from './policy';
import { Prerequisite, PREREQUISITES, McpSpec, serverCommandLine, serverKind } from './spec';

/** Texto del modal de activación (spec §6.3, paso 4): servidores, código local, prerrequisitos que faltan y beta. */
export function activationDetail(spec: McpSpec, missing: Prerequisite[], policy: McpPolicyState): string {
  const lines = ['Se añadirán a .vscode/mcp.json (modo Solo lectura):'];
  for (const [name, server] of Object.entries(spec.servers)) {
    lines.push(
      serverKind(server) === 'local'
        ? `• ${name}: LOCAL, ejecuta código en tu máquina: ${serverCommandLine(server)}`
        : `• ${name}: remoto, ${serverCommandLine(server)}`,
    );
  }
  lines.push(`Credenciales: ${spec.credentials}.`);
  if (missing.length > 0) {
    lines.push('', 'Falta en tu PATH (instálalo antes de iniciar el servidor):');
    for (const p of missing) lines.push(`• ${PREREQUISITES[p].label}: ${PREREQUISITES[p].url}`);
  }
  if (spec.beta) lines.push('', 'Atención: el servidor está en versión beta.');
  if (policy.state === 'registryOnly') lines.push('', 'Tu organización solo permite servidores de su registro: puede que VS Code no deje iniciarlo.');
  lines.push('', 'VS Code te pedirá confiar en el servidor antes de iniciarlo. Nunca se guardan secretos en el repo.');
  return lines.join('\n');
}

/** Pregunta antes de sobrescribir o borrar algo editado a mano. */
export function overwriteQuestion(reason: 'SKILL_EDITED' | 'MCP_EDITED', displayName: string, skillName: string, action: 'update' | 'mode' | 'deactivate'): string {
  const where = reason === 'MCP_EDITED' ? 'sus servidores en .vscode/mcp.json' : `.github/skills/${skillName}/`;
  const verb = action === 'deactivate' ? '¿Desactivarlo y descartar esos cambios?' : '¿Sobrescribir esos cambios?';
  return `"${displayName}" tiene cambios hechos a mano en ${where}. ${verb}`;
}
```

`src/powers/powersService.ts`:
- Importaciones: sustituye `import { PowerError, PowerInstaller } from './installer';` por:
  ```ts
  import { ConfirmMcp, ConfirmOverwrite, PowerError, PowerInstaller } from './installer';
  ```
  y añade después de la importación de `./lock`:
  ```ts
  import type { McpPolicyState } from './mcp/policy';
  import type { McpMode } from './mcp/spec';
  ```
- `PowerView` gana, después de `installedVersion?: string;`:
  ```ts
    /** Modo MCP activo (solo Powers con MCP activos). */
    mode?: McpMode;
  ```
- En `views`, el objeto devuelto pasa a ser `{ power, status: powerStatus(power, entry), installedVersion: entry?.version, mode: entry?.mcp?.mode }`.
- Sustituye los métodos `activate`, `update` y `deactivate` por:

```ts
  policy(): McpPolicyState {
    return this.installer.policy();
  }

  async activate(id: string, folder: vscode.WorkspaceFolder, confirmMcp?: ConfirmMcp): Promise<'activated' | 'cancelled'> {
    const result = await this.installer.activate(folder, await this.find(id), undefined, confirmMcp);
    if (result === 'activated') this.emitter.fire();
    return result;
  }

  async setMode(id: string, folder: vscode.WorkspaceFolder, mode: McpMode, confirm: ConfirmOverwrite): Promise<'changed' | 'cancelled'> {
    const result = await this.installer.setMode(folder, await this.find(id), mode, confirm);
    if (result === 'changed') this.emitter.fire();
    return result;
  }

  async update(id: string, folder: vscode.WorkspaceFolder, confirm: ConfirmOverwrite): Promise<'updated' | 'cancelled'> {
    const result = await this.installer.update(folder, await this.find(id), confirm);
    if (result === 'updated') this.emitter.fire();
    return result;
  }

  async deactivate(id: string, folder: vscode.WorkspaceFolder, confirmDiscard: ConfirmOverwrite): Promise<'deactivated' | 'cancelled'> {
    const result = await this.installer.deactivate(folder, id, confirmDiscard);
    if (result === 'deactivated') this.emitter.fire();
    return result;
  }
```

`src/powers/commands.ts` completo:

```ts
import * as vscode from 'vscode';
import { SpecStore } from '../workspace/specStore';
import { GalleryController } from './galleryPanel';
import { PowerError } from './installer';
import { activationDetail, overwriteQuestion } from './mcp/messages';
import { findOnPath } from './mcp/prereqs';
import { MCP_MODES, McpMode, McpSpec, MODE_LABELS, Prerequisite, PREREQUISITES } from './mcp/spec';
import { PowersService } from './powersService';
import { CatalogPower } from './types';

/** Comando de VS Code que lista los servidores MCP. Fijado por el spike (Tarea 0, comprobación 3). */
export const MCP_LIST_SERVERS_COMMAND = 'workbench.mcp.listServer';

export interface PowersDeps {
  powers: PowersService;
  store: SpecStore;
  gallery: GalleryController;
}

type PowerArg = string | { id?: unknown; folder?: string | vscode.WorkspaceFolder; mode?: unknown };

function normalize(arg: PowerArg | undefined): { id?: string; folderName?: string; mode?: McpMode } {
  if (typeof arg === 'string') return { id: arg };
  if (arg && typeof arg === 'object' && typeof arg.id === 'string') {
    return {
      id: arg.id,
      folderName: typeof arg.folder === 'string' ? arg.folder : arg.folder?.name,
      mode: MCP_MODES.includes(arg.mode as McpMode) ? (arg.mode as McpMode) : undefined,
    };
  }
  return {};
}

async function pickFolder(store: SpecStore, name?: string): Promise<vscode.WorkspaceFolder | undefined> {
  if (name) return store.folderByName(name);
  const folders = store.folders();
  if (folders.length <= 1) return folders[0];
  return vscode.window.showWorkspaceFolderPick({ placeHolder: '¿En qué carpeta?' });
}

async function guarded(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof PowerError) {
      if (e.code === 'MCP_BLOCKED') {
        const pick = await vscode.window.showErrorMessage(`SDD Studio: ${e.message}`, 'Ver diagnóstico');
        if (pick) await vscode.commands.executeCommand('sddStudio.doctor');
        return;
      }
      void vscode.window.showErrorMessage(`SDD Studio: ${e.message}`);
      if (e.fileUri) await vscode.window.showTextDocument(e.fileUri);
      return;
    }
    throw e;
  }
}

function requireTrust(): boolean {
  if (vscode.workspace.isTrusted) return true;
  void vscode.window.showWarningMessage('SDD Studio: confía en este workspace para activar o actualizar Powers.');
  return false;
}

async function confirmModal(question: string, button: string, detail?: string): Promise<boolean> {
  return (await vscode.window.showWarningMessage(question, { modal: true, detail }, button)) === button;
}

async function confirmMcpActivation(p: CatalogPower, spec: McpSpec, powers: PowersService): Promise<boolean> {
  const missing: Prerequisite[] = [];
  for (const req of spec.prerequisites) if (!(await findOnPath(PREREQUISITES[req].executable))) missing.push(req);
  return confirmModal(
    `¿Activar "${p.presentation.displayName}" con servidores MCP?`,
    'Activar',
    activationDetail(spec, missing, powers.policy()),
  );
}

async function checkUpdates(powers: PowersService): Promise<void> {
  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'SDD Studio: buscando actualizaciones de Powers…' },
    () => powers.refreshOnline(),
  );
  switch (result.kind) {
    case 'updated':
      void vscode.window.showInformationMessage(`SDD Studio: catálogo actualizado, ${result.powers} Powers disponibles.`);
      break;
    case 'current':
      void vscode.window.showInformationMessage('SDD Studio: ya tienes el catálogo de Powers más reciente.');
      break;
    case 'invalid':
      void vscode.window.showWarningMessage('SDD Studio: el catálogo descargado no es válido; se sigue usando el actual.');
      break;
    case 'error':
      void vscode.window.showWarningMessage(`SDD Studio: no se pudo descargar el catálogo (${result.message}). Se sigue usando el catálogo incluido.`);
      break;
  }
}

export function registerPowerCommands(deps: PowersDeps): vscode.Disposable {
  const withPower =
    (fn: (id: string, folder: vscode.WorkspaceFolder, mode?: McpMode) => Promise<void>) =>
    (arg?: PowerArg) =>
      guarded(async () => {
        const { id, folderName, mode } = normalize(arg);
        if (!id) return;
        const folder = await pickFolder(deps.store, folderName);
        if (!folder) {
          void vscode.window.showWarningMessage('SDD Studio: abre una carpeta para usar Powers.');
          return;
        }
        await fn(id, folder, mode);
      });

  return vscode.Disposable.from(
    vscode.commands.registerCommand('sddStudio.openPowers', () => deps.gallery.show()),
    vscode.commands.registerCommand('sddStudio.checkPowerUpdates', () => checkUpdates(deps.powers)),
    vscode.commands.registerCommand(
      'sddStudio.activatePower',
      withPower(async (id, folder) => {
        if (!requireTrust()) return;
        const p = await deps.powers.find(id);
        const result = await deps.powers.activate(id, folder, (spec) => confirmMcpActivation(p, spec, deps.powers));
        if (result === 'cancelled') return;
        if (!p.mcp) {
          void vscode.window.showInformationMessage(
            `SDD Studio: "${p.presentation.displayName}" activado en .github/skills/${p.skillName}/. Commitea la carpeta .github para compartirlo con tu equipo.`,
          );
          return;
        }
        const pick = await vscode.window.showInformationMessage(
          `SDD Studio: listo. "${p.presentation.displayName}" añadió ${Object.keys(p.mcp.servers).join(', ')} a .vscode/mcp.json. VS Code te pedirá confiar e iniciar el servidor. Commitea .github y .vscode/mcp.json para compartirlo.`,
          'Ver servidores MCP',
        );
        if (pick) await vscode.commands.executeCommand(MCP_LIST_SERVERS_COMMAND);
      }),
    ),
    vscode.commands.registerCommand(
      'sddStudio.updatePower',
      withPower(async (id, folder) => {
        if (!requireTrust()) return;
        const p = await deps.powers.find(id);
        const result = await deps.powers.update(id, folder, (reason) =>
          confirmModal(overwriteQuestion(reason, p.presentation.displayName, p.skillName, 'update'), 'Sobrescribir'),
        );
        if (result === 'updated') void vscode.window.showInformationMessage(`SDD Studio: "${p.presentation.displayName}" actualizado a v${p.version}.`);
      }),
    ),
    vscode.commands.registerCommand(
      'sddStudio.setPowerMode',
      withPower(async (id, folder, requested) => {
        if (!requireTrust()) return;
        const p = await deps.powers.find(id);
        if (!p.mcp) return;
        let mode = requested;
        if (!mode) {
          const pick = await vscode.window.showQuickPick(
            MCP_MODES.filter((m) => m === 'readOnly' || p.mcp?.operate).map((m) => ({ label: MODE_LABELS[m], mode: m })),
            { placeHolder: `Modo de "${p.presentation.displayName}"` },
          );
          if (!pick) return;
          mode = pick.mode;
        }
        if (mode === 'operate' && p.mcp.operate && !(await confirmModal(`¿Cambiar "${p.presentation.displayName}" a Operar?`, 'Cambiar a Operar', p.mcp.operate.warning))) {
          return;
        }
        const result = await deps.powers.setMode(id, folder, mode, (reason) =>
          confirmModal(overwriteQuestion(reason, p.presentation.displayName, p.skillName, 'mode'), 'Sobrescribir'),
        );
        if (result === 'changed') {
          void vscode.window.showInformationMessage(
            `SDD Studio: "${p.presentation.displayName}" en modo ${MODE_LABELS[mode]}. Reinicia el servidor desde la lista de servidores MCP si ya estaba en marcha.`,
          );
        }
      }),
    ),
    vscode.commands.registerCommand(
      'sddStudio.deactivatePower',
      withPower(async (id, folder) => {
        let p: CatalogPower | undefined;
        try {
          p = await deps.powers.find(id);
        } catch {
          p = undefined;
        }
        const name = p?.presentation.displayName ?? id;
        const result = await deps.powers.deactivate(id, folder, (reason) =>
          confirmModal(overwriteQuestion(reason, name, p?.skillName ?? id, 'deactivate'), 'Borrar y desactivar'),
        );
        if (result === 'deactivated') void vscode.window.showInformationMessage(`SDD Studio: Power "${name}" desactivado.`);
      }),
    ),
  );
}
```

`package.json`: en `contributes.commands`, antes de `sddStudio.deactivatePower`, añade:

```json
      {
        "command": "sddStudio.setPowerMode",
        "title": "Cambiar modo de Power (MCP)",
        "category": "SDD Studio",
        "enablement": "isWorkspaceTrusted"
      },
```

y al final de `contributes.menus.commandPalette`:

```json
        {
          "command": "sddStudio.setPowerMode",
          "when": "false"
        }
```

(Se oculta de la paleta como los demás comandos de Powers: se usa desde la galería y desde el botón "Reparar" del diagnóstico).

- [ ] **Step 4: Ejecutar los tests**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run test:integration`
Expected: todo PASS (incluidos `powers.ui.test.ts`: los Powers sin MCP siguen mostrando el mismo mensaje al activarse).

- [ ] **Step 5: Commit**

```bash
git add src/powers/mcp/messages.ts src/powers/powersService.ts src/powers/commands.ts package.json test/unit/powers/mcpMessages.test.ts test/integration/powers.mcp.service.test.ts
git commit -m "feat(powers): modal de activación MCP, comando sddStudio.setPowerMode y errores MCP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Galería, póster y páginas `/powers/` con MCP

**Files:**
- Modify: `src/powers/render/card.ts` (completo), `src/powers/render/gallery.ts` (completo), `src/powers/render/webview.ts` (completo), `src/powers/render/styles.ts`, `src/powers/galleryPanel.ts`, `scripts/build-site.ts`
- Test: `test/unit/powers/render.test.ts`, `test/unit/scripts/buildSite.test.ts`, `test/integration/powers.mcp.service.test.ts`

**Interfaces:**
- Consumes: de la Tarea 1, `McpMode`, `MODE_LABELS`, `PREREQUISITES`, `serverKind`, `serverCommandLine`; de la Tarea 7, `PowerView.mode`, `PowersService.policy()`, comando `sddStudio.setPowerMode`.
- Produces:
  - `card.ts`: `RenderOptions` gana `mode?: McpMode` y `blocked?: string`; `renderMcpStrip(p: CatalogPower): string`; `renderActions(p, status, mcp?: { mode?: McpMode; blocked?: string })`; la tarjeta lleva `data-mcp="1|0"` y el distintivo `🔌 MCP`.
  - `gallery.ts`: chip `data-filter="mcp"` ("🔌 Con MCP"); `renderGrid` acepta `modes` y `blocked`.
  - `webview.ts`: `GalleryDocInput.views[].mode?`, `GalleryDocInput.mcpBlocked?: string`; el script envía `{ type, id, mode }`.
  - `galleryPanel.ts`: mensajes `setMode` (→ `sddStudio.setPowerMode`) y `doctor` (→ `sddStudio.doctor`).
  - `build-site.ts`: `mcpHowTo(p: CatalogPower): string` (sección "Cómo usarlo").

- [ ] **Step 1: Escribir los tests, que deben fallar**

En `test/unit/powers/render.test.ts`, cambia las importaciones de `card`, `gallery` y fixtures por:

```ts
import { renderActions, renderCard, renderMcpStrip, renderPoster } from '../../../src/powers/render/card';
import { FILTER_SCRIPT, renderFilters, renderGrid, renderTeaserChips } from '../../../src/powers/render/gallery';
import { mcpPower, mcpSpec, power, presentation } from '../../support/powerFixtures';
```

y añade al final del archivo:

```ts
describe('Powers con MCP', () => {
  const cloudy = mcpPower('cloudy');
  const remote = mcpPower(
    'docsy',
    mcpSpec({ prerequisites: [], inputs: [], servers: { 'sdd-docs': { type: 'http', url: 'https://docs.example.com/mcp' } }, approxTools: { 'sdd-docs': 2 }, beta: true, credentials: 'Ninguna', operate: undefined }),
  );

  it('distintivo 🔌 MCP y data-mcp en la tarjeta; nada en un Power sin MCP', () => {
    const html = renderCard(cloudy, { actions: false });
    expect(html).toContain('🔌 MCP');
    expect(html).toContain('data-mcp="1"');
    expect(html).toContain('sdd-x');
    const plain = renderCard(power('alpha'), { actions: false });
    expect(plain).not.toContain('🔌 MCP');
    expect(plain).toContain('data-mcp="0"');
  });

  it('chip de filtro "Con MCP" solo si hay Powers con MCP, y el script lo entiende', () => {
    expect(renderFilters([power('alpha'), cloudy])).toContain('data-filter="mcp"');
    expect(renderFilters([power('alpha')])).not.toContain('data-filter="mcp"');
    expect(FILTER_SCRIPT).toContain("state.cat === 'mcp'");
  });

  it('las categorías nuevas aparecen en orden: Dev core, Documentación, Cloud', () => {
    const cat = (id: string, category: 'devcore' | 'docs' | 'cloud') => ({ ...power(id), presentation: presentation({ category }) });
    const html = renderFilters([cat('c', 'cloud'), cat('a', 'devcore'), cat('b', 'docs')]);
    expect(html.indexOf('Dev core')).toBeLessThan(html.indexOf('Documentación'));
    expect(html.indexOf('Documentación')).toBeLessThan(html.indexOf('>Cloud<'));
  });

  it('franja MCP: local con su comando, prerrequisitos, credenciales y modo Operar', () => {
    const html = renderPoster(cloudy, { actions: false });
    expect(html).toContain('SERVIDORES MCP');
    expect(html).toContain('<code>sdd-x</code> <span class="pw-kind pw-local">local</span> ejecuta código en tu máquina: <code>uvx x-mcp-server@1.0.0</code>');
    expect(html).toContain('Prerrequisitos: uv');
    expect(html).toContain('Credenciales: Perfil local');
    expect(html).toContain('modo Operar opcional');
    expect(html).not.toContain('pw-beta');
  });

  it('franja MCP: remoto con su host y beta', () => {
    const html = renderMcpStrip(remote);
    expect(html).toContain('<span class="pw-kind">remoto</span> docs.example.com');
    expect(html).toContain('Prerrequisitos: ninguno');
    expect(html).toContain('<span class="pw-beta">beta</span>');
    expect(renderMcpStrip(power('alpha'))).toBe('');
  });

  it('escapa los textos de mcp', () => {
    const evil = mcpPower('evil', mcpSpec({ credentials: '<img src=x onerror=alert(1)>' }));
    const html = renderPoster(evil, { actions: false });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('selector de modo en un Power activo con operate; Operar resaltado en tono warn', () => {
    const ro = renderActions(cloudy, 'active', { mode: 'readOnly' });
    expect(ro).toContain('data-action="setMode" data-id="cloudy" data-mode="operate"');
    expect(ro).toMatch(/class="pw-seg pw-on" data-action="setMode" data-id="cloudy" data-mode="readOnly" aria-pressed="true">Solo lectura/);
    const op = renderActions(cloudy, 'active', { mode: 'operate' });
    expect(op).toMatch(/class="pw-seg pw-on pw-warn" data-action="setMode" data-id="cloudy" data-mode="operate" aria-pressed="true">Operar/);
    expect(renderActions(remote, 'active', { mode: 'readOnly' })).not.toContain('setMode');
    expect(renderActions(cloudy, 'available', { mode: 'readOnly' })).not.toContain('setMode');
  });

  it('política bloqueada: botón 🔒 deshabilitado con la razón y enlace al diagnóstico', () => {
    const html = renderActions(cloudy, 'available', { blocked: 'chat.mcp.access = none' });
    expect(html).toContain('🔒 Bloqueado por tu organización');
    expect(html).toContain('disabled');
    expect(html).toContain('chat.mcp.access = none');
    expect(html).toContain('data-action="doctor"');
    expect(html).not.toContain('data-action="activate"');
    expect(renderActions(power('alpha'), 'available', { blocked: 'x' })).toContain('data-action="activate"');
    expect(renderActions(cloudy, 'active', { blocked: 'x' })).toContain('data-action="deactivate"');
  });

  it('el webview pasa modo y bloqueo a tarjetas y pósters, y envía data-mode', () => {
    const html = renderGalleryDocument({
      views: [
        { power: cloudy, status: 'active', mode: 'operate' },
        { power: remote, status: 'available' },
      ],
      strict: false,
      hasFolder: true,
      mcpBlocked: 'chat.mcp.access = none',
      nonce: 'N',
      cspSource: 'vscode-resource:',
    });
    expect(count(html, 'pw-on pw-warn')).toBe(2);
    expect(count(html, '🔒 Bloqueado por tu organización')).toBe(2);
    expect(html).toContain("mode: t.getAttribute('data-mode')");
  });
});
```

En `test/unit/scripts/buildSite.test.ts`, añade dentro del `describe`, al final:

```ts
  it('la página de un Power con MCP muestra distintivo, franja y "Cómo usarlo"; la de uno sin MCP no', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'site-'));
    const outDir = join(tmp, '_site');
    buildSite({ siteDir: join(tmp, 'no-site'), outDir, catalog: catalog([power('alpha'), mcpPower('cloudy')]) });
    const detail = readFileSync(join(outDir, 'powers', 'cloudy.html'), 'utf8');
    expect(detail).toContain('🔌 MCP');
    expect(detail).toContain('SERVIDORES MCP');
    expect(detail).toContain('Cómo usarlo');
    expect(detail).toContain('Lista mis recursos');
    expect(detail).toContain('<a href="https://docs.astral.sh/uv/getting-started/installation/">uv</a>');
    expect(detail).toContain('cambia el modo a <b>Operar</b>');
    expect(detail).toContain('&quot;sdd-x&quot;');
    expect(detail).not.toContain('data-action="setMode"');
    expect(readFileSync(join(outDir, 'powers', 'alpha.html'), 'utf8')).not.toContain('Cómo usarlo');
    expect(readFileSync(join(outDir, 'powers', 'index.html'), 'utf8')).toContain('data-filter="mcp"');
  });
```

En `test/integration/powers.mcp.service.test.ts`, añade dentro del `describe`, al final:

```ts
  it('la galería muestra el selector de modo y su mensaje setMode cambia el modo', async () => {
    const { powers, gallery } = await getApi();
    await powers.activate('cloudy', ws(), async () => true);
    await vscode.commands.executeCommand('sddStudio.openPowers');
    await gallery.render();
    assert.match(gallery.html!, /data-action="setMode" data-id="cloudy" data-mode="operate"/);
    assert.match(gallery.html!, /🔌 MCP/);
    await gallery.handleMessage({ type: 'setMode', id: 'cloudy', mode: 'readOnly' });
    assert.strictEqual((await powers.views(ws())).find((v) => v.power.id === 'cloudy')!.mode, 'readOnly');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
```

- [ ] **Step 2: Ejecutarlos y ver que fallan**

Run: `npx vitest run test/unit/powers/render.test.ts test/unit/scripts/buildSite.test.ts`
Expected: FAIL, `renderMcpStrip` no existe y no hay distintivo, franja, selector ni "Cómo usarlo".

- [ ] **Step 3: Implementar el renderer**

`src/powers/render/card.ts` completo:

```ts
import type { PowerStatus } from '../lock';
import { McpMode, MODE_LABELS, PREREQUISITES, serverCommandLine, serverKind } from '../mcp/spec';
import { CATEGORY_LABELS, CatalogPower, sourceUrl } from '../types';
import { renderDiagram } from './diagram';
import { escapeHtml as e } from './escape';

export interface RenderOptions {
  status?: PowerStatus;
  actions: boolean;
  detailHref?: string;
  /** Modo MCP actual (solo Powers con MCP activos). */
  mode?: McpMode;
  /** Razón por la que la organización bloquea MCP; si está, los Powers con MCP no se pueden activar. */
  blocked?: string;
}

function whatItDoes(p: CatalogPower): string {
  const d = p.presentation.diagram;
  return d.kind === 'split' ? d.columns.map((c) => c.label).join(' + ') : d.nodes.map((n) => n.label).join(' → ');
}

function head(p: CatalogPower): string {
  const pr = p.presentation;
  const badge = p.mcp ? ' · <span class="pw-mcp">🔌 MCP</span>' : '';
  return (
    `<div class="pw-head"><div class="pw-ico">${e(pr.icon)}</div><div>` +
    `<div class="pw-name">${e(pr.displayName)}</div>` +
    `<div class="pw-by">${e(pr.source.repo)} · <span class="pw-pill">${e(pr.source.license)}</span> · ${e(CATEGORY_LABELS[pr.category])}${badge}</div>` +
    `</div></div>`
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Franja MCP del póster: servidores (local o remoto), prerrequisitos, credenciales, modo Operar y beta. */
export function renderMcpStrip(p: CatalogPower): string {
  const mcp = p.mcp;
  if (!mcp) return '';
  const servers = Object.entries(mcp.servers)
    .map(([name, s]) =>
      serverKind(s) === 'local'
        ? `<li><code>${e(name)}</code> <span class="pw-kind pw-local">local</span> ejecuta código en tu máquina: <code>${e(serverCommandLine(s))}</code></li>`
        : `<li><code>${e(name)}</code> <span class="pw-kind">remoto</span> ${e(hostOf(serverCommandLine(s)))}</li>`,
    )
    .join('');
  const prereqs = mcp.prerequisites.length > 0 ? mcp.prerequisites.map((r) => PREREQUISITES[r].label).join(', ') : 'ninguno';
  const meta = [
    `Prerrequisitos: ${e(prereqs)}`,
    `Credenciales: ${e(mcp.credentials)}`,
    mcp.operate ? 'Solo lectura por defecto · modo Operar opcional' : 'Solo lectura',
    ...(mcp.beta ? ['<span class="pw-beta">beta</span>'] : []),
  ].join(' · ');
  return `<div class="pw-lbl">SERVIDORES MCP</div><ul class="pw-mcpstrip">${servers}</ul><p class="pw-mcpmeta">${meta}</p>`;
}

function renderModeSelector(p: CatalogPower, mode: McpMode | undefined): string {
  if (!p.mcp?.operate || !mode) return '';
  const id = e(p.id);
  const opt = (m: McpMode) =>
    `<button class="pw-seg${m === mode ? ' pw-on' : ''}${m === mode && m === 'operate' ? ' pw-warn' : ''}" data-action="setMode" data-id="${id}" data-mode="${m}" aria-pressed="${m === mode}">${MODE_LABELS[m]}</button>`;
  return `<span class="pw-mode" role="group" aria-label="Modo MCP">${opt('readOnly')}${opt('operate')}</span>`;
}

export function renderActions(p: CatalogPower, status: PowerStatus | undefined, mcp: { mode?: McpMode; blocked?: string } = {}): string {
  const id = e(p.id);
  const off = `<button class="pw-btn pw-ghost" data-action="deactivate" data-id="${id}">Desactivar</button>`;
  const mode = renderModeSelector(p, mcp.mode);
  if (status === 'active') return `<span class="pw-state">✓ Activo · v${e(p.version)}</span>${mode}${off}`;
  if (status === 'update') return `<button class="pw-btn" data-action="update" data-id="${id}">Actualizar a v${e(p.version)}</button>${mode}${off}`;
  if (p.mcp && mcp.blocked) {
    return (
      `<button class="pw-btn pw-blocked" disabled title="${e(`Tu organización bloquea los servidores MCP (${mcp.blocked}). Ejecuta "SDD Studio: Diagnóstico".`)}">🔒 Bloqueado por tu organización</button>` +
      `<button class="pw-link" data-action="doctor" data-id="${id}">Ver diagnóstico</button>`
    );
  }
  return `<button class="pw-btn" data-action="activate" data-id="${id}">+ Activar en este repo</button>`;
}

export function renderCard(p: CatalogPower, opts: RenderOptions): string {
  const pr = p.presentation;
  const servers = p.mcp ? ` ${Object.keys(p.mcp.servers).join(' ')} mcp` : '';
  const search = `${pr.displayName} ${pr.summary} ${pr.source.author}${servers}`.toLowerCase();
  const detail = opts.detailHref
    ? `<a class="pw-link" href="${e(opts.detailHref)}">Ver detalle →</a>`
    : `<button class="pw-link" data-action="detail" data-id="${e(p.id)}">Ver detalle →</button>`;
  return (
    `<article class="pw-card" data-id="${e(p.id)}" data-category="${e(pr.category)}" data-mcp="${p.mcp ? '1' : '0'}" data-search="${e(search)}">` +
    head(p) +
    `<p class="pw-summary">${e(pr.summary)}</p>` +
    `<div class="pw-strip"><div><b>CUÁNDO</b>${e(pr.triggers[0])}</div><span>→</span>` +
    `<div><b>QUÉ HACE</b>${e(whatItDoes(p))}</div><span>→</span>` +
    `<div><b>OBTIENES</b>${e(pr.gets[0])}</div></div>` +
    `<div class="pw-foot">${opts.actions ? renderActions(p, opts.status, opts) : ''}${detail}</div>` +
    `</article>`
  );
}

export function renderPoster(p: CatalogPower, opts: RenderOptions & { uid?: string }): string {
  const pr = p.presentation;
  return (
    `<section class="pw-poster" data-id="${e(p.id)}">` +
    head(p) +
    `<p class="pw-summary">${e(pr.summary)}</p>` +
    renderMcpStrip(p) +
    `<div class="pw-lbl">SE ACTIVA CUANDO DICES</div>` +
    `<div class="pw-chips">${pr.triggers.map((t) => `<span class="pw-chip">${e(t)}</span>`).join('')}</div>` +
    `<div class="pw-lbl">EL MÉTODO</div>${renderDiagram(pr.diagram, opts.uid ?? p.id)}` +
    `<div class="pw-lbl">OBTIENES</div><ul class="pw-gets">${pr.gets.map((g) => `<li>${e(g)}</li>`).join('')}</ul>` +
    `<div class="pw-lbl">ORIGEN</div><p class="pw-source">` +
    `<a href="${e(sourceUrl(pr.source))}" data-action="openSource" data-id="${e(p.id)}">${e(pr.source.repo)}</a>` +
    ` · ${e(pr.source.author)} · ${e(pr.source.license)} · adaptado para GitHub Copilot</p>` +
    (opts.actions ? `<div class="pw-foot">${renderActions(p, opts.status, opts)}</div>` : '') +
    `</section>`
  );
}
```

`src/powers/render/gallery.ts` completo:

```ts
import type { PowerStatus } from '../lock';
import type { McpMode } from '../mcp/spec';
import { CATEGORIES, CATEGORY_LABELS, CatalogPower } from '../types';
import { renderCard } from './card';
import { escapeHtml as e } from './escape';

export function renderFilters(powers: CatalogPower[]): string {
  const cats = CATEGORIES.filter((c) => powers.some((p) => p.presentation.category === c));
  return (
    `<div class="pw-filters"><button class="pw-chip pw-on" data-filter="all">Todos (${powers.length})</button>` +
    cats.map((c) => `<button class="pw-chip" data-filter="${c}">${e(CATEGORY_LABELS[c])}</button>`).join('') +
    (powers.some((p) => p.mcp) ? '<button class="pw-chip" data-filter="mcp">🔌 Con MCP</button>' : '') +
    `<input class="pw-search" type="search" placeholder="Buscar…" aria-label="Buscar Powers"></div>`
  );
}

export function renderGrid(
  powers: CatalogPower[],
  opts: {
    statuses?: Record<string, PowerStatus>;
    modes?: Record<string, McpMode>;
    blocked?: string;
    actions: boolean;
    hrefFor?: (id: string) => string;
  },
): string {
  if (powers.length === 0) return '<p class="pw-empty">No hay Powers en el catálogo.</p>';
  const card = (p: CatalogPower) =>
    renderCard(p, {
      status: opts.statuses?.[p.id],
      mode: opts.modes?.[p.id],
      blocked: opts.blocked,
      actions: opts.actions,
      detailHref: opts.hrefFor?.(p.id),
    });
  const statuses = opts.statuses;
  if (!statuses) return `<div class="pw-grid">${powers.map(card).join('')}</div>`;
  const active = powers.filter((p) => statuses[p.id] === 'active' || statuses[p.id] === 'update');
  const rest = powers.filter((p) => !active.includes(p));
  const section = (title: string, list: CatalogPower[]) =>
    list.length > 0 ? `<h3 class="pw-section">${title}</h3><div class="pw-grid">${list.map(card).join('')}</div>` : '';
  return section('ACTIVOS EN ESTE REPO', active) + section('RECOMENDADOS', rest);
}

export function renderTeaserChips(powers: CatalogPower[]): string {
  return powers
    .map(
      (p) =>
        `<a class="chip" href="powers/${e(p.id)}.html">${e(p.presentation.icon)} ${e(p.presentation.displayName)} <small>· ${e(p.presentation.source.repo.split('/')[0])}</small></a>`,
    )
    .join('');
}

/** Filtro por categoría, "Con MCP" y búsqueda; funciona igual en la web y en el webview. */
export const FILTER_SCRIPT = `(function(){
  var state = { cat: 'all', q: '' };
  function apply(){
    document.querySelectorAll('.pw-card').forEach(function(c){
      var okCat = state.cat === 'all' || (state.cat === 'mcp' ? c.getAttribute('data-mcp') === '1' : c.getAttribute('data-category') === state.cat);
      var okQ = !state.q || (c.getAttribute('data-search') || '').indexOf(state.q) >= 0;
      c.style.display = okCat && okQ ? '' : 'none';
    });
  }
  document.addEventListener('click', function(ev){
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-filter]') : null;
    if (!b) return;
    state.cat = b.getAttribute('data-filter');
    document.querySelectorAll('[data-filter]').forEach(function(x){ x.classList.toggle('pw-on', x === b); });
    apply();
  });
  document.addEventListener('input', function(ev){
    if (ev.target && ev.target.classList && ev.target.classList.contains('pw-search')) { state.q = ev.target.value.toLowerCase().trim(); apply(); }
  });
})();`;
```

`src/powers/render/webview.ts` completo:

```ts
import type { PowerStatus } from '../lock';
import type { McpMode } from '../mcp/spec';
import { CatalogPower } from '../types';
import { renderPoster } from './card';
import { escapeHtml as e } from './escape';
import { FILTER_SCRIPT, renderFilters, renderGrid } from './gallery';
import { speccySvg } from './speccy';
import { POWERS_CSS } from './styles';

export interface GalleryDocInput {
  views: { power: CatalogPower; status: PowerStatus; mode?: McpMode }[];
  /** Razón del bloqueo de MCP por política (undefined si se permite). */
  mcpBlocked?: string;
  strict: boolean;
  hasFolder: boolean;
  error?: string;
  nonce: string;
  cspSource: string;
}

const GALLERY_SCRIPT = `(function(){
  var vscode = acquireVsCodeApi();
  var grid = document.getElementById('pw-grid-view');
  function show(id){
    grid.hidden = !!id;
    document.querySelectorAll('.pw-detail').forEach(function(d){ d.hidden = d.getAttribute('data-detail') !== id; });
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!t) return;
    ev.preventDefault();
    var action = t.getAttribute('data-action');
    var id = t.getAttribute('data-id');
    if (action === 'detail') { show(id); return; }
    if (action === 'back') { show(null); return; }
    vscode.postMessage({ type: action, id: id, mode: t.getAttribute('data-mode') });
  });
})();`;

export function renderGalleryDocument(input: GalleryDocInput): string {
  const { views, strict, hasFolder, error, nonce, cspSource, mcpBlocked } = input;
  const powers = views.map((v) => v.power);
  const statuses = Object.fromEntries(views.map((v) => [v.power.id, v.status]));
  const modes = Object.fromEntries(views.flatMap((v) => (v.mode ? [[v.power.id, v.mode]] : [])));
  const csp = `default-src 'none'; img-src ${cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
  const banners =
    (strict
      ? '<div class="pw-banner">⚠️ Tu organización puede impedir que Copilot cargue skills del repo (política ChatStrictPluginOnlyCustomization). Ejecuta "SDD Studio: Diagnóstico" para más detalles.</div>'
      : '') +
    (error ? `<div class="pw-banner">⚠️ ${e(error)}</div>` : '') +
    (!hasFolder && !error ? '<div class="pw-banner">Abre una carpeta para activar Powers en un repo.</div>' : '');
  const details = powers
    .map(
      (p) =>
        `<div class="pw-detail" data-detail="${e(p.id)}" hidden><button class="pw-link" data-action="back">← Volver</button>` +
        `${renderPoster(p, { status: statuses[p.id], mode: modes[p.id], blocked: mcpBlocked, actions: hasFolder })}</div>`,
    )
    .join('');
  return (
    `<!doctype html><html lang="es"><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style nonce="${nonce}">${POWERS_CSS}</style></head>` +
    `<body class="pw-root"><main class="pw-wrap">${banners}` +
    `<div id="pw-grid-view"><header class="pw-hero">${speccySvg('gallery', 84)}<h1>⚡ Powers</h1>` +
    `<p>Skills de la comunidad, adaptados para GitHub Copilot. Se cargan solos cuando tu pedido coincide con su descripción.</p>` +
    `${renderFilters(powers)}</header>${renderGrid(powers, { statuses, modes, blocked: mcpBlocked, actions: hasFolder })}</div>` +
    `${details}</main><script nonce="${nonce}">${FILTER_SCRIPT}${GALLERY_SCRIPT}</script></body></html>`
  );
}
```

`src/powers/render/styles.ts`: añade estas líneas justo antes de la línea `@media (max-width:560px)…`:

```css
.pw-mcp{color:var(--pw-ac);font-weight:600}
.pw-mcpstrip{list-style:none;margin:0;padding:8px 10px;background:var(--pw-bg);border-radius:8px;font-size:13px;display:flex;flex-direction:column;gap:4px}
.pw-mcpstrip code{background:var(--pw-bg3);padding:1px 6px;border-radius:5px;font-size:12px}
.pw-kind{font-size:10px;padding:1px 7px;border-radius:9px;background:var(--pw-bd);color:var(--pw-tx)}
.pw-kind.pw-local{background:rgba(255,210,122,.18);color:#ffd27a}
.pw-mcpmeta{margin:0;font-size:12px;color:var(--pw-mu)}
.pw-beta{color:#ffd27a;font-weight:700}
.pw-mode{display:inline-flex;border:1px solid var(--pw-bd);border-radius:7px;overflow:hidden}
.pw-seg{font:inherit;font-size:12px;background:transparent;color:var(--pw-mu);border:0;padding:5px 10px;cursor:pointer}
.pw-seg.pw-on{background:var(--pw-bg3);color:var(--pw-tx)}
.pw-seg.pw-on.pw-warn{background:rgba(255,210,122,.2);color:#ffd27a}
.pw-btn.pw-blocked{background:var(--pw-bg3);color:var(--pw-mu);cursor:not-allowed}
```

`src/powers/galleryPanel.ts`:
- En `render()`, antes de `this.lastHtml = renderGalleryDocument({`, añade `const policy = this.powers.policy();` y, dentro del objeto, después de `views,`, añade `mcpBlocked: policy.state === 'blocked' ? policy.reason : undefined,`.
- En `handleMessage`, sustituye las dos primeras líneas tras la comprobación de `message` por:

```ts
    const { type, id, mode } = message as { type?: unknown; id?: unknown; mode?: unknown };
    if (typeof id !== 'string') return;
    if (type === 'doctor') {
      await vscode.commands.executeCommand('sddStudio.doctor');
      return;
    }
    if (type === 'setMode') {
      if (mode === 'readOnly' || mode === 'operate') await vscode.commands.executeCommand('sddStudio.setPowerMode', { id, mode });
      return;
    }
```

- [ ] **Step 4: Implementar "Cómo usarlo" en la web**

En `scripts/build-site.ts`:
- Añade la importación `import { PREREQUISITES, serverKind } from '../src/powers/mcp/spec';` (antes de la de `escape`).
- Añade al final de `PAGE_CSS` (antes del acento grave de cierre):
  ```css
  .pw-howto pre{background:#1a171e;border:1px solid #3a3342;border-radius:8px;padding:12px;overflow-x:auto}
  .pw-howto pre code{background:none;padding:0}
  ```
- Añade antes de `export function buildSite(`:

```ts
/** Sección "Cómo usarlo" de un Power con MCP: pasos, ejemplo de prompt y el bloque para copiar a mano en `.vscode/mcp.json`. */
export function mcpHowTo(p: CatalogPower): string {
  const mcp = p.mcp;
  if (!mcp) return '';
  const names = Object.keys(mcp.servers)
    .map((n) => `<code>${e(n)}</code>`)
    .join(', ');
  const local = Object.values(mcp.servers).some((s) => serverKind(s) === 'local');
  const steps = [
    `Actívalo desde la galería de SDD Studio: añade ${names} a <code>.vscode/mcp.json</code> en modo <b>Solo lectura</b> y el skill a <code>.github/skills/${e(p.skillName)}/</code>.`,
    ...(mcp.prerequisites.length > 0
      ? [
          `Necesitas en tu PATH: ${mcp.prerequisites.map((r) => `<a href="${e(PREREQUISITES[r].url)}">${e(PREREQUISITES[r].label)}</a>`).join(', ')}.`,
        ]
      : []),
    `VS Code te pedirá confiar en el servidor e iniciarlo${local ? ' (se ejecuta en tu máquina)' : ''}. Credenciales: ${e(mcp.credentials)}.`,
    ...(mcp.operate ? ['Para que Copilot pueda hacer cambios, cambia el modo a <b>Operar</b> en la galería; antes te avisa de lo que implica.'] : []),
    `Pídeselo a Copilot en modo Agent, por ejemplo: <q>${e(mcp.example)}</q>`,
  ];
  const manual = JSON.stringify({ inputs: mcp.inputs, servers: mcp.servers }, null, 2);
  return (
    `<section class="pw-howto"><h2>Cómo usarlo</h2><ol>${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` +
    `<h3>Servidores a mano</h3><p>Sin SDD Studio, copia esto en <code>.vscode/mcp.json</code> (modo Solo lectura):</p>` +
    `<pre><code>${e(manual)}</code></pre></section>`
  );
}
```

- En el bucle de páginas de detalle, cambia `renderPoster(p, { actions: false }) + howTo(p)` por `renderPoster(p, { actions: false }) + mcpHowTo(p) + howTo(p)`.

- [ ] **Step 5: Ejecutar los tests**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build:site && npm run test:integration`
Expected: todo PASS.

- [ ] **Step 6: Commit**

```bash
git add src/powers/render/card.ts src/powers/render/gallery.ts src/powers/render/webview.ts src/powers/render/styles.ts src/powers/galleryPanel.ts scripts/build-site.ts test/unit/powers/render.test.ts test/unit/scripts/buildSite.test.ts test/integration/powers.mcp.service.test.ts
git commit -m "feat(gallery): distintivo 🔌 MCP, filtro, franja MCP, selector de modo, estado bloqueado y 'Cómo usarlo' en la web

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Powers de documentación (`context7`, `microsoft-learn`, `aws-docs`)

**Files:**
- Create: `powers/context7/`, `powers/microsoft-learn/`, `powers/aws-docs/` (cada uno con `plugin.json`, `presentation.json`, `mcp.vscode.json`, `skills/<id>/SKILL.md`, `LICENSE`, `UPSTREAM.md`)
- Test: `test/unit/powers/realCatalog.test.ts`

**Interfaces:**
- Consumes: el formato de `mcp.vscode.json` (Tarea 1, con `credentials` y `example`), el guardián (Tarea 3: el `SKILL.md` debe nombrar cada servidor y no contener `FORBIDDEN_TERMS`) y la categoría `docs`.
- Produces: tres Powers MCP en el catálogo real: `sdd-context7` (remoto), `sdd-mslearn` (remoto) y `sdd-awsdocs` (local, `uvx`).
- Nota: `approxTools` son estimaciones conservadoras (2, 3 y 5); si la comprobación 4 del spike mide más, se usa el valor medido redondeado hacia arriba.

- [ ] **Step 1: Escribir el test, que debe fallar**

En `test/unit/powers/realCatalog.test.ts`, después de la constante `EXPECTED`, añade:

```ts
const EXPECTED_MCP: Record<string, string[]> = {
  context7: ['sdd-context7'],
  'microsoft-learn': ['sdd-mslearn'],
  'aws-docs': ['sdd-awsdocs'],
};
```

cambia la última expectativa del `it` existente a:

```ts
    expect(catalog.powers.map((p) => p.id).sort()).toEqual([...EXPECTED, ...Object.keys(EXPECTED_MCP)].sort());
```

y añade este `it` dentro del `describe`:

```ts
  it('los Powers con MCP traen sus servidores y versiones fijadas, sin @latest', () => {
    const { catalog } = buildCatalog(join(__dirname, '../../../powers'));
    const withMcp = catalog.powers.filter((p) => p.mcp);
    expect(Object.fromEntries(withMcp.map((p) => [p.id, Object.keys(p.mcp!.servers)]))).toEqual(EXPECTED_MCP);
    const text = JSON.stringify(withMcp.map((p) => p.mcp));
    expect(text).toContain('awslabs.aws-documentation-mcp-server@1.2.2');
    expect(text).not.toContain('@latest');
  });
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run test/unit/powers/realCatalog.test.ts`
Expected: FAIL, faltan `context7`, `microsoft-learn` y `aws-docs`.

- [ ] **Step 3: Crear los archivos**

#### Power `context7`

`powers/context7/plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "context7",
  "version": "1.0.0",
  "description": "Documentación vigente y por versión de librerías y frameworks (Context7), antes de escribir código.",
  "author": {
    "name": "SDD Studio",
    "url": "https://github.com/enriquecordero/sdd-studio"
  },
  "license": "MIT",
  "keywords": [
    "mcp",
    "docs",
    "context7",
    "libraries"
  ],
  "repository": "https://github.com/enriquecordero/sdd-studio",
  "homepage": "https://enriquecordero.github.io/sdd-studio/powers/context7.html"
}
```

`powers/context7/presentation.json`:

```json
{
  "displayName": "Context7",
  "icon": "📖",
  "category": "docs",
  "summary": "Doc vigente de librerías y frameworks, por versión, antes de escribir código.",
  "triggers": [
    "\"¿cómo se usa…?\"",
    "\"según la doc de…\"",
    "\"usa context7\""
  ],
  "diagram": {
    "kind": "steps",
    "nodes": [
      {
        "label": "PREGUNTA",
        "tone": "accent",
        "edge": "busca la doc vigente"
      },
      {
        "label": "BUSCA DOC",
        "tone": "blue",
        "edge": "cita la fuente"
      },
      {
        "label": "CITA",
        "tone": "warn",
        "edge": "escribe"
      },
      {
        "label": "CÓDIGO",
        "tone": "green"
      }
    ]
  },
  "gets": [
    "Código contra la API actual",
    "La fuente citada",
    "Menos APIs inventadas"
  ],
  "source": {
    "repo": "enriquecordero/sdd-studio",
    "path": "powers/context7",
    "commit": "main",
    "author": "SDD Studio",
    "license": "MIT"
  }
}
```

`powers/context7/mcp.vscode.json`:

```json
{
  "prerequisites": [],
  "inputs": [],
  "servers": {
    "sdd-context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  },
  "approxTools": {
    "sdd-context7": 2
  },
  "beta": false,
  "credentials": "Ninguna (uso anónimo, con límite de peticiones)",
  "example": "Usa Context7 para ver cómo se define un middleware en Next.js 15 y escribe el de autenticación, citando la doc."
}
```

`powers/context7/skills/context7/SKILL.md`:

````markdown
---
name: context7
description: Look up current, version-specific documentation for libraries, frameworks and SDKs through the sdd-context7 MCP server before writing code against them, and cite the source. Use when code depends on a third-party library, the user names a version, or you are unsure an API still exists. En español: "¿cómo se usa la librería…?", "según la documentación de…", "usa context7", "doc actualizada", "consulta la doc antes de programar".
---

# Context7: live library docs

This Power adds the `sdd-context7` MCP server (Context7, by Upstash). It returns up-to-date, version-specific documentation and code examples for public libraries and frameworks.

## When to use
- Before writing or changing code that calls a third-party library, framework or SDK.
- When the user names a version ("Next.js 15", "pydantic v2") or the project pins one.
- When you are not sure an API, option or import path still exists.

## How
1. Find the library: call the `resolve-library-id` tool of `sdd-context7` with the library name. Pick the match whose name and description fit; prefer the project's pinned version when one is offered.
2. Read the docs: call `query-docs` with that id and a focused question (the exact API, option or task).
3. Write the code from what the docs say, not from memory. If the docs and your memory disagree, the docs win; say so.
4. Cite: end your answer with a short "Sources" line naming the library id (and version) you used.

## Rules
- Docs first, code second. One focused lookup beats several vague ones.
- Quote only the lines you need; do not paste whole pages.
- If Context7 has no entry for the library, say so and fall back to the project's own code or the official site, marked as unverified.
## If the tools are not available

If no `sdd-context7` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-context7`, or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
````

`powers/context7/UPSTREAM.md`:

````markdown
# Origen

- Skill: escrito por SDD Studio para este Power (MIT, ver LICENSE).
- Servidor MCP: Context7, de Upstash — https://github.com/upstash/context7
- Licencia del servidor: MIT
- Conexión: servicio remoto `https://mcp.context7.com/mcp` (sin versión que fijar; lo opera Upstash). Sin clave de API: uso anónimo con límite de peticiones
- Configuración verificada el 2026-10-01

## Qué se redistribuye
Nada del servidor: solo su configuración en `mcp.vscode.json` (servidor `sdd-context7`). El servidor lo sirve o lo publica su autor.
````

#### Power `microsoft-learn`

`powers/microsoft-learn/plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "microsoft-learn",
  "version": "1.0.0",
  "description": "Documentación oficial de Microsoft (Azure, .NET, Microsoft 365…) desde Microsoft Learn, con citas.",
  "author": {
    "name": "SDD Studio",
    "url": "https://github.com/enriquecordero/sdd-studio"
  },
  "license": "MIT",
  "keywords": [
    "mcp",
    "docs",
    "microsoft",
    "azure",
    "dotnet"
  ],
  "repository": "https://github.com/enriquecordero/sdd-studio",
  "homepage": "https://enriquecordero.github.io/sdd-studio/powers/microsoft-learn.html"
}
```

`powers/microsoft-learn/presentation.json`:

```json
{
  "displayName": "Microsoft Learn",
  "icon": "🎓",
  "category": "docs",
  "summary": "Doc oficial de Microsoft (Azure, .NET, M365) y ejemplos de código, citados.",
  "triggers": [
    "\"según Microsoft Learn…\"",
    "\"¿cómo se hace en Azure…?\"",
    "\"doc oficial de .NET\""
  ],
  "diagram": {
    "kind": "steps",
    "nodes": [
      {
        "label": "PREGUNTA",
        "tone": "accent",
        "edge": "busca la doc vigente"
      },
      {
        "label": "BUSCA DOC",
        "tone": "blue",
        "edge": "cita la fuente"
      },
      {
        "label": "CITA",
        "tone": "warn",
        "edge": "escribe"
      },
      {
        "label": "CÓDIGO",
        "tone": "green"
      }
    ]
  },
  "gets": [
    "Respuestas de la doc oficial",
    "Ejemplos de código de Microsoft",
    "El enlace a la fuente"
  ],
  "source": {
    "repo": "enriquecordero/sdd-studio",
    "path": "powers/microsoft-learn",
    "commit": "main",
    "author": "SDD Studio",
    "license": "MIT"
  }
}
```

`powers/microsoft-learn/mcp.vscode.json`:

```json
{
  "prerequisites": [],
  "inputs": [],
  "servers": {
    "sdd-mslearn": {
      "type": "http",
      "url": "https://learn.microsoft.com/api/mcp"
    }
  },
  "approxTools": {
    "sdd-mslearn": 3
  },
  "beta": false,
  "credentials": "Ninguna",
  "example": "Busca en Microsoft Learn cómo dar acceso a Key Vault desde una Function con identidad administrada y escribe el Bicep, citando la doc."
}
```

`powers/microsoft-learn/skills/microsoft-learn/SKILL.md`:

````markdown
---
name: microsoft-learn
description: Search and read official Microsoft documentation (Azure, .NET, Microsoft 365, Windows, Power Platform) and official code samples through the sdd-mslearn MCP server, and cite the pages. Use before writing code or infrastructure against Microsoft APIs, or when the user asks how something works in Azure or .NET. En español: "según Microsoft Learn", "¿cómo se hace en Azure…?", "doc oficial de .NET", "ejemplo oficial de Microsoft", "busca en la documentación de Microsoft".
---

# Microsoft Learn: official Microsoft docs

This Power adds the `sdd-mslearn` MCP server, Microsoft's remote server for Microsoft Learn. It searches and fetches official documentation and code samples.

## When to use
- Before writing code, Bicep, ARM, Terraform or CLI commands against Azure or other Microsoft services.
- When the user asks how a Microsoft product, SDK or service behaves, or which option is recommended.
- When a design decision should rest on official guidance (limits, quotas, security defaults).

## How
1. Search: call `microsoft_docs_search` with a focused query. Read the snippets and pick the most relevant pages.
2. Read in full when the snippet is not enough: call `microsoft_docs_fetch` with the page URL.
3. For code, call `microsoft_code_sample_search` (add the language when you know it) and adapt the official sample instead of inventing one.
4. Cite: end with a "Sources" list of the learn.microsoft.com URLs you used.

## Rules
- Docs first, code second. Prefer the newest page when several versions exist, and say which version you followed.
- Quote only what you need.
- If the docs do not cover the question, say so instead of guessing.
## If the tools are not available

If no `sdd-mslearn` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-mslearn`, or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
````

`powers/microsoft-learn/UPSTREAM.md`:

````markdown
# Origen

- Skill: escrito por SDD Studio para este Power (MIT, ver LICENSE).
- Servidor MCP: Microsoft Learn MCP Server — https://github.com/MicrosoftDocs/mcp
- Licencia del servidor: CC-BY-4.0 (repositorio de documentación del servidor)
- Conexión: servicio remoto `https://learn.microsoft.com/api/mcp` (sin versión que fijar; lo opera Microsoft). Sin credenciales
- Configuración verificada el 2026-10-01

## Qué se redistribuye
Nada del servidor: solo su configuración en `mcp.vscode.json` (servidor `sdd-mslearn`). El servidor lo sirve o lo publica su autor.
````

#### Power `aws-docs`

`powers/aws-docs/plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "aws-docs",
  "version": "1.0.0",
  "description": "Documentación oficial de AWS (búsqueda, lectura y recomendaciones) antes de escribir código o infraestructura.",
  "author": {
    "name": "SDD Studio",
    "url": "https://github.com/enriquecordero/sdd-studio"
  },
  "license": "MIT",
  "keywords": [
    "mcp",
    "docs",
    "aws"
  ],
  "repository": "https://github.com/enriquecordero/sdd-studio",
  "homepage": "https://enriquecordero.github.io/sdd-studio/powers/aws-docs.html"
}
```

`powers/aws-docs/presentation.json`:

```json
{
  "displayName": "AWS Docs",
  "icon": "📙",
  "category": "docs",
  "summary": "Busca y lee la documentación oficial de AWS y cita la página usada.",
  "triggers": [
    "\"según la doc de AWS…\"",
    "\"límites de S3/SQS…\"",
    "\"¿cómo se configura en AWS…?\""
  ],
  "diagram": {
    "kind": "steps",
    "nodes": [
      {
        "label": "PREGUNTA",
        "tone": "accent",
        "edge": "busca la doc vigente"
      },
      {
        "label": "BUSCA DOC",
        "tone": "blue",
        "edge": "cita la fuente"
      },
      {
        "label": "CITA",
        "tone": "warn",
        "edge": "escribe"
      },
      {
        "label": "CÓDIGO",
        "tone": "green"
      }
    ]
  },
  "gets": [
    "Límites y opciones reales",
    "Infraestructura según la doc",
    "El enlace a la fuente"
  ],
  "source": {
    "repo": "enriquecordero/sdd-studio",
    "path": "powers/aws-docs",
    "commit": "main",
    "author": "SDD Studio",
    "license": "MIT"
  }
}
```

`powers/aws-docs/mcp.vscode.json`:

```json
{
  "prerequisites": [
    "uv"
  ],
  "inputs": [],
  "servers": {
    "sdd-awsdocs": {
      "type": "stdio",
      "command": "uvx",
      "args": [
        "awslabs.aws-documentation-mcp-server@1.2.2"
      ],
      "env": {
        "FASTMCP_LOG_LEVEL": "ERROR",
        "AWS_DOCUMENTATION_PARTITION": "aws"
      }
    }
  },
  "approxTools": {
    "sdd-awsdocs": 5
  },
  "beta": false,
  "credentials": "Ninguna (no usa credenciales de AWS)",
  "example": "Consulta la documentación de AWS sobre el tamaño máximo de un mensaje de SQS y ajusta el productor, citando la página."
}
```

`powers/aws-docs/skills/aws-docs/SKILL.md`:

````markdown
---
name: aws-docs
description: Search and read the official AWS documentation through the sdd-awsdocs MCP server before writing code, CLI commands or infrastructure for AWS, and cite the pages. Use when the user asks about AWS service behavior, limits, quotas or configuration, or code depends on an AWS API. En español: "según la documentación de AWS", "límites de S3", "cuotas de Lambda", "¿cómo se configura en AWS…?", "doc oficial de AWS".
---

# AWS Docs: official AWS documentation

This Power adds the `sdd-awsdocs` MCP server (AWS Labs). It runs locally through `uvx` and reads the public AWS documentation; it needs no AWS credentials.

## When to use
- Before writing code, CloudFormation, CDK, Terraform or CLI commands for an AWS service.
- When a decision depends on a limit, quota, default or pricing dimension.
- When the user asks how an AWS service behaves.

## How
1. Search: call `search_documentation` with a focused phrase. Pick the most relevant results.
2. Read: call `read_documentation` with the page URL (or `read_sections` for specific sections of a long page).
3. Optionally call `recommend` on a page you read to find related pages (new features, common next steps).
4. Write the code from what the docs say, and end with a "Sources" list of the docs.aws.amazon.com URLs you used.

## Rules
- Docs first, code second. Limits and defaults change: never state one from memory without checking.
- Quote only what you need.
- This server only reads documentation. It cannot see the user's account; for that, the `aws` Power is needed.
## If the tools are not available

If no `sdd-awsdocs` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-awsdocs` (it needs `uv` installed), or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
````

`powers/aws-docs/UPSTREAM.md`:

````markdown
# Origen

- Skill: escrito por SDD Studio para este Power (MIT, ver LICENSE).
- Servidor MCP: AWS Documentation MCP Server, de AWS Labs — https://github.com/awslabs/mcp/tree/main/src/aws-documentation-mcp-server
- Licencia del servidor: Apache-2.0
- Conexión: proceso local con `uvx awslabs.aws-documentation-mcp-server@1.2.2` (versión fijada)
- Configuración verificada el 2026-10-01

## Qué se redistribuye
Nada del servidor: solo su configuración en `mcp.vscode.json` (servidor `sdd-awsdocs`). El servidor lo sirve o lo publica su autor.
````

- [ ] **Step 4: `LICENSE` de cada Power (MIT, el mismo texto)**

```bash
for id in context7 microsoft-learn aws-docs; do cat > powers/$id/LICENSE <<'LIC'
MIT License

Copyright (c) 2026 Enrique Cordero (SDD Studio)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
LIC
done
```

- [ ] **Step 5: Validar y ejecutar los tests**

Run: `npm run build:catalog -- --check && npx vitest run && npm run build:site`
Expected: `✓ 13 Powers válidos`, tests PASS y `✓ Sitio generado en _site/ (13 Powers)`. Abre `_site/powers/context7.html` y comprueba que muestra la franja MCP y la sección "Cómo usarlo".

- [ ] **Step 6: Commit**

```bash
git add powers/context7 powers/microsoft-learn powers/aws-docs test/unit/powers/realCatalog.test.ts
git commit -m "feat(powers): Powers MCP de documentación — Context7, Microsoft Learn y AWS Docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Powers Dev core y Cloud (`github-mcp`, `playwright-mcp`, `aws`, `azure`)

**Files:**
- Create: `powers/github-mcp/`, `powers/playwright-mcp/`, `powers/aws/`, `powers/azure/` (mismos seis archivos cada uno)
- Test: `test/unit/powers/realCatalog.test.ts`

**Interfaces:**
- Consumes: lo mismo que la Tarea 9, más `operate` (Tarea 1) y las categorías `devcore` y `cloud`.
- Produces: `sdd-github` (remoto, OAuth, modo Operar), `sdd-playwright` (local, `npx`), `sdd-aws` (local, `uvx`, inputs `sdd_aws_profile` y `sdd_aws_region`, modo Operar) y `sdd-azure` (local, `npx`, beta, modo Operar).
- Nota: `approxTools` estimados: GitHub 60 (4 toolsets), Playwright 25, AWS 3, Azure 50; el spike los afina.

- [ ] **Step 1: Escribir el test, que debe fallar**

En `test/unit/powers/realCatalog.test.ts`, amplía `EXPECTED_MCP`:

```ts
const EXPECTED_MCP: Record<string, string[]> = {
  context7: ['sdd-context7'],
  'microsoft-learn': ['sdd-mslearn'],
  'aws-docs': ['sdd-awsdocs'],
  'github-mcp': ['sdd-github'],
  'playwright-mcp': ['sdd-playwright'],
  aws: ['sdd-aws'],
  azure: ['sdd-azure'],
};
```

y sustituye el `it('los Powers con MCP traen…')` por:

```ts
  it('los Powers con MCP traen sus servidores, versiones fijadas y modo Operar solo en GitHub y la nube', () => {
    const { catalog } = buildCatalog(join(__dirname, '../../../powers'));
    const withMcp = catalog.powers.filter((p) => p.mcp);
    expect(Object.fromEntries(withMcp.map((p) => [p.id, Object.keys(p.mcp!.servers)]))).toEqual(EXPECTED_MCP);
    expect(withMcp.filter((p) => p.mcp!.operate).map((p) => p.id).sort()).toEqual(['aws', 'azure', 'github-mcp']);
    expect(withMcp.filter((p) => p.mcp!.beta).map((p) => p.id)).toEqual(['azure']);
    const text = JSON.stringify(withMcp.map((p) => p.mcp));
    for (const pin of ['@playwright/mcp@0.0.83', 'awslabs.aws-documentation-mcp-server@1.2.2', 'awslabs.aws-api-mcp-server@1.5.6', '@azure/mcp@3.0.0-beta.48']) {
      expect(text).toContain(pin);
    }
    expect(text).not.toContain('@latest');
  });
```

- [ ] **Step 2: Ejecutarlo y ver que falla**

Run: `npx vitest run test/unit/powers/realCatalog.test.ts`
Expected: FAIL, faltan los cuatro Powers.

- [ ] **Step 3: Crear los archivos**

#### Power `github-mcp`

`powers/github-mcp/plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "github-mcp",
  "version": "1.0.0",
  "description": "Issues, pull requests, repos y Actions de GitHub como contexto para tus specs (solo lectura por defecto).",
  "author": {
    "name": "SDD Studio",
    "url": "https://github.com/enriquecordero/sdd-studio"
  },
  "license": "MIT",
  "keywords": [
    "mcp",
    "github",
    "issues",
    "pull-requests"
  ],
  "repository": "https://github.com/enriquecordero/sdd-studio",
  "homepage": "https://enriquecordero.github.io/sdd-studio/powers/github-mcp.html"
}
```

`powers/github-mcp/presentation.json`:

```json
{
  "displayName": "GitHub",
  "icon": "🐙",
  "category": "devcore",
  "summary": "Lee issues, PRs, repos y Actions de GitHub para dar contexto a tus specs.",
  "triggers": [
    "\"lee el issue #…\"",
    "\"resume el PR…\"",
    "\"¿por qué falla el workflow?\""
  ],
  "diagram": {
    "kind": "steps",
    "nodes": [
      {
        "label": "ISSUE",
        "tone": "accent",
        "edge": "lee el contexto"
      },
      {
        "label": "CONTEXTO",
        "tone": "blue",
        "edge": "requisitos"
      },
      {
        "label": "SPEC",
        "tone": "warn",
        "edge": "implementa"
      },
      {
        "label": "PR",
        "tone": "green"
      }
    ]
  },
  "gets": [
    "Specs que nacen del issue",
    "Contexto de PRs y CI",
    "Solo lectura salvo que elijas Operar"
  ],
  "source": {
    "repo": "enriquecordero/sdd-studio",
    "path": "powers/github-mcp",
    "commit": "main",
    "author": "SDD Studio",
    "license": "MIT"
  }
}
```

`powers/github-mcp/mcp.vscode.json`:

```json
{
  "prerequisites": [],
  "inputs": [],
  "servers": {
    "sdd-github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/readonly",
      "headers": {
        "X-MCP-Toolsets": "repos,issues,pull_requests,actions"
      }
    }
  },
  "approxTools": {
    "sdd-github": 60
  },
  "beta": false,
  "credentials": "OAuth de VS Code con tu cuenta de GitHub",
  "example": "Lee el issue #42 de este repo con sus comentarios y crea un spec a partir de él con sdd-spec.",
  "operate": {
    "servers": {
      "sdd-github": {
        "type": "http",
        "url": "https://api.githubcopilot.com/mcp/",
        "headers": {
          "X-MCP-Toolsets": "repos,issues,pull_requests,actions"
        }
      }
    },
    "warning": "Copilot podrá crear y comentar issues y pull requests, y lanzar workflows, con tu cuenta de GitHub. Revisa cada llamada antes de aprobarla."
  }
}
```

`powers/github-mcp/skills/github-mcp/SKILL.md`:

````markdown
---
name: github-mcp
description: Read GitHub issues, pull requests, repositories and Actions runs through the sdd-github MCP server to give context to a spec, a design or a fix. Read-only unless the Power is switched to Operate mode and the user asks for a change. Use when the user mentions an issue or PR number, a failing workflow, or wants a spec from an issue. En español: "lee el issue #…", "resume el PR", "¿por qué falla el workflow?", "crea el spec a partir del issue", "contexto de GitHub".
---

# GitHub: issues and PRs as context

This Power adds the `sdd-github` MCP server, GitHub's remote server, limited to the repos, issues, pull_requests and actions toolsets. It signs in with the user's GitHub account through VS Code (OAuth); no token is stored in the repo.

## When to use
- The user gives an issue or PR number or URL: read it (and its comments) before planning.
- Turning an issue into a spec: the issue becomes the source for `requirements` (problem, acceptance hints, links). Quote the issue and link it.
- A CI run failed: read the workflow run and its logs before proposing a fix.
- Reviewing: read the PR description, changed files and review comments.

## How
1. Identify owner/repo from the git remote of the workspace or from the URL the user gave.
2. Use the issue, pull request, repository and Actions tools of `sdd-github` to read exactly what you need; avoid listing whole repositories.
3. Summarize what you read with links, then continue with the task (spec, design, fix).

## Read-only by default
- In the default mode the server only reads. Never try to create, comment, merge or re-run anything.
- Only when the Power is in **Operate** mode *and* the user explicitly asks, you may write (comment, open an issue, create a PR). State exactly what you will do first and do one action at a time.
## If the tools are not available

If no `sdd-github` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-github` and sign in with GitHub when VS Code asks. If the server shows as disabled, the organization may need to enable the "MCP servers in Copilot" policy, or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
````

`powers/github-mcp/UPSTREAM.md`:

````markdown
# Origen

- Skill: escrito por SDD Studio para este Power (MIT, ver LICENSE).
- Servidor MCP: GitHub MCP Server (remoto) — https://github.com/github/github-mcp-server
- Licencia del servidor: MIT
- Conexión: servicio remoto `https://api.githubcopilot.com/mcp/readonly` (modo Operar: `https://api.githubcopilot.com/mcp/`), toolsets `repos,issues,pull_requests,actions`. Sin versión que fijar: lo opera GitHub. Autenticación OAuth gestionada por VS Code
- Configuración verificada el 2026-10-01

## Qué se redistribuye
Nada del servidor: solo su configuración en `mcp.vscode.json` (servidor `sdd-github`). El servidor lo sirve o lo publica su autor.
````

#### Power `playwright-mcp`

`powers/playwright-mcp/plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "playwright-mcp",
  "version": "1.0.0",
  "description": "Navegador real para verificar en la app lo que implementas, con capturas como evidencia.",
  "author": {
    "name": "SDD Studio",
    "url": "https://github.com/enriquecordero/sdd-studio"
  },
  "license": "MIT",
  "keywords": [
    "mcp",
    "playwright",
    "browser",
    "verification"
  ],
  "repository": "https://github.com/enriquecordero/sdd-studio",
  "homepage": "https://enriquecordero.github.io/sdd-studio/powers/playwright-mcp.html"
}
```

`powers/playwright-mcp/presentation.json`:

```json
{
  "displayName": "Playwright",
  "icon": "🎭",
  "category": "devcore",
  "summary": "Copilot abre tu app en un navegador, la prueba y te deja capturas como evidencia.",
  "triggers": [
    "\"pruébalo en el navegador\"",
    "\"verifica la pantalla…\"",
    "\"haz una captura\""
  ],
  "diagram": {
    "kind": "cycle",
    "nodes": [
      {
        "label": "IMPLEMENTA",
        "tone": "blue",
        "edge": "abre el navegador"
      },
      {
        "label": "ABRE",
        "tone": "accent",
        "edge": "comprueba y captura"
      },
      {
        "label": "VERIFICA",
        "tone": "green",
        "edge": "si falla, corrige"
      }
    ]
  },
  "gets": [
    "Comportamiento comprobado",
    "Capturas como evidencia",
    "Errores de consola a la vista"
  ],
  "source": {
    "repo": "enriquecordero/sdd-studio",
    "path": "powers/playwright-mcp",
    "commit": "main",
    "author": "SDD Studio",
    "license": "MIT"
  }
}
```

`powers/playwright-mcp/mcp.vscode.json`:

```json
{
  "prerequisites": [
    "node"
  ],
  "inputs": [],
  "servers": {
    "sdd-playwright": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@0.0.83",
        "--headless",
        "--isolated"
      ]
    }
  },
  "approxTools": {
    "sdd-playwright": 25
  },
  "beta": false,
  "credentials": "Ninguna (navegador aislado, sin tu perfil)",
  "example": "Arranca la app con npm run dev, abre http://localhost:5173, prueba el login con un usuario inválido y adjunta una captura del mensaje de error."
}
```

`powers/playwright-mcp/skills/playwright-mcp/SKILL.md`:

````markdown
---
name: playwright-mcp
description: Drive a real headless browser through the sdd-playwright MCP server to check implemented UI behavior in the running app and attach screenshots as evidence. Use after implementing or fixing something visible in a web app, when the user asks to test it in the browser, or before claiming a UI task is done. En español: "pruébalo en el navegador", "verifica la pantalla", "haz una captura", "comprueba que funciona en la app", "mira la consola del navegador".
---

# Playwright: verify in a real browser

This Power adds the `sdd-playwright` MCP server (Microsoft Playwright MCP). It runs locally through `npx` in a headless, isolated browser (a fresh profile in memory, without the user's cookies).

## When to use
- After implementing or fixing anything visible in a web app, before saying it works.
- When acceptance criteria describe UI behavior ("shows an error", "redirects to…").
- When the user reports a UI bug: reproduce it first.

## How
1. Make sure the app is running (ask the user or start the dev server if your tools allow it) and know its local URL.
2. Navigate with `browser_navigate`, read the page with `browser_snapshot` (accessibility tree), interact with `browser_click`, `browser_type` and friends.
3. Check each acceptance criterion you are verifying, one by one.
4. Capture evidence with `browser_take_screenshot` at the key states, and read `browser_console_messages` for errors.
5. Report: criterion → what you did → what you saw (with the screenshot). This is the evidence the `verification` Power asks for.

## Rules
- Only open local or test URLs unless the user asks otherwise. Never type real passwords or secrets into pages.
- A screenshot proves what it shows, nothing more: say what you did not check.
- If behavior is wrong, report it with the evidence before changing code.
## If the tools are not available

If no `sdd-playwright` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-playwright` (it needs Node.js; the first start downloads the package), or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
````

`powers/playwright-mcp/UPSTREAM.md`:

````markdown
# Origen

- Skill: escrito por SDD Studio para este Power (MIT, ver LICENSE).
- Servidor MCP: Playwright MCP, de Microsoft — https://github.com/microsoft/playwright-mcp
- Licencia del servidor: Apache-2.0
- Conexión: proceso local con `npx -y @playwright/mcp@0.0.83 --headless --isolated` (versión fijada)
- Configuración verificada el 2026-10-01

## Qué se redistribuye
Nada del servidor: solo su configuración en `mcp.vscode.json` (servidor `sdd-playwright`). El servidor lo sirve o lo publica su autor.
````

#### Power `aws`

`powers/aws/plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "aws",
  "version": "1.0.0",
  "description": "Consulta tu cuenta de AWS con tu perfil local; solo lectura por defecto y modo Operar con aviso.",
  "author": {
    "name": "SDD Studio",
    "url": "https://github.com/enriquecordero/sdd-studio"
  },
  "license": "MIT",
  "keywords": [
    "mcp",
    "aws",
    "cloud"
  ],
  "repository": "https://github.com/enriquecordero/sdd-studio",
  "homepage": "https://enriquecordero.github.io/sdd-studio/powers/aws.html"
}
```

`powers/aws/presentation.json`:

```json
{
  "displayName": "AWS",
  "icon": "☁️",
  "category": "cloud",
  "summary": "Copilot consulta tus recursos de AWS con tu perfil; solo lectura salvo que elijas Operar.",
  "triggers": [
    "\"lista mis buckets…\"",
    "\"¿qué hay desplegado en AWS?\"",
    "\"revisa la config de…\""
  ],
  "diagram": {
    "kind": "split",
    "columns": [
      {
        "label": "LEE",
        "tone": "green",
        "items": [
          "Lista recursos",
          "Consulta configuración",
          "Siempre disponible"
        ]
      },
      {
        "label": "OPERA",
        "tone": "warn",
        "items": [
          "Crea, cambia o borra",
          "Solo en modo Operar",
          "Pide confirmación"
        ]
      }
    ]
  },
  "gets": [
    "Respuestas sobre tu cuenta real",
    "Solo lectura por defecto",
    "Cambios solo con modo Operar"
  ],
  "source": {
    "repo": "enriquecordero/sdd-studio",
    "path": "powers/aws",
    "commit": "main",
    "author": "SDD Studio",
    "license": "MIT"
  }
}
```

`powers/aws/mcp.vscode.json`:

```json
{
  "prerequisites": [
    "uv",
    "aws"
  ],
  "inputs": [
    {
      "id": "sdd_aws_profile",
      "type": "promptString",
      "description": "Perfil de AWS (aws configure / aws sso login)",
      "default": "default"
    },
    {
      "id": "sdd_aws_region",
      "type": "promptString",
      "description": "Región de AWS",
      "default": "us-east-1"
    }
  ],
  "servers": {
    "sdd-aws": {
      "type": "stdio",
      "command": "uvx",
      "args": [
        "awslabs.aws-api-mcp-server@1.5.6"
      ],
      "env": {
        "AWS_REGION": "${input:sdd_aws_region}",
        "AWS_API_MCP_PROFILE_NAME": "${input:sdd_aws_profile}",
        "READ_OPERATIONS_ONLY": "true",
        "AWS_API_MCP_ALLOW_UNRESTRICTED_LOCAL_FILE_ACCESS": "no-access"
      }
    }
  },
  "approxTools": {
    "sdd-aws": 3
  },
  "beta": false,
  "credentials": "Tu perfil local de AWS; VS Code pide perfil y región al iniciar",
  "example": "Lista mis buckets de S3 en us-east-1 y dime cuáles no tienen activado el bloqueo de acceso público.",
  "operate": {
    "servers": {
      "sdd-aws": {
        "type": "stdio",
        "command": "uvx",
        "args": [
          "awslabs.aws-api-mcp-server@1.5.6"
        ],
        "env": {
          "AWS_REGION": "${input:sdd_aws_region}",
          "AWS_API_MCP_PROFILE_NAME": "${input:sdd_aws_profile}",
          "REQUIRE_MUTATION_CONSENT": "true",
          "AWS_API_MCP_ALLOW_UNRESTRICTED_LOCAL_FILE_ACCESS": "no-access"
        }
      }
    },
    "warning": "Copilot podrá crear, modificar o borrar recursos de AWS con tus credenciales. Cada cambio pedirá confirmación."
  }
}
```

`powers/aws/skills/aws/SKILL.md`:

````markdown
---
name: aws
description: Inspect the user's AWS account (resources, configuration, logs) through the sdd-aws MCP server, using the user's local AWS profile. Read-only by default; never propose or run changes unless the Power is in Operate mode and the user explicitly asks. Use when the user asks what is deployed, how a resource is configured, or to check costs or settings in AWS. En español: "lista mis buckets", "¿qué hay desplegado en AWS?", "revisa la configuración de…", "mira los logs de la Lambda", "consulta mi cuenta de AWS".
---

# AWS: your account, read-only by default

This Power adds the `sdd-aws` MCP server (AWS Labs AWS API server). It runs locally through `uvx` with the AWS profile and region the user chose when VS Code started it. In the default mode it only allows read operations (`READ_OPERATIONS_ONLY`) and cannot touch local files.

## When to use
- The user asks what exists or how something is configured in their AWS account.
- A design or a bug depends on the real state of the account (a bucket policy, a Lambda's settings, an alarm).

## How
1. If you are not sure of the exact command, call `suggest_aws_commands` with the question in plain words.
2. Run read commands with `call_aws` (describe, list, get). Keep them scoped to the region and resources in question.
3. Summarize the results; include identifiers (ARNs, names) so the user can check them.
4. For questions about how a service works (not the account), prefer the `aws-docs` Power.

## Read-only unless Operate is on
- Only consult. Never propose creating, modifying or deleting resources unless the Power is in **Operate** mode *and* the user explicitly asks for that change.
- In Operate mode: state the exact command and its effect first, do one change at a time, and let the user confirm each one (the server asks for consent on every mutating call).
- If a read fails with an authorization error, report it; do not try other credentials.
## If the tools are not available

If no `sdd-aws` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-aws` (it needs `uv` and a configured AWS profile), or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
````

`powers/aws/UPSTREAM.md`:

````markdown
# Origen

- Skill: escrito por SDD Studio para este Power (MIT, ver LICENSE).
- Servidor MCP: AWS API MCP Server, de AWS Labs — https://github.com/awslabs/mcp/tree/main/src/aws-api-mcp-server
- Licencia del servidor: Apache-2.0
- Conexión: proceso local con `uvx awslabs.aws-api-mcp-server@1.5.6` (versión fijada). Solo lectura: `READ_OPERATIONS_ONLY=true`; modo Operar: `REQUIRE_MUTATION_CONSENT=true`. Perfil y región llegan como `inputs` de VS Code
- Configuración verificada el 2026-10-01

## Qué se redistribuye
Nada del servidor: solo su configuración en `mcp.vscode.json` (servidor `sdd-aws`). El servidor lo sirve o lo publica su autor.
````

#### Power `azure`

`powers/azure/plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "azure",
  "version": "1.0.0",
  "description": "Consulta tu suscripción de Azure con tu sesión de az login; solo lectura por defecto y modo Operar con aviso (beta).",
  "author": {
    "name": "SDD Studio",
    "url": "https://github.com/enriquecordero/sdd-studio"
  },
  "license": "MIT",
  "keywords": [
    "mcp",
    "azure",
    "cloud"
  ],
  "repository": "https://github.com/enriquecordero/sdd-studio",
  "homepage": "https://enriquecordero.github.io/sdd-studio/powers/azure.html"
}
```

`powers/azure/presentation.json`:

```json
{
  "displayName": "Azure",
  "icon": "🔷",
  "category": "cloud",
  "summary": "Copilot consulta tus recursos de Azure con tu sesión de az login; solo lectura salvo que elijas Operar.",
  "triggers": [
    "\"lista mis recursos de Azure…\"",
    "\"¿qué hay en el resource group…?\"",
    "\"revisa el Key Vault…\""
  ],
  "diagram": {
    "kind": "split",
    "columns": [
      {
        "label": "LEE",
        "tone": "green",
        "items": [
          "Lista recursos",
          "Consulta configuración",
          "Siempre disponible"
        ]
      },
      {
        "label": "OPERA",
        "tone": "warn",
        "items": [
          "Crea, cambia o borra",
          "Solo en modo Operar",
          "Pide confirmación"
        ]
      }
    ]
  },
  "gets": [
    "Respuestas sobre tu suscripción",
    "Solo lectura por defecto",
    "Cambios solo con modo Operar"
  ],
  "source": {
    "repo": "enriquecordero/sdd-studio",
    "path": "powers/azure",
    "commit": "main",
    "author": "SDD Studio",
    "license": "MIT"
  }
}
```

`powers/azure/mcp.vscode.json`:

```json
{
  "prerequisites": [
    "node",
    "az"
  ],
  "inputs": [],
  "servers": {
    "sdd-azure": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@azure/mcp@3.0.0-beta.48",
        "server",
        "start",
        "--read-only"
      ]
    }
  },
  "approxTools": {
    "sdd-azure": 50
  },
  "beta": true,
  "credentials": "Tu sesión de Azure CLI (az login)",
  "example": "Lista las cuentas de almacenamiento de mi suscripción y dime cuáles permiten acceso público a blobs.",
  "operate": {
    "servers": {
      "sdd-azure": {
        "type": "stdio",
        "command": "npx",
        "args": [
          "-y",
          "@azure/mcp@3.0.0-beta.48",
          "server",
          "start"
        ]
      }
    },
    "warning": "Copilot podrá crear, modificar o borrar recursos de Azure con tu sesión de az login. Revisa cada llamada antes de aprobarla."
  }
}
```

`powers/azure/skills/azure/SKILL.md`:

````markdown
---
name: azure
description: Inspect the user's Azure subscription (resource groups, storage, Key Vault, App Service, monitoring and more) through the sdd-azure MCP server, using the user's az login session. Read-only by default; never propose or run changes unless the Power is in Operate mode and the user explicitly asks. Use when the user asks what is deployed in Azure or how a resource is configured. En español: "lista mis recursos de Azure", "¿qué hay en el resource group…?", "revisa el Key Vault", "consulta mi suscripción de Azure", "configuración de la Web App".
---

# Azure: your subscription, read-only by default

This Power adds the `sdd-azure` MCP server (Azure MCP Server, by Microsoft; currently a beta release). It runs locally through `npx` and signs in with the user's Azure CLI session (`az login`). In the default mode it starts with `--read-only`.

## When to use
- The user asks what exists or how something is configured in their Azure subscription.
- A design or a bug depends on the real state of a resource (an app setting, a storage firewall rule, a Key Vault access policy).

## How
1. Pick the tool for the service in question (storage, Key Vault, App Service, Monitor, resource groups…). The server groups its tools by service.
2. Scope each call to the subscription and resource group in question; ask the user if they are not clear.
3. Summarize the results with resource names and IDs so the user can check them.
4. For questions about how a service works (not the subscription), prefer the `microsoft-learn` Power.

## Read-only unless Operate is on
- Only consult. Never propose creating, modifying or deleting resources unless the Power is in **Operate** mode *and* the user explicitly asks for that change.
- In Operate mode: state the exact action and its effect first, do one change at a time, and wait for the user to approve each tool call.
- Never print secret values (keys, connection strings); report that they exist instead.
## If the tools are not available

If no `sdd-azure` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-azure` (it needs Node.js and an `az login` session), or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
````

`powers/azure/UPSTREAM.md`:

````markdown
# Origen

- Skill: escrito por SDD Studio para este Power (MIT, ver LICENSE).
- Servidor MCP: Azure MCP Server, de Microsoft — https://github.com/microsoft/mcp
- Licencia del servidor: MIT
- Conexión: proceso local con `npx -y @azure/mcp@3.0.0-beta.48 server start --read-only` (versión fijada; beta, porque la etiqueta `latest` de npm es una beta). Modo Operar: sin `--read-only`
- Configuración verificada el 2026-10-01

## Qué se redistribuye
Nada del servidor: solo su configuración en `mcp.vscode.json` (servidor `sdd-azure`). El servidor lo sirve o lo publica su autor.
````

- [ ] **Step 4: `LICENSE` de cada Power (MIT, el mismo texto)**

```bash
for id in github-mcp playwright-mcp aws azure; do cat > powers/$id/LICENSE <<'LIC'
MIT License

Copyright (c) 2026 Enrique Cordero (SDD Studio)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
LIC
done
```

- [ ] **Step 5: Validar y ejecutar los tests**

Run: `npm run build:catalog -- --check && npx vitest run && npm run build:site && npm run test:integration`
Expected: `✓ 17 Powers válidos`, todo PASS y `✓ Sitio generado en _site/ (17 Powers)`. Comprueba los catálogos web:

```bash
node -e "for (const f of ['catalog','catalog-v2']) { const c = require('./_site/powers/'+f+'.json'); console.log(f, c.schemaVersion, c.powers.length); }"
```

Expected: `catalog 1 10` y `catalog-v2 2 17`.

- [ ] **Step 6: Commit**

```bash
git add powers/github-mcp powers/playwright-mcp powers/aws powers/azure test/unit/powers/realCatalog.test.ts
git commit -m "feat(powers): Powers MCP GitHub, Playwright, AWS y Azure (nube en solo lectura por defecto)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Integración con el catálogo real (spec §9.3)

**Files:**
- Test: `test/integration/powers.mcp.real.test.ts`

**Interfaces:**
- Consumes: el catálogo incluido (`dist/catalog.json`, lo genera `npm run build` dentro de `test:integration`) con los Powers de las Tareas 9 y 10; `PowersService.activate/setMode/deactivate` (Tarea 7); `PowerInstaller(readPolicy)` (Tarea 6).
- Produces: la prueba de extremo a extremo del spec: `microsoft-learn` se activa, `aws` cambia a Operar y vuelve, desactivar deja el repo limpio y la política `none` devuelve `MCP_BLOCKED`.

- [ ] **Step 1: Escribir los tests**

`test/integration/powers.mcp.real.test.ts`:

```ts
import * as assert from 'assert';
import { PowerInstaller } from '../../src/powers/installer';
import { getApi, readWs, restoreFixture, ws } from './helpers';

const yes = async () => true;
const never = async (): Promise<boolean> => {
  throw new Error('no debe pedir confirmación');
};
const mcpJson = async () => JSON.parse(await readWs('.vscode/mcp.json'));
const lock = async () => JSON.parse(await readWs('.github/powers.lock.json'));

describe('Powers MCP del catálogo incluido (spec §9.3)', () => {
  beforeEach(restoreFixture);
  afterEach(async () => {
    const { powers } = await getApi();
    await powers.resetCatalog();
  });

  it('activar microsoft-learn escribe sdd-mslearn en .vscode/mcp.json y el lock v2', async () => {
    const { powers } = await getApi();
    assert.strictEqual(await powers.activate('microsoft-learn', ws(), yes), 'activated');
    assert.deepStrictEqual((await mcpJson()).servers['sdd-mslearn'], { type: 'http', url: 'https://learn.microsoft.com/api/mcp' });
    const l = await lock();
    assert.strictEqual(l.schemaVersion, 2);
    assert.strictEqual(l.powers['microsoft-learn'].mcp.mode, 'readOnly');
    assert.match(await readWs('.github/skills/microsoft-learn/SKILL.md'), /sdd-mslearn/);
  });

  it('aws: a Operar y de vuelta a Solo lectura; inputs de perfil y región', async () => {
    const { powers } = await getApi();
    await powers.activate('aws', ws(), yes);
    let file = await mcpJson();
    assert.strictEqual(file.servers['sdd-aws'].env.READ_OPERATIONS_ONLY, 'true');
    assert.deepStrictEqual(file.inputs.map((i: { id: string }) => i.id), ['sdd_aws_profile', 'sdd_aws_region']);
    await powers.setMode('aws', ws(), 'operate', never);
    file = await mcpJson();
    assert.strictEqual(file.servers['sdd-aws'].env.READ_OPERATIONS_ONLY, undefined);
    assert.strictEqual(file.servers['sdd-aws'].env.REQUIRE_MUTATION_CONSENT, 'true');
    assert.strictEqual((await lock()).powers.aws.mcp.mode, 'operate');
    await powers.setMode('aws', ws(), 'readOnly', never);
    assert.strictEqual((await mcpJson()).servers['sdd-aws'].env.READ_OPERATIONS_ONLY, 'true');
  });

  it('desactivar deja el repo como estaba', async () => {
    const { powers } = await getApi();
    await powers.activate('microsoft-learn', ws(), yes);
    await powers.activate('aws', ws(), yes);
    await powers.deactivate('aws', ws(), never);
    await powers.deactivate('microsoft-learn', ws(), never);
    await assert.rejects(readWs('.vscode/mcp.json'));
    assert.deepStrictEqual(await lock(), { schemaVersion: 1, powers: {} });
  });

  it('con chat.mcp.access = none, activar devuelve MCP_BLOCKED y no escribe nada', async () => {
    const { powers } = await getApi();
    const blocked = new PowerInstaller(() => ({ access: 'none', strictPluginOnly: false }));
    await assert.rejects(blocked.activate(ws(), await powers.find('microsoft-learn'), undefined, never), (e: { code?: string }) => e.code === 'MCP_BLOCKED');
    await assert.rejects(readWs('.vscode/mcp.json'));
    await assert.rejects(readWs('.github/skills/microsoft-learn/SKILL.md'));
  });
});
```

(El caso de `chat.mcp.access = none` inyecta la política en el instalador; ver la decisión 9 de Global Constraints).

- [ ] **Step 2: Ejecutarlos**

Run: `npm run test:integration`
Expected: PASS. Estos tests cubren comportamiento ya implementado en las Tareas 6–10, así que pasan a la primera: para comprobar que de verdad vigilan algo, cambia temporalmente `"READ_OPERATIONS_ONLY": "true"` por `"false"` en `powers/aws/mcp.vscode.json`, vuelve a ejecutar y mira fallar `aws: a Operar y de vuelta…`; después deshaz el cambio (`git checkout powers/aws/mcp.vscode.json`) y repite hasta ver PASS.

- [ ] **Step 3: Commit**

```bash
git add test/integration/powers.mcp.real.test.ts
git commit -m "test(mcp): integración con los Powers MCP reales del catálogo incluido

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Herramientas MCP en los agentes `sdd-*` (condicionada al spike)

> **Bloqueada por la Tarea 0, comprobación 1.** El controlador lee el resultado en el ledger (o en `docs/follow-ups.md`, sección "Spike MCP") y despacha **solo una** variante. Si el resultado aún no existe, la tarea espera.

**Files (variante A):**
- Modify: `agents/sdd-requirements.agent.md`, `agents/sdd-design.agent.md`, `agents/sdd-implement.agent.md`, `docs/agents.md`
- Test: `test/unit/manifest.test.ts`

**Files (variante B):**
- Modify: `docs/agents.md`
- Test: `test/unit/manifest.test.ts`

**Interfaces:**
- Consumes: los nombres de servidor de las Tareas 9 y 10 (`sdd-github`, `sdd-context7`, `sdd-mslearn`, `sdd-awsdocs`, `sdd-aws`, `sdd-azure`, `sdd-playwright`).
- Produces: la decisión que la Tarea 13 refleja en el README ("Los agentes `sdd-*` usan los Powers MCP activos" en A; "úsalos desde el modo Agent" en B).

#### Variante A — el spike no mostró avisos

- [ ] **Step A1: Escribir el test, que debe fallar**

En `test/unit/manifest.test.ts`, añade antes de `it('registra los 5 prompt files y existen', …)`:

```ts
  it('los agentes de fase pueden usar las herramientas de los Powers MCP (spec §6.6)', () => {
    const docs = ["'sdd-github/*'", "'sdd-context7/*'", "'sdd-mslearn/*'", "'sdd-awsdocs/*'"];
    const cloud = ["'sdd-aws/*'", "'sdd-azure/*'"];
    const expected: Record<string, string[]> = {
      'sdd-requirements': docs,
      'sdd-design': [...docs, ...cloud],
      'sdd-implement': [...docs, ...cloud, "'sdd-playwright/*'"],
    };
    for (const name of AGENTS) {
      const tools = frontMatterFields(readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8')).get('tools')!;
      const mcp = tools.match(/'sdd-[a-z0-9-]+\/\*'/g) ?? [];
      expect(mcp, name).toEqual(expected[name] ?? []);
    }
  });
```

- [ ] **Step A2: Ejecutarlo y ver que falla**

Run: `npx vitest run test/unit/manifest.test.ts`
Expected: FAIL en `sdd-requirements` (`[]` en lugar de las 4 herramientas).

- [ ] **Step A3: Editar los agentes**

`agents/sdd-requirements.agent.md`:
- Línea `tools:` →
  ```yaml
  tools: ['search', 'read', 'writeSpecDoc', 'approvePhase', 'sdd-github/*', 'sdd-context7/*', 'sdd-mslearn/*', 'sdd-awsdocs/*']
  ```
- Al final del paso 1, después de ``(Power `domain-modeling` si está activo).``, añade (con un espacio delante):
  ```markdown
  Si el pedido viene de un issue o PR de GitHub y el Power `github-mcp` está activo, léelo con `sdd-github` y enlázalo.
  ```

`agents/sdd-design.agent.md`:
- Línea `tools:` →
  ```yaml
  tools: ['search', 'read', 'writeSpecDoc', 'approvePhase', 'sdd-github/*', 'sdd-context7/*', 'sdd-mslearn/*', 'sdd-awsdocs/*', 'sdd-aws/*', 'sdd-azure/*']
  ```
- En el paso 2, sustituye ``(Power `research` si está activo).`` por:
  ```markdown
  (Power `research`, o los Powers de documentación `context7`, `microsoft-learn` y `aws-docs` si están activos; el estado real de la nube, con `aws` o `azure` en solo lectura).
  ```

`agents/sdd-implement.agent.md`:
- Línea `tools:` →
  ```yaml
  tools: ['search', 'read', 'edit', 'execute', 'setTaskStatus', 'approvePhase', 'sdd-github/*', 'sdd-context7/*', 'sdd-mslearn/*', 'sdd-awsdocs/*', 'sdd-aws/*', 'sdd-azure/*', 'sdd-playwright/*']
  ```
- En el paso 4, sustituye ``(Power `verification`).`` por:
  ```markdown
  (Power `verification`; si la tarea cambia una UI y el Power `playwright-mcp` está activo, compruébala en el navegador y adjunta capturas).
  ```

`docs/agents.md`: añade antes de `## Decisiones ante conflictos`:

```markdown
## Herramientas MCP (v0.5.0)

Si un Power con MCP está activo en el repo, sus herramientas están disponibles en estos agentes (si no lo está, VS Code ignora la entrada; comprobado en el spike de v0.5.0):

| Agente | Herramientas |
|---|---|
| `sdd-requirements` | `sdd-github/*`, `sdd-context7/*`, `sdd-mslearn/*`, `sdd-awsdocs/*` |
| `sdd-design` | las anteriores, `sdd-aws/*` y `sdd-azure/*` |
| `sdd-implement` | las anteriores y `sdd-playwright/*` |

Los Powers de nube arrancan en solo lectura; el skill de cada Power le dice al agente cuándo y cómo usarlo.
```

- [ ] **Step A4: Ejecutar los tests**

Run: `npx vitest run test/unit/manifest.test.ts && npx vitest run`
Expected: PASS (incluido el límite de 7000 bytes por agente: los tres quedan por debajo de 4700).

- [ ] **Step A5: Commit**

```bash
git add agents/sdd-requirements.agent.md agents/sdd-design.agent.md agents/sdd-implement.agent.md docs/agents.md test/unit/manifest.test.ts
git commit -m "feat(agents): los agentes de fase pueden usar las herramientas de los Powers MCP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

#### Variante B — el spike mostró avisos o errores

- [ ] **Step B1: Escribir el test que fija la decisión**

En `test/unit/manifest.test.ts`, añade antes de `it('registra los 5 prompt files y existen', …)`:

```ts
  it('los agentes no listan herramientas de servidores MCP (plan B del spec §6.6)', () => {
    for (const name of AGENTS) {
      const tools = frontMatterFields(readFileSync(join(root, 'agents', `${name}.agent.md`), 'utf8')).get('tools')!;
      expect(tools, name).not.toMatch(/'sdd-[a-z0-9-]+\/\*'/);
    }
  });
```

- [ ] **Step B2: Ejecutarlo**

Run: `npx vitest run test/unit/manifest.test.ts`
Expected: PASS (los agentes no cambian; el test evita que alguien los añada sin repetir el spike). Para ver que vigila algo, añade temporalmente `'sdd-github/*'` a la línea `tools:` de `agents/sdd-design.agent.md`, ejecuta (FAIL) y deshaz con `git checkout agents/sdd-design.agent.md`.

- [ ] **Step B3: Documentar**

`docs/agents.md`: añade antes de `## Decisiones ante conflictos`:

```markdown
## Herramientas MCP (v0.5.0)

Los agentes `sdd-*` **no** listan herramientas MCP: en el spike de v0.5.0, VS Code avisaba cuando un `.agent.md` nombraba un servidor que no estaba instalado. Los Powers con MCP se usan desde el modo **Agent** normal de Copilot; su skill le dice cuándo y cómo usar cada servidor.
```

- [ ] **Step B4: Commit**

```bash
git add docs/agents.md test/unit/manifest.test.ts
git commit -m "docs(agents): los Powers MCP se usan desde el modo Agent (plan B del spike)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: README, checklist manual y versión 0.5.0

**Files:**
- Modify: `README.md`, `docs/manual-checklist.md`, `package.json` (`version`), `package-lock.json`, `site/index.html`

**Interfaces:**
- Consumes: todo lo anterior, y la variante elegida en la Tarea 12.
- Produces: la rama lista para el PR de la v0.5.0.

- [ ] **Step 1: Versión 0.5.0**

```bash
node -e "const f='package.json',p=require('./'+f);p.version='0.5.0';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
npm_config_registry=https://registry.npmjs.org/ npm install --package-lock-only
sed -i '' 's/v0\.4\.0 · extensión para VS Code/v0.5.0 · extensión para VS Code/; s/sdd-studio-0\.4\.0\.vsix/sdd-studio-0.5.0.vsix/g' site/index.html
grep -c "0.5.0" site/index.html
node -e "console.log(require('./package-lock.json').version, require('./package-lock.json').packages[''].version)"
```

Expected: `2` y `0.5.0 0.5.0`.

- [ ] **Step 2: README — sección "🔌 Powers con MCP"**

En `README.md`, inserta esta sección justo antes de `## 📦 Instalar`:

````markdown
## 🔌 Powers con MCP

Algunos Powers traen, además de su skill, **servidores MCP**: herramientas reales para Copilot (documentación vigente, un navegador, GitHub y tu nube). Igual que en Kiro, se activan **por repo** desde la galería: el skill va a `.github/skills/<id>/` y el servidor se añade a **`.vscode/mcp.json`**, así que tu equipo lo recibe por git. El skill le dice a Copilot cuándo y cómo usar cada servidor.

| | Power | Servidor | Dónde corre | Prerrequisitos | Credenciales | Modo |
|---|---|---|---|---|---|---|
| 🐙 | [GitHub](https://enriquecordero.github.io/sdd-studio/powers/github-mcp.html) | `sdd-github` | Remoto (GitHub) | — | OAuth de VS Code | Solo lectura · Operar opcional |
| 🎭 | [Playwright](https://enriquecordero.github.io/sdd-studio/powers/playwright-mcp.html) | `sdd-playwright` | **Local** (`npx`) | Node.js | — | — |
| 📖 | [Context7](https://enriquecordero.github.io/sdd-studio/powers/context7.html) | `sdd-context7` | Remoto (Upstash) | — | — (anónimo) | — |
| 🎓 | [Microsoft Learn](https://enriquecordero.github.io/sdd-studio/powers/microsoft-learn.html) | `sdd-mslearn` | Remoto (Microsoft) | — | — | — |
| 📙 | [AWS Docs](https://enriquecordero.github.io/sdd-studio/powers/aws-docs.html) | `sdd-awsdocs` | **Local** (`uvx`) | uv | — | — |
| ☁️ | [AWS](https://enriquecordero.github.io/sdd-studio/powers/aws.html) | `sdd-aws` | **Local** (`uvx`) | uv, AWS CLI | Tu perfil de AWS (VS Code pide perfil y región) | Solo lectura · Operar opcional |
| 🔷 | [Azure](https://enriquecordero.github.io/sdd-studio/powers/azure.html) (beta) | `sdd-azure` | **Local** (`npx`) | Node.js, Azure CLI | `az login` | Solo lectura · Operar opcional |

**Cómo activarlos**
1. Panel ⚡ → Powers → **Abrir galería…** → filtro **🔌 Con MCP** → **+ Activar en este repo**.
2. Un aviso te enseña qué servidores se añaden, cuáles **ejecutan código en tu máquina** (y con qué comando), qué prerrequisitos te faltan y si es beta.
3. VS Code te pedirá **confiar en el servidor e iniciarlo** (botón **Ver servidores MCP** en la notificación).
4. Commitea `.github/` y `.vscode/mcp.json` para compartirlo con tu equipo.

**Cómo cambiar a *Operar*** (GitHub, AWS y Azure): en la galería, en el Power activo, pulsa **Operar**. Antes verás un aviso con lo que implica (por ejemplo: *"Copilot podrá crear, modificar o borrar recursos de AWS con tus credenciales. Cada cambio pedirá confirmación."*). El modo vive en `.vscode/mcp.json`, así que **es del repo y se revisa en el PR**. Vuelve a **Solo lectura** con el mismo selector.

**Ejemplos de prompt** (en Copilot Chat, modo Agent, con el Power activo):

| Power | Prompt |
|---|---|
| GitHub | `Lee el issue #42 de este repo con sus comentarios y crea un spec a partir de él con sdd-spec.` |
| Playwright | `Arranca la app con npm run dev, abre http://localhost:5173, prueba el login con un usuario inválido y adjunta una captura del mensaje de error.` |
| Context7 | `Usa Context7 para ver cómo se define un middleware en Next.js 15 y escribe el de autenticación, citando la doc.` |
| Microsoft Learn | `Busca en Microsoft Learn cómo dar acceso a Key Vault desde una Function con identidad administrada y escribe el Bicep, citando la doc.` |
| AWS Docs | `Consulta la documentación de AWS sobre el tamaño máximo de un mensaje de SQS y ajusta el productor, citando la página.` |
| AWS | `Lista mis buckets de S3 en us-east-1 y dime cuáles no tienen activado el bloqueo de acceso público.` |
| Azure | `Lista las cuentas de almacenamiento de mi suscripción y dime cuáles permiten acceso público a blobs.` |

**Si tu organización bloquea MCP**
- La galería muestra **🔒 Bloqueado por tu organización** en los Powers con MCP y **SDD Studio: Diagnóstico** explica la causa: `chat.mcp.access = none`, solo servidores del registro de la organización o la política *ChatStrictPluginOnlyCustomization*.
- Si los servidores aparecen **deshabilitados** en VS Code, pide a tu admin de GitHub que active la política **"MCP servers in Copilot"** ([documentación](https://docs.github.com/en/copilot/concepts/mcp-management)).
- El diagnóstico también avisa si falta un prerrequisito, si el workspace no es de confianza, si `.vscode/mcp.json` está en `.gitignore`, si falta un servidor (botón **Reparar**) o si los Powers activos suman más de ~100 herramientas (Copilot admite 128 por petición).

> 🔐 **Seguridad**
> - Los servidores **locales** (Playwright, AWS Docs, AWS, Azure) ejecutan código en tu máquina; VS Code pide confianza antes de iniciarlos y solo arrancan en workspaces de confianza.
> - Las versiones están **fijadas** (`@playwright/mcp@0.0.83`, `awslabs.aws-documentation-mcp-server@1.2.2`, `awslabs.aws-api-mcp-server@1.5.6`, `@azure/mcp@3.0.0-beta.48`); nunca `@latest`.
> - **Nunca se guarda un secreto en el repo:** GitHub usa el OAuth de VS Code; AWS pide perfil y región como `inputs`; Azure usa tu `az login`.

> ⚠️ **Actualiza todo el equipo a v0.5.0.** Si alguien activa un Power MCP, el lock pasa a `schemaVersion 2` y v0.4.0 mostrará un error de formato (es a propósito: no sabría desactivar los servidores). La galería de v0.4.0 no ve los Powers MCP.
````

Y una línea según la variante de la Tarea 12, al final de la sección, antes de `## 📦 Instalar`:
- **Variante A:**
  ```markdown
  > 🤖 Los agentes `sdd-requirements`, `sdd-design` y `sdd-implement` pueden usar las herramientas de los Powers MCP activos (detalle en [`docs/agents.md`](docs/agents.md)).
  ```
- **Variante B:**
  ```markdown
  > 🤖 Usa los Powers MCP desde el modo **Agent** normal de Copilot: los agentes `sdd-*` no los listan (detalle en [`docs/agents.md`](docs/agents.md)).
  ```

- [ ] **Step 3: README — los 7 Powers en "🎯 Cómo usar cada Power"**

Justo antes de `#### 🔗 Combinaciones recomendadas con el flujo SDD`, añade:

````markdown
<details>
<summary><b>🐙 GitHub</b> (🔌 MCP) — Issues, PRs, repos y Actions como contexto para tus specs</summary>

**Cuándo usarlo:** cuando un spec nace de un issue, para resumir un PR o para entender por qué falla un workflow.

**Cómo activarlo:** automático con "lee el issue #…", "resume el PR…", "¿por qué falla el workflow?". La primera vez, VS Code te pide iniciar sesión en GitHub.

**Ejemplo:**
```text
Lee el issue #42 de este repo con sus comentarios y crea un spec a partir de él con sdd-spec.
```

**Qué hace el agente:**
1. Lee el issue o el PR (y sus comentarios) con `sdd-github`, en solo lectura.
2. Resume lo que leyó con enlaces y lo usa como fuente de los requisitos.
3. Solo en modo **Operar** y si se lo pides, comenta, abre issues o PRs, una acción cada vez.

**Obtienes / Consejo:** specs trazables al issue. Encaja en la fase de requisitos.
</details>

<details>
<summary><b>🎭 Playwright</b> (🔌 MCP) — Prueba en un navegador real lo que implementas, con capturas</summary>

**Cuándo usarlo:** después de implementar o arreglar algo visible en una app web, antes de darlo por hecho.

**Cómo activarlo:** automático con "pruébalo en el navegador", "verifica la pantalla", "haz una captura". Necesita Node.js.

**Ejemplo:**
```text
Arranca la app con npm run dev, abre http://localhost:5173, prueba el login con un usuario inválido y adjunta una captura del mensaje de error.
```

**Qué hace el agente:**
1. Abre la URL local en un navegador headless y aislado (sin tus cookies).
2. Recorre cada criterio de aceptación con clics y textos.
3. Hace capturas en los estados clave y revisa los errores de consola.
4. Informa criterio → qué hizo → qué vio, con las capturas como evidencia.

**Obtienes / Consejo:** la evidencia que pide el Power `verification`. Úsalo en **▶ Ejecutar tarea** para tareas de UI.
</details>

<details>
<summary><b>📖 Context7</b> (🔌 MCP) — Doc vigente de librerías y frameworks, por versión</summary>

**Cuándo usarlo:** antes de escribir código contra una librería externa, sobre todo si nombras una versión.

**Cómo activarlo:** automático con "¿cómo se usa…?", "según la doc de…", "usa context7".

**Ejemplo:**
```text
Usa Context7 para ver cómo se define un middleware en Next.js 15 y escribe el de autenticación, citando la doc.
```

**Qué hace el agente:**
1. Busca la librería en Context7 y elige la versión del proyecto.
2. Pide la documentación del tema concreto.
3. Escribe el código según la doc (si su memoria no coincide, gana la doc) y cita la fuente.

**Obtienes / Consejo:** menos APIs inventadas. Anónimo, con límite de peticiones; úsalo en diseño e implementación.
</details>

<details>
<summary><b>🎓 Microsoft Learn</b> (🔌 MCP) — Doc oficial de Microsoft y ejemplos de código</summary>

**Cuándo usarlo:** antes de escribir código, Bicep o comandos para Azure, .NET o Microsoft 365.

**Cómo activarlo:** automático con "según Microsoft Learn…", "¿cómo se hace en Azure…?", "doc oficial de .NET".

**Ejemplo:**
```text
Busca en Microsoft Learn cómo dar acceso a Key Vault desde una Function con identidad administrada y escribe el Bicep, citando la doc.
```

**Qué hace el agente:**
1. Busca en la documentación oficial y lee las páginas relevantes.
2. Si hace falta código, parte de un ejemplo oficial.
3. Termina con la lista de URLs de learn.microsoft.com que usó.

**Obtienes / Consejo:** decisiones apoyadas en la doc oficial. Sin credenciales.
</details>

<details>
<summary><b>📙 AWS Docs</b> (🔌 MCP) — Documentación oficial de AWS, con citas</summary>

**Cuándo usarlo:** cuando una decisión depende de un límite, una cuota o un valor por defecto de AWS, o antes de escribir infraestructura.

**Cómo activarlo:** automático con "según la documentación de AWS", "límites de S3", "¿cómo se configura en AWS…?". Necesita `uv`.

**Ejemplo:**
```text
Consulta la documentación de AWS sobre el tamaño máximo de un mensaje de SQS y ajusta el productor, citando la página.
```

**Qué hace el agente:**
1. Busca en la documentación de AWS y lee la página (o las secciones) que aplican.
2. Escribe el código o la infraestructura según la doc.
3. Cita las URLs de docs.aws.amazon.com que usó.

**Obtienes / Consejo:** límites reales, no de memoria. No usa credenciales: para ver tu cuenta, el Power `aws`.
</details>

<details>
<summary><b>☁️ AWS</b> (🔌 MCP) — Tu cuenta de AWS, en solo lectura por defecto</summary>

**Cuándo usarlo:** para saber qué hay desplegado o cómo está configurado un recurso en tu cuenta.

**Cómo activarlo:** automático con "lista mis buckets…", "¿qué hay desplegado en AWS?", "revisa la configuración de…". Necesita `uv` y un perfil de AWS; al iniciar el servidor, VS Code te pide perfil y región.

**Ejemplo:**
```text
Lista mis buckets de S3 en us-east-1 y dime cuáles no tienen activado el bloqueo de acceso público.
```

**Qué hace el agente:**
1. Ejecuta solo operaciones de lectura (`READ_OPERATIONS_ONLY`), sin acceso a tus archivos locales.
2. Resume los resultados con ARNs y nombres para que los compruebes.
3. Solo en modo **Operar** y si se lo pides, propone el cambio exacto y cada uno pide tu confirmación.

**Obtienes / Consejo:** respuestas sobre tu cuenta real. Para "¿cómo funciona X?", mejor `aws-docs`.
</details>

<details>
<summary><b>🔷 Azure</b> (🔌 MCP, beta) — Tu suscripción de Azure, en solo lectura por defecto</summary>

**Cuándo usarlo:** para saber qué hay en un resource group o cómo está configurado un recurso.

**Cómo activarlo:** automático con "lista mis recursos de Azure…", "¿qué hay en el resource group…?", "revisa el Key Vault…". Necesita Node.js y `az login`.

**Ejemplo:**
```text
Lista las cuentas de almacenamiento de mi suscripción y dime cuáles permiten acceso público a blobs.
```

**Qué hace el agente:**
1. Arranca el servidor con `--read-only` y consulta el servicio que toca.
2. Resume con nombres e ids de recurso; nunca muestra secretos.
3. Solo en modo **Operar** y si se lo pides, hace un cambio cada vez, tras tu aprobación.

**Obtienes / Consejo:** respuestas sobre tu suscripción real. Es beta (la etiqueta `latest` de npm es una beta): la versión está fijada.
</details>

````

Y en la tabla de `#### 🔗 Combinaciones recomendadas con el flujo SDD`, añade los Powers MCP:

```markdown
| Requisitos | `domain-modeling`, `github-mcp` | Fijar el vocabulario en `GLOSSARY.md` para que los requisitos usen términos consistentes; con `github-mcp`, partir del issue real |
| Diseño | `codebase-design`, `domain-modeling`, `research`, `context7`, `microsoft-learn`, `aws-docs`, `aws`, `azure` | Interfaces y seams razonados, ADRs en `docs/adr/` y decisiones apoyadas en documentación oficial; doc vigente de librerías y nubes y el estado real de tu cuenta (solo lectura) |
| Implementación | `tdd`, `systematic-debugging`, `verification`, `playwright-mcp` | Test primero en **▶ Ejecutar tarea**, causa raíz si algo falla y evidencia antes de marcar hecha; capturas del navegador en tareas de UI |
```

(Sustituyen a las filas `Requisitos`, `Diseño` e `Implementación` actuales; las demás no cambian).

- [ ] **Step 4: README — desarrolladores y créditos**

- En el diagrama mermaid de `## 🛠️ Para desarrolladores`, cambia `POW["powers/ (10 Powers)"]` por `POW["powers/ (17 Powers)"]`.
- En `<summary><b>➕ Añadir un Power</b></summary>`, añade al bloque de estructura, después de la línea de `presentation.json`:
  ```
    mcp.vscode.json      opcional: servidores MCP (sdd-*), inputs, prerrequisitos, approxTools, modo Operar
  ```
- En `## 🙏 Créditos y licencia`, añade después de la línea de **Powers**:
  ```markdown
  - **Servidores MCP** (no se redistribuyen; solo su configuración): [GitHub MCP Server](https://github.com/github/github-mcp-server) (MIT), [Playwright MCP](https://github.com/microsoft/playwright-mcp) (Apache-2.0), [Context7](https://github.com/upstash/context7) (MIT), [Microsoft Learn MCP](https://github.com/MicrosoftDocs/mcp), [AWS MCP Servers](https://github.com/awslabs/mcp) (Apache-2.0) y [Azure MCP Server](https://github.com/microsoft/mcp) (MIT). Los skills de esos Powers son de SDD Studio (MIT).
  ```

- [ ] **Step 5: Checklist manual**

Añade al final de `docs/manual-checklist.md`:

```markdown
## Powers con MCP (v0.5.0)
- [ ] La galería muestra el filtro "🔌 Con MCP" y las categorías Dev core, Documentación y Cloud; las tarjetas MCP llevan "🔌 MCP" y el póster, la franja "SERVIDORES MCP".
- [ ] Activar **Context7** muestra el aviso (servidor remoto, sin prerrequisitos), crea `.vscode/mcp.json` con `sdd-context7` y el lock pasa a `schemaVersion 2`; "Ver servidores MCP" abre la lista.
- [ ] Iniciar `sdd-context7`, confiar en él y pedir a Copilot (modo Agent): "Usa Context7 para ver cómo se define un middleware en Next.js 15…" → la respuesta cita la librería.
- [ ] Activar **GitHub** con la cuenta real (Copilot Enterprise): iniciar sesión cuando VS Code lo pida y pedir "Lee el issue #… de este repo" → lo resume con enlace.
- [ ] Activar **AWS**: el aviso dice que ejecuta código local (`uvx awslabs.aws-api-mcp-server@1.5.6`) y avisa si falta `uv`; al iniciar, VS Code pide perfil y región.
- [ ] Cambiar AWS a **Operar**: aparece el aviso; `.vscode/mcp.json` pasa a tener `REQUIRE_MUTATION_CONSENT` y no `READ_OPERATIONS_ONLY`; el selector resalta "Operar" en ámbar. Volver a **Solo lectura** lo revierte.
- [ ] Editar a mano `sdd-aws` en `.vscode/mcp.json` y cambiar de modo → pregunta antes de sobrescribir.
- [ ] Con `"chat.mcp.access": "none"` en la configuración, la galería muestra "🔒 Bloqueado por tu organización" y el Diagnóstico da el error `mcp-policy`; los Powers sin MCP se siguen activando.
- [ ] El Diagnóstico, con AWS y Azure activos y sin `az`, muestra `mcp-prereq-az` con el enlace de instalación, y la línea informativa de "MCP servers in Copilot".
- [ ] Borrar `sdd-context7` de `.vscode/mcp.json` → el Diagnóstico ofrece **Reparar** y la entrada vuelve.
- [ ] Desactivar todos los Powers MCP: si `.vscode/mcp.json` lo creó SDD Studio, desaparece; si ya existía, queda como estaba (comentarios incluidos).
- [ ] Las páginas https://enriquecordero.github.io/sdd-studio/powers/context7.html y `/aws.html` muestran la franja MCP y "Cómo usarlo"; `/powers/catalog.json` (v1) no incluye Powers MCP y `/powers/catalog-v2.json` sí.
```

- [ ] **Step 6: Verificación final completa**

Run: `npm run lint && npm run typecheck && npx vitest run && npm run build:catalog -- --check && npm run build:site && npm run test:integration && npm run package`
Expected: todo en verde y `sdd-studio-0.5.0.vsix` generado (no se commitea).

- [ ] **Step 7: Commit**

```bash
git add README.md docs/manual-checklist.md package.json package-lock.json site/index.html
git commit -m "chore: v0.5.0 — README de Powers con MCP, checklist manual y versión

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Después del plan (lo hace el controlador tras la revisión final)

1. Push de `feat/mcp-powers`, abrir el PR contra `main`, esperar el CI y hacer el merge.
2. Esperar a que el workflow de Pages publique y comprobar con `curl` que responden con 200 `/powers/catalog.json` (v1, 10 Powers), `/powers/catalog-v2.json` (v2, 17 Powers) y `/powers/aws.html`.
3. Tag `v0.5.0`. El workflow Release publica el `.vsix`.
4. Pasar la checklist manual "Powers con MCP (v0.5.0)" con la cuenta real.

## Cobertura del spec

| Sección del spec | Tarea |
|---|---|
| 1 Objetivo, decisiones y supuestos | Todas; secretos: Tarea 1 (regla 4) y 9–10; bloqueo: 5, 6 y 8 |
| 2 Alcance (dentro) | 1–13; lo de "fuera" no tiene tarea |
| 3 Catálogo inicial (7 Powers, versiones, beta, `approxTools`, diagramas) | 9, 10 (valores medidos: Tarea 0) |
| 3.1 Skills (cuándo usar, `sdd-<servidor>`, sin `mcp__`, qué hacer si no hay herramientas) | 9, 10; el guardián lo comprueba (Tarea 3) |
| 4 Estructura y 4.1 `mcp.vscode.json` (7 reglas) | 1 (validación), 3 (`build:catalog` y carga del catálogo) |
| 5 Catálogo generado y v2 | 3 |
| 6.1 Módulos nuevos y cambios | 1, 2, 5, 6, 7, 8 |
| 6.2 Lock v2 | 4, 6 |
| 6.3 Flujos: activar (política, archivo inválido, conflicto, modal, escritura con rollback, notificación) | 6 (lógica), 7 (modal y notificación) |
| 6.3 Actualizar, cambiar modo, desactivar (`createdFile`, inputs compartidos) | 6, 7 |
| 6.4 Errores | 6 (`MCP_BLOCKED`, `MCP_FILE_INVALID`, `MCP_NAME_CONFLICT`; `MCP_EDITED` como confirmación), 7 (mensajes) |
| 6.5 Galería y póster | 8 |
| 6.6 Agentes `sdd-*` | 12 (variante según la Tarea 0) |
| 7 Diagnóstico y políticas | 5 (chequeos y entorno), 7 (comando de Reparar), 8 (🔒) |
| 8 Sitio y documentación | 3 (catálogos web), 8 ("Cómo usarlo"), 13 (README, checklist, versión) |
| 9.1 Spike | 0 |
| 9.2 Unitarias | 1–5, 7, 8 (el instalador, en integración: ver decisión 9) |
| 9.3 Integración | 6, 7, 11 |
| 9.4 CI | Sin cambios de workflow; `build:catalog -- --check` y `build:site` cubren lo nuevo (Tareas 3, 9, 10) |
| 10 Riesgos | Diagnóstico (5), modal (7), versiones fijadas (1, 9, 10), `approxTools` (5), catálogo v1 y lock v2 (3, 4), `MCP_EDITED` (6) |
