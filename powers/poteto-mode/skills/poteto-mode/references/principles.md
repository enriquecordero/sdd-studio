# Principles

Condensed from the principle skills of pstack. Each section gives the core idea and when to apply it. Section titles match the original skill names.

## Laziness Protocol

Aim for the most result with the least code and complexity. Prefer deletion, keep the call hierarchy flat, put each decision behind one source of truth, and make the smallest diff that solves the problem. Apply when refactoring, sizing a diff, or tempted to add abstractions, layers, or signal threading.

## Foundational Thinking

Structural decisions protect option value, code-level decisions protect simplicity. Get the data shape right before writing logic, do scaffold (CI, lint, test infrastructure, shared types) before features, and isolate any state that concurrent actors might both modify. Apply before writing logic: core types and data structures, scaffold-vs-feature sequencing, what concurrent actors share.

## Redesign from First Principles

Don't bolt a change onto the existing design. Ask what you would build from scratch if the requirement had been there from day one, propagate it through every reference (types, docs, examples), and deliver it incrementally. Apply when integrating a new requirement into an existing design.

## Attack the Premise

When two or more fixes that share one premise have failed the same gate, suspect the premise. Write the premise down and take a census of which actors hold the imbalance before the next fix. Apply before the next fix, once failures share an assumption. Remove the asymmetry instead of compensating for it.

## Subtract Before You Add

Adding to a complex system compounds complexity. Remove dead weight first, then build on the simpler base, and leave the design slightly simpler behind the same or a smaller surface. Apply when sequencing an addition, refactor, or rewrite.

## Minimize Reader Load

Maintainability is the work a reader must do to understand code, along two axes: layers to trace and state to hold. Collapse one-caller wrappers and shrink mutable scope. Apply when reviewing or shaping code that is hard to trace.

## Outcome-Oriented Execution

Optimize for the intended, verifiable end state, not for smooth intermediate states. Intermediate breakage is acceptable when it is planned, scoped, and reversible, and correctness is proven at explicit verification boundaries. Apply to planned rewrites and migrations with explicit phase boundaries. Don't preserve throwaway compatibility states.

## Experience First

When implementation convenience conflicts with user delight, choose delight. Justify every feature and option, ship less but better, and prototype before committing. Apply to product, UX, or feature-scope tradeoffs.

## Exhaust the Design Space

When a novel interaction or architectural decision has no precedent, build 2-3 competing prototypes or sketches and compare them side by side before committing. A second flavor of the first shape does not count. Apply to novel UI interactions and architectural choices with several viable approaches.

## Build the Lever

When the work isn't trivial, build the tool that does it (codemod, script, generator, rerunnable check) instead of doing it by hand. The tool is one artifact a reviewer can read and rerun. Do the first unit by hand to learn the recipe. Apply to any non-trivial work. Skip only for a couple of obvious edits.

## Model the Domain

Encode the real domain in a structure instead of scattering it across conditionals: a state machine, a typed model, a table or registry, a reducer, a boundary, the right collection. The right structure makes invalid states unrepresentable and deletes branches. Apply when writing stateful logic, or code that branches a lot or repeats a shape assumption across files.

## Boundary Discipline

Validate, narrow types, and handle errors at system boundaries (CLI args, config, external APIs, network). Trust internal typed code, and keep business logic in pure functions behind a thin, mechanical shell. Apply when wiring validation, error handling, or framework adapters.

## Type System Discipline

The type checker is a proof assistant. Make illegal states unrepresentable (sum types over bags of optional fields), brand primitives, build types up from the values you want, and parse external data at the boundary. Apply when designing types or a signature in any typed language.

## Make Operations Idempotent

Design operations to converge on the correct state however many times they run or wherever they start. Ask what happens if it runs twice and what happens if the previous run crashed halfway. Apply to commands, lifecycle steps, and loops that run amid crashes and retries.

## Migrate Callers Then Delete Legacy APIs

When a new API is the right design, inventory the callers, migrate them, and delete the old API in the same wave. Temporary adapters are exceptional and time-boxed, not default architecture. Apply when introducing a new internal API while old callers exist.

## Separate Before Serializing Shared State

When concurrent actors might write the same state, first ask whether they need the same mutable object. Default to giving each its own file, key, branch, or directory and merge at the read boundary. When sharing is real, enforce serialization structurally (lockfiles, sequential phases), not by instruction. Apply when concurrent actors might write the same file, branch, key, or object.

## Prove It Works

Verify every output by checking the real thing directly. Don't infer from proxies, self-reports, file timestamps, cached screenshots, or "it compiles". Acting on a wrong inference costs far more than checking the source. Apply after a task and before declaring it done.

## Fix Root Causes

Don't fix symptoms. Reproduce first, then ask why until you reach the root cause and fix it there. Workarounds accumulate and make the system harder to reason about. Apply when debugging.

## Sequence Work into Verifiable Units

Order work as small units, each ending in a state you can check, and don't advance until the current one is green. Deliver in the order that proves the work, canonically the failing test first and the fix on top. Apply to multi-step work (sweeps, migrations, runs of similar edits) and to how you stack commits.

## Test Behavior, Not Implementation

Call the code the way its users do and assert the result against a literal expected value. If a test would still pass when every imported function returns `undefined`, it observes no behavior: rewrite the assertion or delete the test. Apply when writing, changing, or keeping a test.

## Guard the Context Window

Context is finite and non-renewable within a session. Route verbose output, screenshots, and large documents to subagents and keep summaries in the main thread. Apply when context fills up: large outputs, long files, repeated reads, fan-out planning.

## Never Block on the Human

The human supervises asynchronously. Make a reasonable decision, proceed, present the result, and let the human course-correct, because reversible work usually costs less to redo than to block on. Apply when tempted to ask "should I do X?" on reversible work.

## Encode Lessons in Structure

Recurring fixes belong in mechanisms (a lint rule, a metadata flag, a runtime check, a script), not in more textual instructions that rely on someone noticing and complying. Apply when you catch yourself writing the same instruction a second time.
