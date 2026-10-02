# SDD Studio — Spec 3: Powers con MCP

- **Fecha:** 2026-10-01
- **Estado:** borrador para revisión
- **Versión objetivo:** v0.5.0
- **Depende de:** Spec 2 (`docs/superpowers/specs/2026-10-01-powers-design.md`), publicado en v0.3.0 y vigente en v0.4.0.
- **Investigación:** `.superpowers/mcp-research.md` y `.superpowers/mcp-servers-verified.md` (locales, no versionados). Los hechos clave están copiados en este spec.

## 1. Objetivo

Que un Power, igual que en Kiro, pueda traer **servidores MCP** además de su skill. El dev lo activa desde la galería y Copilot gana herramientas reales: documentación vigente, navegador, GitHub y nube. El skill del Power le dice a Copilot cuándo y cómo usarlas.

**Éxito significa:**

- Un dev activa, por ejemplo, el Power *Context7* desde la galería. Queda el skill en `.github/skills/` y el servidor `sdd-context7` en `.vscode/mcp.json`, y Copilot lo usa en el chat.
- El equipo recibe los servidores por git, sin pasos extra salvo confiar en el servidor e iniciarlo, que VS Code pide.
- Nunca se escribe un secreto en el repo.
- Los Powers de nube arrancan en **solo lectura**. Para operar hay que cambiar el modo explícitamente, tras un aviso.
- Si la organización bloquea MCP, la galería y el diagnóstico lo dicen claramente en vez de fallar en silencio.
- El README explica cómo se usa cada Power con MCP.

### Decisiones del usuario

| Tema | Decisión |
|---|---|
| Propósito | Powers con MCP, como Kiro: servidor + skill, activables por repo desde la galería |
| Catálogo inicial | *Dev core* (GitHub, Playwright), *Documentación* (Context7, Microsoft Learn, AWS Docs), *Cloud* (AWS, Azure) |
| Nube | Solo lectura por defecto; el modo *Operar* se activa explícitamente, con aviso |
| Dónde vive la configuración | **Enfoque A**: se fusiona en `.vscode/mcp.json` del repo, con `inputs` para lo personal |
| Documentación | El README gana la sección **"🔌 Powers con MCP"**, con el uso de cada Power |

### Supuestos (no corregidos por el usuario)

- Los secretos nunca se commitean: solo `${input:…}` o el OAuth que gestiona VS Code.
- El diagnóstico orienta cuando la política de Enterprise tiene MCP desactivado.
- Cada Power con MCP incluye un skill que le dice a Copilot cuándo y cómo usar el servidor.

### Alternativas descartadas

- **B, servidores registrados por la extensión** (`mcpServerDefinitionProvider`): no hay archivos, pero quien no tiene la extensión no ve los servidores, es menos transparente y no está documentado si las políticas se aplican igual.
- **C, Agent Plugins** (`mcp.json` del plugin): pasa la política estricta, pero se instala por usuario y no por repo, y el formato v1 no admite secretos ni `inputs`. Queda como alternativa futura si la organización activa `ChatStrictPluginOnlyCustomization`.

## 2. Alcance

**Dentro:**

- Formato `mcp.vscode.json` dentro de `powers/<id>/` y su validación.
- Fusión y retirada de entradas en `.vscode/mcp.json` respetando JSONC (comentarios y servidores ajenos).
- Lock v2 con la parte MCP de cada Power.
- Selector de modo *Solo lectura* / *Operar* para los Powers que lo declaran.
- Categorías nuevas, distintivo 🔌 MCP, filtro "Con MCP" y franja MCP en el póster (VS Code y `/powers/`).
- Chequeos MCP en el diagnóstico y estado "🔒 Bloqueado" en la galería.
- Catálogo `schemaVersion: 2` (`catalog-v2.json`), sin dejar de publicar el v1.
- 7 Powers nuevos (sección 3).
- Herramientas MCP en el front matter de los agentes `sdd-*`, condicionado al spike (sección 9.1).
- README, `/powers/`, `docs/manual-checklist.md` y versión 0.5.0.

**Fuera (v1 de esta fase):**

