---
name: aws-docs
description: Search and read the official AWS documentation through the sdd-awsdocs MCP server before writing code, CLI commands or infrastructure for AWS, and cite the pages. Use when the user asks about AWS service behavior, limits, quotas or configuration, or code depends on an AWS API. En español: "según la documentación de AWS", "límites de S3", "cuotas de Lambda", "¿cómo se configura en AWS…?", "doc oficial de AWS".
---

# AWS Docs: official AWS documentation

This Power adds the `sdd-awsdocs` MCP server (AWS Labs). It runs locally through `uvx` and reads the public AWS documentation; it needs no AWS credentials.

## When to use
- Before writing code, CloudFormation, CDK, Terraform or CLI commands for an AWS service.
- When a decision depends on a limit, quota, default or pricing dimension.
- When the user asks how an AWS service behaves.

## How
1. Search: call `search_documentation` with a focused phrase. Pick the most relevant results.
2. Read: call `read_documentation` with the page URL (or `read_sections` for specific sections of a long page).
3. Optionally call `recommend` on a page you read to find related pages (new features, common next steps).
4. Write the code from what the docs say, and end with a "Sources" list of the docs.aws.amazon.com URLs you used.

## Rules
- Docs first, code second. Limits and defaults change: never state one from memory without checking.
- Quote only what you need.
- This server only reads documentation. It cannot see the user's account; for that, the `aws` Power is needed.

## If the tools are not available

If no `sdd-awsdocs` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-awsdocs` (it needs `uv` installed), or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
