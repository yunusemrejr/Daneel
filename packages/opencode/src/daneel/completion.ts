type PartLike = {
  type: string
  text?: string
  synthetic?: boolean
}

type MessageLike = {
  info: {
    role: string
  }
  parts: PartLike[]
}

export type DaneelGoalGateState =
  | { action: "allow"; reason: string }
  | { action: "block"; reason: string; reminder: string; attempts: number }
  | { action: "exhausted"; reason: string; attempts: number }

const GOAL_START_MARKER = "Daneel persistent goal mode has been requested."
const CRITERIA_PASSED_MARKER = "DANEEL_GOAL_CRITERIA_PASSED: true"
const COUNCIL_APPROVED_MARKER = "DANEEL_COUNCIL_APPROVED: true"
const COMPLETION_GATE_BLOCKED_MARKER = "DANEEL_COMPLETION_GATE_BLOCKED"
const DEFAULT_MAX_BLOCKS = 3

function partText(part: PartLike) {
  return part.type === "text" && typeof part.text === "string" ? part.text : ""
}

export function sessionText(messages: MessageLike[]) {
  return messages.flatMap((message) => message.parts.map(partText)).filter(Boolean).join("\n")
}

export function hasActiveGoal(messages: MessageLike[]) {
  return sessionText(messages).includes(GOAL_START_MARKER)
}

export function hasGoalCriteriaPassed(messages: MessageLike[]) {
  return sessionText(messages).includes(CRITERIA_PASSED_MARKER)
}

export function hasCouncilApproval(messages: MessageLike[]) {
  return sessionText(messages).includes(COUNCIL_APPROVED_MARKER)
}

export function completionGateBlockCount(messages: MessageLike[]) {
  return messages.reduce((count, message) => {
    return count + message.parts.filter((part) => partText(part).includes(COMPLETION_GATE_BLOCKED_MARKER)).length
  }, 0)
}

export function goalModeSessionReminder(messages: MessageLike[]) {
  if (!hasActiveGoal(messages) || hasCouncilApproval(messages)) return undefined
  return `<system-reminder>
Daneel goal mode is active.

Completion is runtime-gated: do not present final completion until the goal criteria have concrete evidence and the final judge/council has approved it with ${COUNCIL_APPROVED_MARKER}.

Maintain evidence: files changed, checks run, failed checks, skipped checks, residual risks, and rollback path.
</system-reminder>`
}

function completionGateReminder(input: { criteriaPassed: boolean; attempts: number }) {
  const nextStep = input.criteriaPassed
    ? `The main criteria marker is present, but final judge/council approval is missing. Run a skeptical completion review against the original goal, current diff/state, checks, skipped checks, failures, and residual risks. Continue repairs if it rejects completion. Only after approval may you include ${COUNCIL_APPROVED_MARKER}.`
    : `The main goal criteria have not been proven. Continue with inspect, patch, test/check, and evidence collection. Include ${CRITERIA_PASSED_MARKER} only when the requested objective is actually satisfied with concrete evidence.`

  return `<system-reminder>
${COMPLETION_GATE_BLOCKED_MARKER}: ${input.attempts + 1}

Daneel blocked a premature goal completion claim at runtime.

${nextStep}

Do not ask the user to continue. Continue autonomously within safety policy.
</system-reminder>`
}

export function evaluateGoalCompletionGate(input: {
  messages: MessageLike[]
  maxBlocks?: number
}): DaneelGoalGateState {
  if (!hasActiveGoal(input.messages)) return { action: "allow", reason: "no active Daneel goal marker" }
  if (hasCouncilApproval(input.messages)) return { action: "allow", reason: "council approval marker found" }

  const attempts = completionGateBlockCount(input.messages)
  const maxBlocks = input.maxBlocks ?? DEFAULT_MAX_BLOCKS
  if (attempts >= maxBlocks) {
    return {
      action: "exhausted",
      reason: `goal completion gate already blocked ${attempts} time(s); deterministic retry budget exhausted`,
      attempts,
    }
  }

  const criteriaPassed = hasGoalCriteriaPassed(input.messages)
  return {
    action: "block",
    reason: criteriaPassed ? "missing council approval marker" : "missing goal criteria evidence marker",
    attempts,
    reminder: completionGateReminder({ criteriaPassed, attempts }),
  }
}

export const DaneelCompletion = {
  sessionText,
  hasActiveGoal,
  hasGoalCriteriaPassed,
  hasCouncilApproval,
  completionGateBlockCount,
  goalModeSessionReminder,
  evaluateGoalCompletionGate,
}