- GitHub local con Docker, el servidor remoto administrado de AWS (necesita un proxy SigV4 no confirmado), Atlassian, Figma, Supabase, Sentry y Linear.
- La clave opcional de Context7.
- Entrega como Agent Plugin (alternativa C).
- Registrar servidores desde la extensión (alternativa B).
- Detectar por API la política de GitHub "MCP servers in Copilot": no existe tal API, así que solo damos texto guía.
- Arrancar o confiar en servidores por código: lo hace el usuario en VS Code.

## 3. Catálogo inicial

Nombres de servidor con el prefijo `sdd-`. Versiones fijadas el 2026-10-01; está prohibido `@latest`.

| Power (`id`) | Categoría | Servidor | Definición (modo por defecto) | Prerrequisitos | Credenciales | Modo *Operar* |
|---|---|---|---|---|---|---|
| `github-mcp` | devcore | `sdd-github` | `{"type":"http","url":"https://api.githubcopilot.com/mcp/readonly","headers":{"X-MCP-Toolsets":"repos,issues,pull_requests,actions"}}` | — | OAuth de VS Code | `url` → `https://api.githubcopilot.com/mcp/` |
| `playwright-mcp` | devcore | `sdd-playwright` | `{"type":"stdio","command":"npx","args":["-y","@playwright/mcp@0.0.83","--headless","--isolated"]}` | node | — | — |
| `context7` | docs | `sdd-context7` | `{"type":"http","url":"https://mcp.context7.com/mcp"}` | — | — | — |
| `microsoft-learn` | docs | `sdd-mslearn` | `{"type":"http","url":"https://learn.microsoft.com/api/mcp"}` | — | — | — |
| `aws-docs` | docs | `sdd-awsdocs` | `{"type":"stdio","command":"uvx","args":["awslabs.aws-documentation-mcp-server@1.2.2"],"env":{"FASTMCP_LOG_LEVEL":"ERROR","AWS_DOCUMENTATION_PARTITION":"aws"}}` | uv | — | — |
| `aws` | cloud | `sdd-aws` | `{"type":"stdio","command":"uvx","args":["awslabs.aws-api-mcp-server@1.5.6"],"env":{"AWS_REGION":"${input:sdd_aws_region}","AWS_API_MCP_PROFILE_NAME":"${input:sdd_aws_profile}","READ_OPERATIONS_ONLY":"true","AWS_API_MCP_ALLOW_UNRESTRICTED_LOCAL_FILE_ACCESS":"no-access"}}` | uv, aws | perfil y región como `inputs` `promptString` (por defecto `default` y `us-east-1`) | `env`: se quita `READ_OPERATIONS_ONLY` y se añade `REQUIRE_MUTATION_CONSENT=true` |
| `azure` | cloud | `sdd-azure` | `{"type":"stdio","command":"npx","args":["-y","@azure/mcp@3.0.0-beta.48","server","start","--read-only"]}` | node, az | `az login` | `args` sin `--read-only` |

- Azure se marca **beta** en el póster, porque la etiqueta `latest` de npm es una beta.
- `approxTools` por servidor (para el aviso del límite de 128 herramientas) se declara en `mcp.vscode.json`. El valor se mide en el spike y se redondea hacia arriba.
- Los diagramas siguen las reglas de `presentation.json` (etiqueta ≤ 14, arista ≤ 22, ítem ≤ 24). Ejemplos:
  - Documentación: `steps` PREGUNTA → BUSCA DOC → CITA → CÓDIGO.
  - Playwright: `cycle` IMPLEMENTA → ABRE → VERIFICA.
  - Cloud: `split` LEE (siempre) / OPERA (con modo).

### 3.1 Skills

Cada Power trae un skill propio (MIT, escrito por nosotros), con el cuerpo en inglés y la `description` con palabras clave en español e inglés, como en el Spec 2. Contenido mínimo:

- **Cuándo usar** el servidor, nombrado como `sdd-<servidor>`. Está prohibido `mcp__` y el resto de `FORBIDDEN_TERMS`.
- **Documentación:** consultar la doc vigente *antes* de escribir código contra una API externa y citar la fuente.
- **Playwright:** verificar en el navegador lo implementado y aportar capturas como evidencia (encaja con el Power `verification`).
- **GitHub:** leer issues y PRs para dar contexto a un spec (issue → `requirements`).
- **Cloud:** solo consultar por defecto, y nunca proponer cambios de recursos salvo que el modo *Operar* esté activo y el usuario lo pida.
- **Si las herramientas no aparecen,** decírselo al usuario y sugerir *SDD: Diagnóstico*, sin inventar resultados.

