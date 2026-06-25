# Daneel

Daneel is an OpenCode fork designed to become a more autonomous, Ubuntu-first, smarter, batteries-included coding harness.

It keeps the terminal-first coding-agent foundation, but the direction is different: stronger autonomous execution, better default provider behavior, more useful debugging artifacts, and less brittle prompt-only behavior.

Daneel is not upstream OpenCode. Some source files, package names, and internals may still carry upstream OpenCode naming while the fork is being cleaned up.

## Install on Ubuntu

Use one command:

```bash
curl -fsSL https://raw.githubusercontent.com/yunusemrejr/Daneel/dev/script/install-ubuntu.sh | bash && install -m 755 "$HOME/.local/share/daneel/src/packages/opencode/bin/daneel-bun" "$HOME/.local/bin/daneel"
```

This installs the required Ubuntu packages, installs Bun if missing, clones or updates the official Daneel repository, compiles the current Linux binary, and exposes the command as:

```bash
daneel
```

The managed source checkout is stored at:

```text
~/.local/share/daneel/src
```

The managed compiled binary is stored at:

```text
~/.local/share/daneel/bin/daneel
```

Make sure `~/.local/bin` is in your `PATH`.

## Updating Daneel

After installing with the Ubuntu command above, update Daneel with:

```bash
daneel update
```

`daneel update` uses the managed Daneel source checkout, points it at `https://github.com/yunusemrejr/Daneel.git`, fetches the configured branch, rebuilds Daneel, and replaces the managed local binary.

Default branch:

```text
dev
```

Update from another branch:

```bash
daneel update my-branch-name
```

## What Daneel is for

Daneel is for developers who want a coding TUI that can keep working through multi-step software tasks with less micromanagement.

The goal is not to make the model reckless. The goal is to make the harness smarter: safer defaults, clearer state, stronger loops, better provider routing, and useful evidence when something fails.

## Core direction

- Autonomous coding workflows without pointless confirmation spam.
- Ubuntu-first local development and terminal usage.
- Batteries-included defaults for agents, providers, debugging, and long sessions.
- Smarter execution loops that keep state instead of forgetting the goal after one turn.
- Better support for subscription and alternative coding-model providers.
- Debuggable session output instead of invisible harness behavior.
- Cache-aware prompting for providers where stable prefixes matter.

## Native commands

Daneel is being built around three native commands.

### `/goal <description>`

Starts persistent goal mode.

A goal is not a normal one-shot prompt. Once active, Daneel should keep working toward the stated objective across turns until the goal is completed or cancelled. Follow-up user messages become additional context for the active goal unless the user starts a new goal.

Goal mode is intended to activate the autonomous execution stack for the duration of the task.

### `/yolo`

Enables autonomous execution mode.

YOLO means Daneel should avoid wasting the user's time with unnecessary confirmation prompts. It should choose the best reasonable path, run safe commands, continue after recoverable failures, and make progress without asking obvious questions.

YOLO does not mean unsafe. Dangerous operations should still be blocked, redirected, sandboxed, or converted into safer alternatives.

### `/loop`

Enables iterative loop mode.

Loop mode is for repair, test-fix, verification, and repeated improvement cycles. Daneel should keep checking its work, rerunning relevant commands, and tightening the result until the loop reaches a stop condition.

## Provider and model behavior

Daneel is designed to work with already configured providers instead of assuming one model is always enough.

Planned and active provider-focused work includes:

- Out-of-the-box StreamLake KAT Coder Plan integration.
- Smart fusion routing that rotates requests between configured providers.
- Provider fallback behavior that avoids killing the task when one provider fails.
- Better handling for coding models, fast verifier models, and long-context reviewers.
- Provider-aware prompting instead of pretending every endpoint behaves exactly like OpenAI.

The smart fusion model is intended to choose and rotate between available providers based on task type, provider health, context size, latency, and configured preferences.

## Autonomous temporary agents

Daneel can resolve unknown `subagent_type` values from the task tool as session-only temporary agent candidates. The runtime still uses a registered agent as the execution shell, but Daneel injects a temporary role prompt, records the virtual and runtime agent names in task metadata, and selects a cost-aware provider/model for the task.

Temporary agent selection is not left only to the main session model. When a different configured model is available, Daneel opens a secondary selector pass that can approve the choice or replace it once. The one-pass replacement budget prevents endless disagreement while still keeping a second model in the decision path.

Cost-aware routing prefers configured cheap/fast models for small verification, summarization, extraction, and boring review work. Current cheap/fast hints include StreamLake KAT Coder plan models, StepFun flash models, and DeepSeek v4 flash. OpenRouter, OpenAI/ChatGPT, Gemini, Claude/Anthropic, and xAI/Grok are treated as last-resort routing classes unless explicitly selected by the user or by a configured agent definition.

## DeepSeek cache-hit optimizations

Daneel includes cache-hit oriented prompt discipline for DeepSeek-style workflows.

The important rule is stable prefix first, volatile task state later. Long-running sessions should avoid destroying cache locality with random timestamps, noisy logs, or constantly reordered context before the stable project and harness instructions.

This matters for repeated review, repair, and verification loops where the same stable context is reused many times.

## JSONL session summaries

Daneel is intended to export JSONL session summaries for debugging and evidence.

These summaries should make it easier to understand what happened during a session: active goal, commands, provider choices, failures, retries, loop state, compacted summaries, and final evidence.

The point is simple: if the harness behaves badly, the session should leave enough structured trace data to debug it.

## Ubuntu-first behavior

Daneel treats Ubuntu as the primary development environment.

That means the default development path should be clean on Ubuntu, local-first, terminal-native, and friendly to normal Linux developer workflows. macOS and other platforms can still matter, but Ubuntu should not feel like an afterthought.

## Development from source

This repository is still close to upstream OpenCode in many places. Expect ongoing rename and cleanup work.

Typical local development commands:

```bash
bun install
bun run dev
```

Useful checks:

```bash
bun run typecheck
bun run lint
```

The final user-facing command should be:

```bash
daneel
```

If a development path still exposes `opencode`, treat that as remaining fork migration work.

## Roadmap

Near-term Daneel work includes:

- Finish replacing upstream OpenCode naming with Daneel naming.
- Harden `/goal`, `/yolo`, and `/loop` as real runtime behavior, not prompt labels.
- Improve StreamLake KAT Coder Plan support.
- Improve DeepSeek cache-hit behavior and metrics.
- Add stronger JSONL session export and debugging reports.
- Expand smart fusion provider routing.
- Improve Ubuntu install and launch flow.
- Add more visible runtime state for goals, loops, providers, and failures.

## Upstream relationship

Daneel is a fork of OpenCode. It benefits from the upstream architecture, but it is moving in a different direction.

The focus of Daneel is autonomous, provider-aware, Ubuntu-first coding work with stronger harness behavior and more batteries included by default.
