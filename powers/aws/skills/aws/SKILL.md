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
