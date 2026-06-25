export const GOAL_AUTONOMY_METADATA_KEY = "daneel.goal" as const

export const GOAL_AUTONOMY_COMMAND = {
  SWARM: "daneel.goal.swarm",
  COUNCIL: "daneel.goal.council",
} as const

export const USER_VISIBLE_GOAL_AUTONOMY_COMMANDS = [] as const

export type GoalAutonomyCommand = (typeof GOAL_AUTONOMY_COMMAND)[keyof typeof GOAL_AUTONOMY_COMMAND]
export type GoalAutonomyKind = "swarm" | "council"
export type GoalAutonomyTrigger =
  | "goal-start"
  | "long-goal"
  | "model-error"
  | "drift-or-blockage"
  | "criteria-passed"

export type GoalAutonomyModel = {
  providerID: string
  modelID: string
  role: "main" | "cheap-verifier" | "coding-pressure" | "cheap-reasoning"
}

export type GoalAutonomyState = {
  active: boolean
  description: string
  startedAt: number
  updatedAt: number
  swarm: {
    count: number
    lastTrigger?: GoalAutonomyTrigger
    lastMessageCount?: number
  }
  council: {
    count: number
    approved: boolean
    rejected: boolean
    lastCriteriaAssistantID?: string
  }
}

export type GoalAutonomyDecision = {
  kind: GoalAutonomyKind
  trigger: GoalAutonomyTrigger
  models: GoalAutonomyModel[]
  prompt: string
}

export const PREFERRED_GOAL_AUTONOMY_MODELS: GoalAutonomyModel[] = [
  {
    providerID: "stepfun-step-plan",
    modelID: "step-3.7-flash",
    role: "cheap-verifier",
  },
  {
    providerID: "streamlake-kat-coding-plan",
    modelID: "kat-coder-pro-v2",
    role: "coding-pressure",
  },
  {
    providerID: "deepseek-direct",
    modelID: "deepseek-v4-flash",
    role: "cheap-reasoning",
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined
}

export function readGoalAutonomyState(metadata: Record<string, unknown> | undefined): GoalAutonomyState | undefined {
  if (!metadata) return undefined
  const raw = metadata[GOAL_AUTONOMY_METADATA_KEY]
  if (!isRecord(raw)) return undefined
  const swarm = isRecord(raw.swarm) ? raw.swarm : {}
  const council = isRecord(raw.council) ? raw.council : {}
  const description = readString(raw.description)
  if (!description) return undefined
  return {
    active: readBoolean(raw.active) ?? false,
    description,
    startedAt: readNumber(raw.startedAt) ?? Date.now(),
    updatedAt: readNumber(raw.updatedAt) ?? Date.now(),
    swarm: {
      count: readNumber(swarm.count) ?? 0,
      lastTrigger: readString(swarm.lastTrigger) as GoalAutonomyTrigger | undefined,
      lastMessageCount: readNumber(swarm.lastMessageCount),
    },
    council: {
      count: readNumber(council.count) ?? 0,
      approved: readBoolean(council.approved) ?? false,
      rejected: readBoolean(council.rejected) ?? false,
      lastCriteriaAssistantID: readString(council.lastCriteriaAssistantID),
    },
  }
}

export function writeGoalAutonomyState(
  metadata: Record<string, unknown> | undefined,
  state: GoalAutonomyState,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [GOAL_AUTONOMY_METADATA_KEY]: state,
  }
}

export function startOrUpdateGoalAutonomy(
  metadata: Record<string, unknown> | undefined,
  description: string,
  now = Date.now(),
): Record<string, unknown> {
  const previous = readGoalAutonomyState(metadata)
  const state: GoalAutonomyState = {
    active: true,
    description: description.trim(),
    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    swarm: previous?.description === description.trim() ? previous.swarm : { count: 0 },
    council: previous?.description === description.trim()
      ? previous.council
      : { count: 0, approved: false, rejected: false },
  }
  return writeGoalAutonomyState(metadata, state)
}

export function deactivateGoalAutonomy(
  metadata: Record<string, unknown> | undefined,
  now = Date.now(),
): Record<string, unknown> {
  const previous = readGoalAutonomyState(metadata)
  if (!previous) return metadata ?? {}
  return writeGoalAutonomyState(metadata, { ...previous, active: false, updatedAt: now })
}

export function selectGoalAutonomyModels(input: {
  mainModel: { providerID: string; modelID: string }
  availablePreferred?: GoalAutonomyModel[]
  maxModels?: number
}) {
  const result: GoalAutonomyModel[] = [
    {
      providerID: input.mainModel.providerID,
      modelID: input.mainModel.modelID,
      role: "main",
    },
  ]
  const maxModels = Math.max(1, input.maxModels ?? 3)
  for (const candidate of input.availablePreferred ?? PREFERRED_GOAL_AUTONOMY_MODELS) {
    const duplicate = result.some((item) => item.providerID === candidate.providerID && item.modelID === candidate.modelID)
    if (duplicate) continue
    result.push(candidate)
    if (result.length >= maxModels) break
  }
  return result
}

