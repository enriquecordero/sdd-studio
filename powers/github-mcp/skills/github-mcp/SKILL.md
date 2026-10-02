---
name: github-mcp
description: Read GitHub issues, pull requests, repositories and Actions runs through the sdd-github MCP server to give context to a spec, a design or a fix. Read-only unless the Power is switched to Operate mode and the user asks for a change. Use when the user mentions an issue or PR number, a failing workflow, or wants a spec from an issue. En español: "lee el issue #…", "resume el PR", "¿por qué falla el workflow?", "crea el spec a partir del issue", "contexto de GitHub".
---

# GitHub: issues and PRs as context

This Power adds the `sdd-github` MCP server, GitHub's remote server, limited to the repos, issues, pull_requests and actions toolsets. It signs in with the user's GitHub account through VS Code (OAuth); no token is stored in the repo.

## When to use
- The user gives an issue or PR number or URL: read it (and its comments) before planning.
- Turning an issue into a spec: the issue becomes the source for `requirements` (problem, acceptance hints, links). Quote the issue and link it.
- A CI run failed: read the workflow run and its logs before proposing a fix.
- Reviewing: read the PR description, changed files and review comments.

## How
1. Identify owner/repo from the git remote of the workspace or from the URL the user gave.
2. Use the issue, pull request, repository and Actions tools of `sdd-github` to read exactly what you need; avoid listing whole repositories.
3. Summarize what you read with links, then continue with the task (spec, design, fix).

## Read-only by default
- In the default mode the server only reads. Never try to create, comment, merge or re-run anything.
- Only when the Power is in **Operate** mode *and* the user explicitly asks, you may write (comment, open an issue, create a PR). State exactly what you will do first and do one action at a time.
- Never merge, push to the default branch, or delete files or branches unless the user explicitly asks for that specific action.

## If the tools are not available

If no `sdd-github` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-github` and sign in with GitHub when VS Code asks. If the server shows as disabled, the organization may need to enable the "MCP servers in Copilot" policy, or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