`UPSTREAM.md` enlaza el repo del servidor y su licencia. No se redistribuye código de los servidores, solo su configuración.

## 4. Estructura en el repo

```
powers/<id>/
  plugin.json
  presentation.json        # category ∈ {…, devcore, docs, cloud}
  mcp.vscode.json          # NUEVO
  skills/<id>/SKILL.md
  LICENSE
  UPSTREAM.md
```

### 4.1 `mcp.vscode.json`

```jsonc
{
  "prerequisites": ["uv", "aws"],               // subconjunto de: node | uv | docker | az | aws
  "inputs": [
    { "id": "sdd_aws_profile", "type": "promptString", "description": "Perfil AWS", "default": "default" },
    { "id": "sdd_aws_region",  "type": "promptString", "description": "Región AWS", "default": "us-east-1" }
  ],
  "servers": {
    "sdd-aws": { "type": "stdio", "command": "uvx", "args": ["…@1.5.6"], "env": { "…": "…" } }
  },
  "approxTools": { "sdd-aws": 2 },
  "beta": false,
  "operate": {
    "servers": { "sdd-aws": { "…entrada completa en modo Operar…": "" } },
    "warning": "Copilot podrá crear, modificar o borrar recursos de AWS con tus credenciales. Cada cambio pedirá confirmación."
  }
}
```

**Reglas de validación** (en `build:catalog` y al cargar el catálogo):

1. Los nombres de servidor cumplen `^sdd-[a-z0-9-]+$`, y los ids de input `^sdd_[a-z0-9_]+$`.
2. `type` ∈ `stdio | http`. Si es `http`, la `url` debe ser `https://`.
3. Paquetes fijados: ningún argumento contiene `@latest`. Si `command` es `npx` o `uvx`, el primer argumento que no empieza por `-` es el paquete y debe terminar en `@<semver>` (se admiten prereleases, como `3.0.0-beta.48`).
4. Sin secretos literales: se rechaza cualquier valor de `headers`, `env` o `args` que contenga `ghp_`, `gho_`, `github_pat_`, `AKIA`, `xox` o `Bearer ` no seguido de `${input:`. Las credenciales solo pueden llegar por `${input:sdd_…}` u OAuth.
5. `operate.servers` tiene exactamente las mismas claves que `servers`, y `operate.warning` no está vacío.
6. Todo `${input:x}` usado está declarado en `inputs`, y todo input declarado se usa.
7. Cada servidor tiene `approxTools`, un entero mayor que 0.

`operate` lleva la **entrada completa**, no un parche, para que el hash y la comparación sean triviales.

## 5. Catálogo generado

- `CatalogPower` gana el campo opcional `mcp?: McpSpec`, con el contenido de `mcp.vscode.json` ya validado. `sha256` cubre también ese archivo, porque entra en `files` del hash pero **no** se copia al skill.
- **Catálogo v2:** `Catalog.schemaVersion` admite `2`. `build:catalog` genera:
  - `dist/catalog.json`, con `schemaVersion: 2` y todos los Powers, para el VSIX;
  - en el sitio, `powers/catalog-v2.json` con todos los Powers, y `powers/catalog.json` con `schemaVersion: 1` y **solo los Powers sin MCP**, para que v0.4.0 siga funcionando.
- `CATALOG_URL` pasa a `…/powers/catalog-v2.json`.
- `validateCatalog` acepta 1 y 2. Un Power con `mcp` dentro de un catálogo v1 es inválido.

## 6. Extensión

### 6.1 Módulos nuevos (`src/powers/mcp/`)

| Archivo | Qué hace | Puro |
|---|---|---|
| `spec.ts` | Tipos `McpSpec`, `McpServer`, `McpInput`, `McpMode = 'readOnly' \| 'operate'`; `validateMcpSpec(x): McpSpec` | sí |
| `mcpJson.ts` | Opera sobre el texto JSONC de `.vscode/mcp.json` con `jsonc-parser` (`modify` + `applyEdits`): `addEntries(text, servers, inputs)`, `removeEntries(text, names, inputIds)`, `readEntries(text, names)`, `entryHash(server)`. Conserva comentarios, formato y entradas ajenas | sí |
| `policy.ts` | `mcpPolicyState(env): 'allowed' \| 'registryOnly' \| 'blocked'`, con `reason` | sí |
| `prereqs.ts` | `findOnPath(cmd): Promise<boolean>` (capa fina, sin ejecutar nada; solo busca el ejecutable en el PATH) | no |

