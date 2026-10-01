# SDD Studio

Spec-Driven Development estilo Kiro para VS Code, con GitHub Copilot.

## Instalar
1. Descarga `sdd-studio-<versión>.vsix` del último [Release](https://github.com/enriquecordero/sdd-studio/releases).
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
