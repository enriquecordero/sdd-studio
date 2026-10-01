# SDD Studio — Spec 2: Powers

- **Fecha:** 2026-10-01
- **Estado:** borrador para revisión
- **Versión objetivo:** v0.3.0
- **Depende de:** Spec 1 (`docs/spec.md`), ya publicado como v0.2.1.

## 1. Objetivo

Ofrecer en SDD Studio una galería de **Powers**: skills populares de la comunidad, adaptados a GitHub Copilot y presentados al estilo de Kiro, con una infografía por Power. El dev los activa en su repo con un clic, y la misma galería se publica en la GitHub Page del proyecto.

**Éxito significa:**

- Desde VS Code, un dev abre la galería, entiende con la infografía qué hace cada Power y lo activa. El skill queda en `.github/skills/` del repo y Copilot lo usa.
- El equipo recibe los Powers activos por git, sin pasos extra.
- La página `/powers` muestra exactamente las mismas tarjetas y pósteres que VS Code.
- Todo funciona sin internet. La actualización online es opcional y solo ocurre cuando el dev la pide.

### Decisiones del usuario

| Tema | Decisión |
|---|---|
| Catálogo inicial | Selección curada de unos 10 Powers (sección 3) |
| Granularidad | 1 Power = 1 skill |
| Origen del catálogo | Incluido en el VSIX, con actualización online opcional |
| Infografía | Estilo **B, póster**: chips de activación, diagrama SVG del método, beneficios |
| Ubicación | Dentro del repo `sdd-studio`: carpeta `powers/` y sección `/powers` de la landing |
| Enfoque de UI | **A**: galería en una pestaña del editor, con un renderer compartido con la página |
| Idioma de los skills | Cuerpo del `SKILL.md` en inglés (como el original); `description` con palabras clave en español e inglés; la UI en español |

### Supuestos

- Los Powers de esta versión son **solo skills**: sin MCP, agentes ni hooks.
- Copilot carga los skills del workspace desde `.github/skills/<nombre>/SKILL.md`. Agent Skills está en GA en VS Code 1.140.

## 2. Alcance

**Dentro:**

- La carpeta `powers/` con los 10 Powers adaptados.
- El script de build del catálogo.
- El renderer compartido.
- La galería en una pestaña del editor.
- La sección Powers del panel ⚡.
- Activar, actualizar y desactivar con lockfile.
- La actualización online manual.
- La página `/powers`.
- La publicación de la página con GitHub Actions.
- El guardián de skills en CI.

**Fuera de esta versión:**

- Powers con MCP (llegan con la fase MCP).
- Paquetes de varios skills.
- Instalación a nivel de usuario (`~/.copilot/skills`).
- Actualización automática sin intervención del usuario.
- Powers privados de la empresa.
- El formato legado `POWER.md` de Kiro.
- Crear Powers desde la UI.

## 3. Catálogo inicial

| id | Power | Origen | Categoría | Diagrama |
|---|---|---|---|---|
| `tdd` | 🧪 TDD | mattpocock/skills | Testing | `cycle` |
| `systematic-debugging` | 🐞 Debugging sistemático | obra/superpowers | Debugging | `funnel` |
| `verification` | ✅ Verificación | obra/superpowers (verification-before-completion) | Testing | `steps` |
| `grill-me` | 🔥 Grill Me | mattpocock/skills | Planificación | `steps` |
| `domain-modeling` | 🧭 Domain Modeling | mattpocock/skills | Arquitectura | `split` |
| `code-review` | 🔍 Code Review | mattpocock/skills | Testing | `split` |
| `codebase-design` | 🧱 Codebase Design | mattpocock/skills | Arquitectura | `steps` |
| `prototype` | 🧪 Prototype | mattpocock/skills | Planificación | `steps` |
| `research` | 📚 Research | mattpocock/skills | Investigación | `steps` |
| `poteto-mode` | 🥔 Poteto Mode | cursor/plugins → pstack (Lauren Tan) | Modos | `steps` |

Las tres fuentes tienen licencia MIT. El commit exacto de origen se fija al adaptar cada Power y queda en su `UPSTREAM.md`.

## 4. Estructura en el repo

```
powers/
  <id>/
    plugin.json            Agent Plugins 1.0
    presentation.json      datos de tarjeta y póster
    skills/<id>/SKILL.md   skill adaptado (+ archivos de apoyo: references/, scripts/)
    LICENSE                licencia original con el copyright del autor
    UPSTREAM.md            repo, ruta, commit de origen y lista de cambios de la adaptación
scripts/
  build-catalog.mjs        valida powers/ y genera el catálogo
  build-site.mjs           genera la web (landing + /powers) en _site/
site/
  index.html               landing (se mueve aquí desde la rama gh-pages)
src/powers/                código de la extensión (sección 6)
```