Cambios en módulos existentes:

- `types.ts`: categorías `devcore`, `docs` y `cloud` (etiquetas "Dev core", "Documentación", "Cloud"), y `CatalogPower.mcp?`.
- `catalog.ts`: soporte del v2 y llamada a `validateMcpSpec`.
- `lock.ts`: lock v2 (sección 6.2).
- `installer.ts`: activar, actualizar, desactivar y el nuevo `setMode` con la parte MCP (sección 6.3).
- `powersService.ts` y `commands.ts`: comando `sdd.setPowerMode` y estado de política.
- `render/*`: distintivo, filtro, franja MCP en el póster, selector de modo y estado bloqueado.
- `src/doctor/checks.ts` y `doctor.ts`: chequeos MCP (sección 7).

### 6.2 Lock v2 (`.github/powers.lock.json`)

```json
{
  "schemaVersion": 2,
  "powers": {
    "aws": {
      "version": "1.0.0", "skillName": "aws", "sha256": "…", "files": ["SKILL.md"], "installedAt": "…",
      "mcp": {
        "mode": "readOnly",
        "servers": { "sdd-aws": "<entryHash>" },
        "inputs": ["sdd_aws_profile", "sdd_aws_region"],
        "createdFile": false
      }
    }
  }
}
```

- Se lee el v1 y el v2. Se escribe el v2 **solo si** hay al menos un Power con `mcp`; si no, se mantiene el v1 para no molestar a quien siga en v0.4.0.
- Un lock v2 hace que v0.4.0 muestre su error de formato. Es lo correcto, porque esa versión no sabría desactivar los servidores. El README indica que hay que actualizar a v0.5.0.
- `createdFile: true` significa que fuimos nosotros quienes creamos `.vscode/mcp.json`.

### 6.3 Flujos

**Activar** (Power con `mcp`):

1. Comprobar la política (sección 7). Si está `blocked`, se lanza `MCP_BLOCKED` y no se escribe nada.
2. Leer `.vscode/mcp.json`, o tratarlo como vacío si no existe. Si no es JSONC válido, se lanza `MCP_FILE_INVALID` y se abre el archivo.
3. Si ya existe un `sdd-x` que no está en el lock, se lanza `MCP_NAME_CONFLICT`.
4. Confirmación modal con:
   - los servidores que se añaden;
   - cuáles **ejecutan código local** (stdio), con su comando;
   - los prerrequisitos que faltan, con enlace de instalación (avisan, no bloquean);
   - si la versión es beta.
5. Escribir el skill, luego `mcp.json` (servidores en modo `readOnly` más los `inputs` que aún no estén) y luego el lock. Si algo falla, se deshace todo (el mismo rollback de hoy, ampliado a `mcp.json`).
6. Notificación: *"Listo. VS Code te pedirá confiar e iniciar el servidor"*, con el botón **Ver servidores MCP** (comando `workbench.mcp.listServer`, o el que exista; se verifica en el spike).

**Actualizar:** para cada servidor nuestro, se compara `entryHash` del archivo con el lock.

- Si no coinciden, se lanza `MCP_EDITED` y se pide confirmación antes de sobrescribir.
- Se reescribe la entrada **en el modo actual**, y se actualizan los `inputs` (se añaden los nuevos y se quitan los que dejaron de usarse).

**Cambiar modo** (`setMode(folder, id, mode)`): solo para Powers con `operate`.

- Pasar a *Operar* exige confirmar el `warning`.
- Se aplica la misma comprobación de `MCP_EDITED`. Después se reescriben las entradas y el lock.
- El modo vive en `.vscode/mcp.json`, así que **es del repo** y se revisa en el PR.

**Desactivar:**

- Se quitan nuestras entradas, después de confirmar si alguna fue editada.
- Se quitan los `inputs` del Power que ningún otro Power activo usa.
- Si `createdFile` es `true` y no queda ningún servidor ni input, se borra `.vscode/mcp.json`. Si no, se deja con `{"servers":{}}` o con lo que quede.
- Al final se quitan el skill y la entrada del lock.

