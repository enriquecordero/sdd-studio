# Origen

- Skill: escrito por SDD Studio para este Power (MIT, ver LICENSE).
- Inspiración: las ideas de enrutado por tipo de pregunta vienen de los Powers de Kiro (https://github.com/kirodotdev/powers, en especial `cloud-architect`). No se copia contenido: ese repositorio no tiene una licencia abierta.
- Configuración verificada el 2026-10-01

## Servidores MCP

| Servidor | Origen | Licencia | Conexión |
|---|---|---|---|
| `sdd-awsarch-knowledge` | AWS Knowledge MCP Server — https://github.com/awslabs/mcp/tree/main/src/aws-knowledge-mcp-server | Servicio alojado por AWS | Remoto, `https://knowledge-mcp.global.api.aws`, sin credenciales (no tiene versión: se fija la URL) |
| `sdd-awsarch-pricing` | AWS Pricing MCP Server, de AWS Labs — https://github.com/awslabs/mcp/tree/main/src/aws-pricing-mcp-server | Apache-2.0 | `uvx awslabs.aws-pricing-mcp-server@1.1.1` |
| `sdd-awsarch-iac` | AWS IaC MCP Server, de AWS Labs — https://github.com/awslabs/mcp/tree/main/src/aws-iac-mcp-server | Apache-2.0 | `uvx awslabs.aws-iac-mcp-server@1.0.26` |
| `sdd-awsarch-wa` | Well-Architected Security MCP Server, de AWS Labs — https://github.com/awslabs/mcp/tree/main/src/well-architected-security-mcp-server | Apache-2.0 | `uvx awslabs.well-architected-security-mcp-server@0.2.0` |
| `sdd-awsarch-api` | AWS API MCP Server, de AWS Labs — https://github.com/awslabs/mcp/tree/main/src/aws-api-mcp-server | Apache-2.0 | `uvx awslabs.aws-api-mcp-server@1.5.6`. Solo lectura: `READ_OPERATIONS_ONLY=true`; modo Operar: `REQUIRE_MUTATION_CONSENT=true` |

Los servidores locales reciben perfil y región como `inputs` de VS Code (los mismos que el Power AWS). `sdd-awsarch-api` ejecuta el mismo servidor que `sdd-aws` del Power AWS: si activas los dos, el diagnóstico avisa (`mcp-duplicate`).

## Qué se redistribuye
Nada de los servidores: solo su configuración en `mcp.vscode.json`. Cada servidor lo sirve o lo publica su autor.
