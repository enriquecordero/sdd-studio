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
- [ ] El icono de la barra lateral es el documento de Speccy y el Marketplace muestra el icono PNG.
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