### 6.4 Errores

| Código `PowerError` | Cuándo | Mensaje (resumen) |
|---|---|---|
| `MCP_BLOCKED` | La política impide MCP | "Tu organización bloquea los servidores MCP (…). Ver diagnóstico." |
| `MCP_FILE_INVALID` | `.vscode/mcp.json` no se puede parsear | "Corrige `.vscode/mcp.json` y reintenta." Se abre el archivo |
| `MCP_NAME_CONFLICT` | Ya hay un `sdd-x` ajeno | "Ya existe un servidor `sdd-x` que no instaló SDD Studio." |
| `MCP_EDITED` | El hash no coincide al actualizar, cambiar modo o desactivar | Confirmación: "Sobrescribir / Cancelar" |

### 6.5 Galería y póster

- Distintivo **🔌 MCP** en la tarjeta y chip de filtro **Con MCP**. Las categorías nuevas aparecen en orden: Dev core, Documentación, Cloud.
- **Franja MCP del póster:** servidores, *local* (ejecuta código en tu máquina) o *remoto*, prerrequisitos, credenciales y "beta" si aplica.
- Power activo con `operate`: selector **Solo lectura ▾ / Operar**, con el modo actual resaltado (*Operar* en tono `warn`).
- Política `blocked`: botón **🔒 Bloqueado por tu organización**, deshabilitado, con un *tooltip* que da la razón y enlaza al diagnóstico.
- La página `/powers/` y `/powers/<id>.html` muestran el distintivo, la franja y una sección **"Cómo usarlo"** (sin selector ni estado).

### 6.6 Agentes `sdd-*`

Si el spike (sección 9.1) confirma que listar en `tools` un servidor no instalado **no produce errores ni avisos molestos**, se añade al front matter:

| Agente | Herramientas MCP |
|---|---|
| `sdd-requirements` | `sdd-github/*`, `sdd-context7/*`, `sdd-mslearn/*`, `sdd-awsdocs/*` |
| `sdd-design` | `sdd-github/*`, `sdd-context7/*`, `sdd-mslearn/*`, `sdd-awsdocs/*`, `sdd-aws/*`, `sdd-azure/*` |
| `sdd-implement` | todos los anteriores más `sdd-playwright/*` |

Si avisa, **plan B**: los agentes no cambian y el README y los skills indican que se usen desde el modo *Agent* normal de Copilot. El test de manifest existente que compara las herramientas con los handoffs se ajusta a la opción elegida.

## 7. Diagnóstico y políticas

Los chequeos son funciones puras en `src/doctor/checks.ts`. `DoctorEnv` gana `mcpAccess`, `workspaceTrusted`, `mcpJsonIgnored`, `prereqs` y `activeMcp` (servidores del lock frente a los presentes en `mcp.json`, con su `approxTools`).

| id | Condición | Severidad | Mensaje / acción |
|---|---|---|---|
| `mcp-policy` | `chat.mcp.access` = `none` | error | Los Powers MCP quedan bloqueados; pide a tu admin habilitar MCP |
| `mcp-policy` | `chat.mcp.access` = `registry` | warning | Solo se permiten servidores del registro de tu organización |
| `mcp-strict` | `strictPluginOnly` | error | La política estricta bloquea `.vscode/mcp.json` |
| `mcp-github-policy` | siempre que haya un Power MCP activo | info en el texto | Si los servidores salen deshabilitados, pide a tu admin que active **MCP servers in Copilot** (enlace a la doc de GitHub) |
| `mcp-prereq-<cmd>` | falta un ejecutable requerido por un Power activo | error | Enlace de instalación (Node, uv, Docker, Azure CLI o AWS CLI) |
| `mcp-trust` | workspace no confiable | warning | Los servidores MCP no arrancan sin confianza |
| `mcp-gitignored` | `.vscode/mcp.json` ignorado por git | warning | Tu equipo no recibirá los servidores |
| `mcp-drift` | un servidor del lock falta en `mcp.json` | warning | Acción **Reparar**: reescribe la entrada desde el catálogo en el modo del lock |
| `mcp-tools` | suma de `approxTools` mayor que 100 | warning | Copilot admite como máximo 128 herramientas por petición; desactiva algún Power o deselecciona herramientas |

