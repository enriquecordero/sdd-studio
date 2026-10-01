---
name: grill-me
description: Interview the user relentlessly about a plan or design, one question at a time, until every branch of the decision tree is resolved. Use when the user wants to stress-test a plan or says "grill me". En español: "cuestiona mi plan", "revisa mi plan a fondo", "hazme preguntas difíciles", "grill me".
disable-model-invocation: true
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Go branch by branch, **one question at a time**. Pick the next decision whose prerequisites are already settled, ask it, give your recommended answer, then wait for the user's reply before moving on. Ask with `vscode/askQuestions` when it is available; otherwise ask in plain text, still one question at a time.

Format a question like so:

```
❓ **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each answer reshapes the tree: settled decisions unblock the questions that depended on them. A question whose answer depends on another question still open belongs later, not now.

Finding _facts_ is your job, never the user's. When a question needs a fact from the environment (filesystem, tools, etc.), look it up yourself with `read`, `search` or `execute`, or hand it to `agent/runSubagent`; don't ask the user for anything you could look up yourself. The _decisions_ are the user's: put each to them and wait.

The session is done when every branch of the design tree has been visited and nothing is left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
