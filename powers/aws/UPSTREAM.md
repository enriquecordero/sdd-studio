# Origen

- Skill: escrito por SDD Studio para este Power (MIT, ver LICENSE).
- Servidor MCP: AWS API MCP Server, de AWS Labs — https://github.com/awslabs/mcp/tree/main/src/aws-api-mcp-server
- Licencia del servidor: Apache-2.0
- Conexión: proceso local con `uvx awslabs.aws-api-mcp-server@1.5.6` (versión fijada). Solo lectura: `READ_OPERATIONS_ONLY=true`; modo Operar: `REQUIRE_MUTATION_CONSENT=true`. Perfil y región llegan como `inputs` de VS Code
- Configuración verificada el 2026-10-01

## Qué se redistribuye
Nada del servidor: solo su configuración en `mcp.vscode.json` (servidor `sdd-aws`). El servidor lo sirve o lo publica su autor.