`mcpPolicyState` combina `mcp-policy` y `mcp-strict` y lo usan tanto la galería como el instalador. `severity` admite el nuevo valor `'info'`, y `mcp-github-policy` lo usa.

## 8. Sitio y documentación

- **README**, sección nueva **"🔌 Powers con MCP"**:
  - qué son;
  - tabla de los 7 Powers (servidor, local o remoto, prerrequisitos, credenciales, modo);
  - **cómo activarlos**;
  - **cómo cambiar a *Operar*** y qué implica;
  - **un ejemplo de prompt por Power**;
  - qué hacer si tu organización bloquea MCP (diagnóstico y política de GitHub);
  - nota de seguridad: código local, versiones fijadas, secretos.
- **Sección "Cómo usar cada Power":** se añaden los 7.
- **Aviso de actualización:** "si alguien de tu equipo activa un Power MCP, todos necesitan v0.5.0".
- **`/powers/`:** distintivos y franja, generados por el mismo renderer.
- **`docs/manual-checklist.md`:**
  - activar GitHub y Context7 con la cuenta real;
  - pedir a Copilot algo que los use;
  - cambiar AWS a *Operar* y volver;
  - desactivar y comprobar que `.vscode/mcp.json` queda limpio.
- **Versión 0.5.0** en `package.json`, `site/index.html` (texto de versión y nombre del VSIX) y el lock de npm.

## 9. Pruebas

### 9.1 Spike (primera tarea del plan, manual, con resultado escrito en `docs/follow-ups.md` o en el ledger)

1. Qué hace VS Code 1.140 cuando un `.agent.md` lista `sdd-context7/*` sin ese servidor instalado. Esto decide la sección 6.6.
2. Que `sdd-github` remoto con OAuth funcione con la cuenta Copilot Enterprise del usuario. Si no funciona, se añade un input PAT opcional en otra versión.
3. El id exacto del comando para listar servidores MCP.
4. Medir `approxTools` de cada servidor.

### 9.2 Unitarias (vitest)

- `validateMcpSpec`: cada una de las 7 reglas, en un caso válido y uno inválido.
- `mcpJson`:
  - añadir a un archivo vacío, inexistente o con comentarios y servidores ajenos (se conservan intactos);
  - quitar;
  - conflicto de nombres;
  - JSONC inválido;
  - el hash es estable aunque cambie el orden de las claves.
- Lock: leer v1 y v2; escribir v1 si no hay MCP y v2 si lo hay.
- Instalador (con el sistema de archivos en memoria que ya usan los tests):
  - activar, actualizar, cambiar modo y desactivar;
  - rollback cuando falla la escritura de `mcp.json`;
  - `MCP_EDITED`;
  - `inputs` compartidos;
  - `createdFile`.
- `checks.ts`: cada fila de la tabla de la sección 7.
- Catálogo: v1 y v2; un Power con `mcp` en el v1 se rechaza; `build:catalog -- --check` cubre `mcp.vscode.json`.
- Render: distintivo, franja, selector y estado bloqueado (snapshots de cadena como los actuales).

### 9.3 Integración (VS Code real)

- Activar `microsoft-learn` en un workspace temporal y comprobar `.vscode/mcp.json` y el lock.
- Cambiar `aws` a *Operar* y volver.
- Desactivar.
- Con `chat.mcp.access = none` en la configuración del test, comprobar que activar devuelve `MCP_BLOCKED`.

### 9.4 CI

- Sin cambios de workflow: `build:catalog -- --check` y `build:site` ya corren en CI.
- `build:site` debe producir `powers/catalog.json` (v1) y `powers/catalog-v2.json`.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| La política de GitHub viene apagada en Enterprise y los servidores salen deshabilitados | Texto guía en el diagnóstico y el README |
| Un servidor stdio ejecuta código arbitrario | Modal explícito, versiones fijadas, Workspace Trust de VS Code |
| Azure en beta | Marcado como beta y versión exacta |
| Pasar de 128 herramientas | `X-MCP-Toolsets` en GitHub, `approxTools` y aviso |
| Un compañero con v0.4.0 | Catálogo v1 sin Powers MCP; un lock v2 da error claro; nota en el README |
| Editar `mcp.json` a mano | Hash por entrada y `MCP_EDITED` |