### 4.1 `plugin.json`

Sigue el esquema `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.

| Campo | Contenido |
|---|---|
| `name` | Igual al `id` |
| `version` | semver |
| `description` | Texto descriptivo |
| `author` | `name` y `url` |
| `license` | Licencia del origen |
| `keywords` | Palabras clave |
| `repository` | Repo de origen |

### 4.2 `presentation.json`

```json
{
  "displayName": "TDD",
  "icon": "🧪",
  "category": "testing",
  "summary": "Rojo → verde → refactor, con tests de integración primero.",
  "triggers": ["\"implementa…\"", "\"arregla el bug…\"", "/tdd"],
  "diagram": {
    "kind": "cycle",
    "nodes": [
      { "label": "ROJO", "tone": "red", "edge": "código mínimo" },
      { "label": "VERDE", "tone": "green", "edge": "limpiar" },
      { "label": "REFACTOR", "tone": "blue", "edge": "nuevo test" }
    ]
  },
  "gets": ["Cada cambio con su test", "Diseño guiado por el uso real", "Refactors sin miedo"],
  "source": {
    "repo": "mattpocock/skills",
    "path": "<ruta>",
    "commit": "<sha>",
    "author": "Matt Pocock",
    "license": "MIT"
  }
}
```

| Campo | Valores |
|---|---|
| `category` | `planning`, `testing`, `debugging`, `architecture`, `research`, `modes` |
| `diagram.kind` | `cycle` (3–5 nodos), `steps` (2–6), `funnel` (2–5) o `split` (exactamente 2 columnas, cada una con `label` e `items[]`) |
| `tone` | `red`, `green`, `blue`, `accent`, `warn` |
| `edge` | Etiqueta de la flecha que sale del nodo. Es opcional. |

### 4.3 `SKILL.md`

- Front matter con `name`, igual a la carpeta y de 64 caracteres como máximo.
- `description` de 1024 caracteres como máximo, con disparadores en español y en inglés.
- El cuerpo en inglés.

## 5. Catálogo generado

`scripts/build-catalog.mjs` recorre `powers/`, valida y escribe `catalog.json`. Este archivo **no se commitea**. Se genera en el build del VSIX (`vscode:prepublish`) y en el workflow de la página.

```json
{
  "schemaVersion": 1,
  "generatedAt": "<ISO-8601>",
  "powers": [
    {
      "id": "tdd",
      "version": "1.0.0",
      "presentation": { "...": "..." },
      "skillName": "tdd",
      "files": { "SKILL.md": "<contenido>", "references/x.md": "<contenido>" },
      "sha256": "<hash del conjunto de archivos>"
    }
  ]
}
```

**El script falla si:**

- falta un campo obligatorio, o un valor no está en su enumeración;
- falta `LICENSE` o `UPSTREAM.md`;
- el `name` del `SKILL.md` no coincide con su carpeta, o la `description` supera los 1024 caracteres;
- algún archivo del skill contiene un término de la lista prohibida: `TodoWrite`, `Task tool`, `AskUserQuestion`, `mcp__`, `Skill tool`, `Cursor` como herramienta, o nombres de modelos concretos.

Con la opción `--check` solo valida, sin escribir. La usa el CI.

**El hash** `sha256` se calcula sobre los archivos ordenados por ruta, cada uno como `ruta\0contenido\0`.

## 6. Extensión

### 6.1 Módulos (`src/powers/`)

| Módulo | Responsabilidad |
|---|---|
| `catalog.ts` (puro) | Tipos del catálogo, validación de un `catalog.json` y `newestCatalog(bundled, cached)` por `generatedAt` |
| `lock.ts` (puro) | Modelo de `.github/powers.lock.json` y operaciones puras: añadir, quitar, consultar |
| `hash.ts` (puro) | El hash de la sección 5 (el mismo algoritmo que el script) |
| `render/` (puro) | `escapeHtml`, `renderCard`, `renderPoster`, `renderDiagram` y `powers.css` |
| `catalogSource.ts` | Carga el catálogo incluido (`dist/catalog.json`) y el descargado (`globalStorageUri/catalog.json`); `refreshOnline(fetcher)` |
| `installer.ts` | `activate`, `update` y `deactivate` sobre una carpeta del workspace |
| `galleryPanel.ts` | Pestaña "⚡ Powers" (WebviewPanel, un único panel abierto a la vez) |

### 6.2 Lockfile `.github/powers.lock.json`

```json
{
  "schemaVersion": 1,
  "powers": {
    "tdd": {
      "version": "1.0.0",
      "skillName": "tdd",
      "sha256": "<hash>",
      "files": ["SKILL.md"],
      "installedAt": "<ISO>"
    }
  }
}
```

El lockfile se commitea con el repo.

### 6.3 Activar, actualizar y desactivar

- **Activar:** escribe cada archivo en `.github/skills/<skillName>/<ruta>` y añade la entrada al lockfile.
  - Si ya existe la carpeta `.github/skills/<skillName>/` y no está en el lockfile, **rechaza** con el mensaje "Ya existe un skill '<nombre>' que no instaló SDD Studio".
- **Actualizar:** está disponible cuando el catálogo trae una versión mayor que la del lockfile.
  - Si el hash de los archivos en disco no coincide con el del lockfile, pregunta **"Sobrescribir / Cancelar"**.
  - Tras escribir, borra los archivos que ya no existen en la versión nueva.
- **Desactivar:** borra solo los archivos listados en el lockfile, borra la carpeta si queda vacía y quita la entrada.
- **Validación de rutas:** toda ruta de archivo se valida. No puede contener `..`, ser absoluta, ni salir de `.github/skills/<skillName>/`.
- **Workspace no confiable:** activar y actualizar quedan desactivados.
- **Workspace con varias carpetas:** pregunta en qué carpeta. El tree pasa la carpeta como argumento.

### 6.4 Actualización online

- Solo ocurre con el comando "SDD Studio: Buscar actualizaciones de Powers" o el botón equivalente. No hay ninguna llamada de red automática.
- Descarga `https://enriquecordero.github.io/sdd-studio/powers/catalog.json` con un tiempo límite de 10 s.
- Si el contenido es válido (`catalog.ts`) y más nuevo que el actual, lo guarda en `globalStorageUri`. Si no, muestra un mensaje claro y sigue usando el catálogo actual.
- El *fetcher* va detrás de una interfaz para poder probarlo.

