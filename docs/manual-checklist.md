# Checklist manual (antes de cada release)

Abrir `examples/todo-app` en una ventana con el `.vsix` instalado y Copilot con sesión iniciada.

- [ ] El Diagnóstico dice "todo listo" (o solo avisos esperados).
- [ ] La primera activación pregunta una vez por el tema; "Activar" aplica SDD Studio Dark.
- [ ] Nuevo spec → se abre Copilot con `sdd-spec` y la caja vacía; al escribir la idea aparece la tarjeta Funcionalidad / Bug / Quick Spec.
- [ ] Quick Spec → corren los subagentes requisitos → diseño → tareas y `tasks.md` queda aprobado con "▶ Ejecutar tarea".
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

## Powers (v0.3.0)
- [ ] El icono de la barra lateral es el rayo ⚡ y el Marketplace muestra el icono PNG de Speccy.
- [ ] Panel ⚡ → Powers → "Abrir galería…" abre la pestaña con Speccy, filtros y 10 tarjetas.
- [ ] "Ver detalle" muestra el póster (chips, diagrama, beneficios, origen) y "← Volver" regresa.
- [ ] "+ Activar en este repo" en TDD crea `.github/skills/tdd/` y `.github/powers.lock.json`; la tarjeta pasa a "✓ Activo".
- [ ] Con TDD activo, pedir a Copilot "implementa X" hace que escriba el test primero (el skill se carga).
- [ ] Editar a mano `.github/skills/tdd/SKILL.md` y forzar una actualización pregunta antes de sobrescribir.
- [ ] "Desactivar" borra solo los archivos del Power (y pregunta si los editaste).
- [ ] En un workspace no confiable, "+ Activar" y "Actualizar" no hacen cambios (aviso de confianza).
- [ ] En un workspace con varias carpetas, activar un Power pregunta en qué carpeta.
- [ ] /grill-me y /poteto-mode se invocan explícitamente (no se cargan solos).
- [ ] "Buscar actualizaciones" sin red muestra un aviso y la galería sigue funcionando.
- [ ] La página https://enriquecordero.github.io/sdd-studio/powers/ muestra las mismas tarjetas y cada detalle.

## Agentes reforzados (v0.4.0)
- [ ] Un spec nuevo incluye "Fuera de alcance", enfoques con recomendación en el diseño y tareas con Archivos/Interfaces/Verificación; sdd-implement termina con "Estado:".

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
- [ ] AWS en **Operar**: al pedir un cambio, el servidor pide confirmación (requiere que VS Code soporte *elicitation* MCP); si no la pide, anótalo en docs/follow-ups.md.
