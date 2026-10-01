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
