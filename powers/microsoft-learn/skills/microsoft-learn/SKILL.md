---
name: microsoft-learn
description: Search and read official Microsoft documentation (Azure, .NET, Microsoft 365, Windows, Power Platform) and official code samples through the sdd-mslearn MCP server, and cite the pages. Use before writing code or infrastructure against Microsoft APIs, or when the user asks how something works in Azure or .NET. En español: "según Microsoft Learn", "¿cómo se hace en Azure…?", "doc oficial de .NET", "ejemplo oficial de Microsoft", "busca en la documentación de Microsoft".
---

# Microsoft Learn: official Microsoft docs

This Power adds the `sdd-mslearn` MCP server, Microsoft's remote server for Microsoft Learn. It searches and fetches official documentation and code samples.

## When to use
- Before writing code, Bicep, ARM, Terraform or CLI commands against Azure or other Microsoft services.
- When the user asks how a Microsoft product, SDK or service behaves, or which option is recommended.
- When a design decision should rest on official guidance (limits, quotas, security defaults).

## How
1. Search: call `microsoft_docs_search` with a focused query. Read the snippets and pick the most relevant pages.
2. Read in full when the snippet is not enough: call `microsoft_docs_fetch` with the page URL.
3. For code, call `microsoft_code_sample_search` (add the language when you know it) and adapt the official sample instead of inventing one.
4. Cite: end with a "Sources" list of the learn.microsoft.com URLs you used.

## Rules
- Docs first, code second. Prefer the newest page when several versions exist, and say which version you followed.
- Quote only what you need.
- If the docs do not cover the question, say so instead of guessing.
## If the tools are not available

If no `sdd-mslearn` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-mslearn`, or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
