---
name: playwright-mcp
description: Drive a real headless browser through the sdd-playwright MCP server to check implemented UI behavior in the running app and attach screenshots as evidence. Use after implementing or fixing something visible in a web app, when the user asks to test it in the browser, or before claiming a UI task is done. En español: "pruébalo en el navegador", "verifica la pantalla", "haz una captura", "comprueba que funciona en la app", "mira la consola del navegador".
---

# Playwright: verify in a real browser

This Power adds the `sdd-playwright` MCP server (Microsoft Playwright MCP). It runs locally through `npx` in a headless, isolated browser (a fresh profile in memory, without the user's cookies).

## When to use
- After implementing or fixing anything visible in a web app, before saying it works.
- When acceptance criteria describe UI behavior ("shows an error", "redirects to…").
- When the user reports a UI bug: reproduce it first.

## How
1. Make sure the app is running (ask the user or start the dev server if your tools allow it) and know its local URL.
2. Navigate with `browser_navigate`, read the page with `browser_snapshot` (accessibility tree), interact with `browser_click`, `browser_type` and friends.
3. Check each acceptance criterion you are verifying, one by one.
4. Capture evidence with `browser_take_screenshot` at the key states, and read `browser_console_messages` for errors.
5. Report: criterion → what you did → what you saw (with the screenshot). This is the evidence the `verification` Power asks for.

## Rules
- Only open local or test URLs unless the user asks otherwise. Never type real passwords or secrets into pages.
- A screenshot proves what it shows, nothing more: say what you did not check.
- If behavior is wrong, report it with the evidence before changing code.

## If the tools are not available

If no `sdd-playwright` tools show up, or a call fails because the server is not running:
- Say so plainly. Do not invent results, and do not answer from memory as if you had used the server.
- Tell the user how to fix it: open the MCP servers list in VS Code and start (and trust) `sdd-playwright` (it needs Node.js; the first start downloads the package), or run **SDD Studio: Diagnóstico** to see what is missing (organization policy, prerequisites, workspace trust).
- Then continue only with what you can verify, and label anything unverified as such.
