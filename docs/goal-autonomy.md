# Goal autonomy

Goal mode owns Daneel swarm and council behavior.

Swarm and council are internal goal-mode mechanisms. They are not separate slash commands and are not user configuration surfaces.

Swarms are used while a goal is running. They help with review, drift detection, missing work, and next actions. Deterministic triggers include first goal work, long-running goal work, model errors, blocked output, and absence of pending subtasks.

The model selector keeps the active main model first. It can then use configured cheap/coding candidates:

- `stepfun-step-plan/step-3.7-flash`
- `streamlake-kat-coding-plan/kat-coder-pro-v2`
- `deepseek-direct/deepseek-v4-flash`

The council runs later. It appears only after the main goal criteria check passes. The main criteria marker is:

```text
DANEEL_GOAL_CRITERIA_PASSED: true
```

The final council approval marker is:

```text
DANEEL_COUNCIL_APPROVED: true
```

The policy primitive lives in:

```text
packages/opencode/src/session/goal-autonomy.ts
```
