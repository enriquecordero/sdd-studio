---
name: context7
description: Look up current, version-specific documentation for libraries, frameworks and SDKs through the sdd-context7 MCP server before writing code against them, and cite the source. Use when code depends on a third-party library, the user names a version, or you are unsure an API still exists. En español: "¿cómo se usa la librería…?", "según la documentación de…", "usa context7", "doc actualizada", "consulta la doc antes de programar".
---

# Context7: live library docs

This Power adds the `sdd-context7` MCP server (Context7, by Upstash). It returns up-to-date, version-specific documentation and code examples for public libraries and frameworks.

## When to use
- Before writing or changing code that calls a third-party library, framework or SDK.
- When the user names a version ("Next.js 15", "pydantic v2") or the project pins one.
- When you are not sure an API, option or import path still exists.

## How
1. Find the library: call the `resolve-library-id` tool of `sdd-context7` with the library name. Pick the match whose name and description fit; prefer the project's pinned version when one is offered.
2. Read the docs: call `query-docs` with that id and a focused question (the exact API, option or task).
3. Write the code from what the docs say, not from memory. If the docs and your memory disagree, the docs win; say so.
4. Cite: end your answer with a short "Sources" line naming the library id (and version) you used.

## Rules
- Docs first, code second. One focused lookup beats several vague ones.
- Quote only the lines you need; do not paste whole pages.
- If Context7 has no entry for the library, say so and fall back to the project's own code or the official site, marked as unverified.

## If the tools are not available

If no `sdd-context7` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-context7`, or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