### 6.5 Galería (pestaña del editor)

- **Vista principal:**
  - Hero con el título "⚡ Powers", un texto corto y chips de categoría. Los filtros y el buscador funcionan en cliente.
  - Secciones "Activos en este repo" y "Recomendados", con tarjetas en cuadrícula.
- **Tarjeta:** icono, nombre, autor y licencia, resumen y botón según el estado:
  - **+ Activar en este repo**;
  - **✓ Activo · vX**;
  - **Actualizar a vY**.
- **Detalle:** al hacer clic en una tarjeta se muestra el póster B completo (cabecera, chips "se activa cuando dices", diagrama, "obtienes" y origen con enlace) con los botones de acción.
- **Banner de política:** si la política estricta está activa (la misma lectura que el diagnóstico), se muestra "Tu organización puede impedir que Copilot cargue skills del repo".
- **Comunicación con la extensión:** por mensajes `activate`, `update`, `deactivate`, `openSource` y `refresh`. La extensión responde con el estado nuevo.
- **Seguridad:**
  - CSP `default-src 'none'`, estilos propios y un único script con nonce.
  - Todo el contenido pasa por `escapeHtml`; el SVG se genera desde datos ya escapados.

### 6.6 Panel ⚡: sección Powers

Sustituye al marcador de posición del Spec 1 e incluye:

- "Abrir galería…" y "Buscar actualizaciones".
- Un hijo por cada Power activo, con `<icono> <nombre>` y la versión. Lleva la marca "actualización disponible" cuando corresponde.
- Menú contextual con Actualizar y Desactivar.

### 6.7 Comandos

| Comando | Notas |
|---|---|
| `sddStudio.openPowers` | |
| `sddStudio.checkPowerUpdates` | |
| `sddStudio.activatePower` | Recibe `id` o un nodo del tree. `enablement: isWorkspaceTrusted` |
| `sddStudio.updatePower` | `enablement: isWorkspaceTrusted` |
| `sddStudio.deactivatePower` | |

Los tres últimos se ocultan en la paleta y se usan desde la galería y el tree.

## 7. Página `/powers` y publicación

- **`scripts/build-site.mjs`:**
  - Usa el renderer compilado (bundle de esbuild para Node) y el catálogo.
  - Copia `site/` a `_site/`.
  - Genera `_site/powers/index.html` (cuadrícula, filtros y buscador), `_site/powers/<id>.html` (póster y "Cómo activarlo") y `_site/powers/catalog.json`.
