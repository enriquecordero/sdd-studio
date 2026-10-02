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
