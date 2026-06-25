# Goal-mode autonomy

Daneel treats swarm and council behavior as internal abilities of `/goal` mode.

They are not separate user-facing slash commands. They are not provider settings. They are not model-picker modes.

## Swarms

A running goal may spawn small internal swarms when deterministic session signals indicate the main agent needs help.

Initial triggers:

- first goal work has started
- the goal has run for several message cycles
- an assistant/model error appeared
- recent output suggests blockage or drift
- there is no pending subtask already running

Swarms are advisory and corrective. They look for missing work, unsafe assumptions, skipped checks, drift from the goal, and next concrete actions.

Swarms do not decide final completion.

## Model selection

Goal swarms prefer the active main model first. That keeps the swarm aligned with the chosen session agent.

When configured, Daneel can add cheap/coding providers after the main model:

- `stepfun-step-plan/step-3.7-flash`
- `streamlake-kat-coding-plan/kat-coder-pro-v2`
- `deepseek-direct/deepseek-v4-flash`

The selector deduplicates the main model if it already matches one of these candidates.

## Council

The council is similar to a swarm, but its timing is different.

It only appears after the main goal criteria check passes. The main agent must emit:

```text
DANEEL_GOAL_CRITERIA_PASSED: true
```

After that, the council becomes the final completion judge. It tries to prove the goal is not actually done by reviewing evidence, tests, diffs, skipped checks, assumptions, and remaining risks.

Final completion requires:

```text
DANEEL_COUNCIL_APPROVED: true
```

If the council rejects completion, goal mode must continue with the council's required next actions.

## Runtime contract

The policy primitive lives in:

```text
packages/opencode/src/session/goal-autonomy.ts
```

It defines:

- durable session metadata shape under `daneel.goal`
- internal-only command constants
- user-visible command denylist as an empty array
- deterministic swarm triggers
- council trigger after main criteria approval
- preferred cheap/coding model selection
- approval/rejection marker parsing

The command template in:

```text
packages/opencode/src/command/template/goal.txt
```

carries the same contract for the main agent until the remaining session loop wiring is complete.