export function shouldSpawnGoalSwarm(input: {
  state: GoalAutonomyState | undefined
  messageCount: number
  pendingTaskCount: number
  assistantErrorCount: number
  previousAssistantErrorCount?: number
  latestAssistantText?: string
}) {
  const state = input.state
  if (!state?.active) return undefined
  if (state.council.approved) return undefined
  if (input.pendingTaskCount > 0) return undefined
  if (state.swarm.count === 0) return "goal-start" satisfies GoalAutonomyTrigger
  if (input.assistantErrorCount > (input.previousAssistantErrorCount ?? 0)) return "model-error" satisfies GoalAutonomyTrigger
  if (/\b(blocked|stuck|unclear|failed|error|cannot proceed|not sure)\b/i.test(input.latestAssistantText ?? "")) {
    return "drift-or-blockage" satisfies GoalAutonomyTrigger
  }
  const lastMessageCount = state.swarm.lastMessageCount ?? 0
  if (input.messageCount - lastMessageCount >= 6) return "long-goal" satisfies GoalAutonomyTrigger
  return undefined
}

export function assistantClaimsGoalCriteriaPassed(text: string | undefined) {
  return /DANEEL_GOAL_CRITERIA_PASSED\s*:\s*true/i.test(text ?? "")
}

export function shouldSpawnGoalCouncil(input: {
  state: GoalAutonomyState | undefined
  assistantID: string | undefined
  assistantText: string | undefined
  pendingTaskCount: number
}) {
  const state = input.state
  if (!state?.active) return false
  if (state.council.approved) return false
  if (input.pendingTaskCount > 0) return false
  if (!input.assistantID) return false
  if (state.council.lastCriteriaAssistantID === input.assistantID) return false
  return assistantClaimsGoalCriteriaPassed(input.assistantText)
}

export function markGoalSwarmSpawned(
  metadata: Record<string, unknown> | undefined,
  trigger: GoalAutonomyTrigger,
  messageCount: number,
  now = Date.now(),
) {
  const state = readGoalAutonomyState(metadata)
  if (!state) return metadata ?? {}
  return writeGoalAutonomyState(metadata, {
    ...state,
    updatedAt: now,
    swarm: {
      count: state.swarm.count + 1,
      lastTrigger: trigger,
      lastMessageCount: messageCount,
    },
  })
}

export function markGoalCouncilSpawned(
  metadata: Record<string, unknown> | undefined,
  assistantID: string,
  now = Date.now(),
) {
  const state = readGoalAutonomyState(metadata)
  if (!state) return metadata ?? {}
  return writeGoalAutonomyState(metadata, {
    ...state,
    updatedAt: now,
    council: {
      ...state.council,
      count: state.council.count + 1,
      lastCriteriaAssistantID: assistantID,
    },
  })
}

export function markGoalCouncilResult(metadata: Record<string, unknown> | undefined, output: string, now = Date.now()) {
  const state = readGoalAutonomyState(metadata)
  if (!state) return metadata ?? {}
  const approved = /DANEEL_COUNCIL_APPROVED\s*:\s*true/i.test(output)
  const rejected = /DANEEL_COUNCIL_APPROVED\s*:\s*false/i.test(output)
  return writeGoalAutonomyState(metadata, {
    ...state,
    active: approved ? false : state.active,
    updatedAt: now,
    council: {
      ...state.council,
      approved,
      rejected: rejected || state.council.rejected,
    },
  })
}

export function buildGoalAutonomyPrompt(input: {
  kind: GoalAutonomyKind
  goal: string
  trigger: GoalAutonomyTrigger
}) {
  if (input.kind === "council") {
    return `You are an internal Daneel goal council, not a user-facing command or configurable mode.

Goal:
${input.goal}

Trigger:
The main agent already passed its own goal criteria check.

Decide whether the goal is actually met. Try to prove it is incomplete. Inspect the claimed evidence, tests, diffs, skipped checks, risks, and assumptions. Be strict.

Return this exact marker on its own line:
DANEEL_COUNCIL_APPROVED: true

Only use true if the goal is complete. Otherwise return:
DANEEL_COUNCIL_APPROVED: false

Then provide concise blocking issues, non-blocking risks, and required next actions.`
  }

  return `You are an internal Daneel goal swarm worker, not a user-facing command or configurable mode.

Goal:
${input.goal}

Trigger:
${input.trigger}

Help the running goal mode. Find drift, missing work, unsafe assumptions, provider/model blind spots, skipped tests, and next concrete actions. Prefer small actionable findings over long prose. Do not claim the goal is complete; leave final completion to the council.`
}

export function buildGoalAutonomyDecision(input: {
  kind: GoalAutonomyKind
  goal: string
  trigger: GoalAutonomyTrigger
  mainModel: { providerID: string; modelID: string }
  availablePreferred?: GoalAutonomyModel[]
  maxModels?: number
}): GoalAutonomyDecision {
  return {
    kind: input.kind,
    trigger: input.trigger,
    models: selectGoalAutonomyModels(input),
    prompt: buildGoalAutonomyPrompt(input),
  }
}