- **"Cómo activarlo"** ofrece dos caminos:
  1. Con SDD Studio: galería → **+ Activar**.
  2. A mano: descargar los archivos del skill (enlaces a GitHub) y copiarlos a `.github/skills/<nombre>/`. Sirve también para Kiro, Cursor o Claude Code.
- **Landing:** la sección "Próximamente: Powers" pasa a ser "⚡ Powers", con un enlace a `/powers/` y las tarjetas reales.
- **Workflow `.github/workflows/pages.yml`:** se ejecuta en cada push a `main` y hace build-catalog, build-site, `actions/upload-pages-artifact` y `actions/deploy-pages`.
- **Migración de GitHub Pages:**
  1. Cambiar el origen de la página de la rama `gh-pages` a "GitHub Actions".
  2. Verificar que la página sigue publicada.
  3. Borrar la rama `gh-pages`.

## 8. CI y release

- **`ci.yml`** añade `npm run build:catalog -- --check` y `npm run build:site`, que comprueba que la web se genera sin errores.
- **`vscode:prepublish`** genera el catálogo antes del bundle, y `.vscodeignore` incluye `dist/catalog.json` en el VSIX.
- **Release:** `v0.3.0` con el mismo workflow de tags.

## 9. Adaptación de cada skill

Para cada Power:

1. Tomar el `SKILL.md` y sus archivos de apoyo en un commit fijo.
2. Sustituir las herramientas o conceptos de Claude Code o Cursor por sus equivalentes en Copilot:

   | Original | Copilot |
   |---|---|
   | `TodoWrite` | `todos` o una checklist en la respuesta |
   | `Task` / subagentes | `agent/runSubagent` |
   | `AskUserQuestion` | `vscode/askQuestions` |
   | Leer, buscar, editar, ejecutar | `read`, `search`, `edit`, `execute` |

3. Quitar las referencias a skills que no se incluyen, o integrar lo esencial en el texto.
4. Conservar la voz y la estructura del autor.
5. Escribir una `description` con disparadores en español y en inglés.
6. Anotar en `UPSTREAM.md` el repo, la ruta, el commit, la fecha y la lista de cambios.

**Poteto Mode** se condensa en un `SKILL.md` con los principios y playbooks clave, más `references/principles.md`. `UPSTREAM.md` lista los skills hermanos de pstack que se dejaron fuera.

## 10. Pruebas

| Capa | Herramienta | Qué cubre |
|---|---|---|
| `catalog.ts`, `lock.ts`, `hash.ts` | vitest | Validación (válido, faltantes, enum inválido, rutas peligrosas), `newestCatalog`, operaciones del lock, hash estable e igual al del script |
| `render/` | vitest | Escapado de `<script>` y comillas; los 4 tipos de diagrama generan SVG con el número correcto de nodos y etiquetas; tarjeta y póster contienen nombre, chips, beneficios y licencia |
| `build-catalog.mjs` | vitest sobre una carpeta de prueba | Genera el catálogo; falla con mensaje claro ante cada regla de la sección 5, incluidos los términos prohibidos |
| Los 10 Powers reales | `build:catalog --check` en CI | Todos pasan el guardián |
| `installer`, `catalogSource`, tree | `@vscode/test-electron` | Ver la lista a continuación |
| Manual | `docs/manual-checklist.md` | Aspecto de la galería y de `/powers`; que Copilot cargue el skill activado. Por ejemplo, con TDD activo, "implementa X" escribe el test primero. |

**Casos de integración:**

- Activar escribe los archivos y el lockfile.
- Se rechaza un skill ajeno con el mismo nombre.
- Actualizar con un archivo editado a mano pregunta; la respuesta se inyecta en el test.
- Desactivar borra solo lo suyo.
- Una ruta con `..` en el catálogo se rechaza.
- La sección Powers del panel lista los activos.
- En un workspace no confiable, activar no hace nada.
- Actualización online con un *fetcher* falso: catálogo válido y nuevo, catálogo inválido, error de red y tiempo agotado.

## 11. Riesgos

- **Comportamiento real de Copilot:** que cargue los skills de `.github/skills/` según la `description`, sobre todo con descripciones bilingües. Se verifica en la checklist manual. Si no carga bien, se ajustan las descripciones; no hace falta tocar código.
- **Política estricta de la empresa:** puede bloquear los skills del workspace. Está cubierto con el banner y el diagnóstico.
- **Fidelidad de las adaptaciones:** cada `UPSTREAM.md` documenta los cambios, y el guardián detecta restos sin adaptar.
