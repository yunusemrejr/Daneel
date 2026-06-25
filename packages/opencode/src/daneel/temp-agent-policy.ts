type ModelRef = {
  providerID: string
  modelID: string
}

type ModelLike = {
  id?: string
  providerID?: string
  status?: string
  name?: string
  family?: string
  capabilities?: {
    input?: { text?: boolean }
    output?: { text?: boolean }
  }
  cost?: {
    input?: number
    output?: number
    cache?: { read?: number; write?: number }
  }
}

type ProviderLike = {
  id?: string
  name?: string
  source?: string
  models?: Record<string, ModelLike>
}

type AgentLike = {
  name: string
  description?: string
  mode?: string
  native?: boolean
  hidden?: boolean
  permission: unknown
  model?: ModelRef
  prompt?: string
  options?: Record<string, unknown>
  temperature?: number
  topP?: number
  color?: string
  variant?: string
  steps?: number
}

export type CostClass = "cheap-fast" | "normal" | "last-resort"

export type AgentSelection = {
  agent: AgentLike
  kind: "existing" | "temporary"
  requestedType: string
  reason: string
  requiresApproval: boolean
  approval?: {
    state: "not-required" | "approved" | "rejected-replaced" | "forced-after-budget" | "skipped-no-independent-model"
    attempts: number
    approverModel?: ModelRef
    reason: string
  }
}

export type ApprovalDecision = {
  approved: boolean
  reason: string
  replacement_subagent_type?: string | null
  replacement_model?: string | null
}

const CHEAP_PROVIDER_HINTS = ["streamlake", "kat", "stepfun", "step-fun", "deepseek"]
const CHEAP_MODEL_HINTS = [
  "kat-coder",
  "kat coder",
  "deepseek-v4-flash",
  "deepseek v4 flash",
  "step-3.7-flash",
  "stepfun3.7",
  "stepfun-3.7",
  "step-3.5-flash",
  "stepfun3.5",
  "stepfun-3.5",
]
const LAST_RESORT_PROVIDER_HINTS = ["openrouter", "openai", "anthropic", "claude", "google", "gemini", "xai", "grok"]
const LAST_RESORT_MODEL_HINTS = ["gpt-", "chatgpt", "claude", "gemini", "grok"]

function compact(value: string | undefined) {
  return String(value ?? "").toLowerCase().replace(/[\s_]+/g, "-")
}

function modelKey(model: ModelRef) {
  return `${model.providerID}/${model.modelID}`
}

function parseModelRef(value: string | null | undefined): ModelRef | undefined {
  if (!value) return undefined
  const [providerID, ...rest] = String(value).split("/")
  const modelID = rest.join("/")
  if (!providerID || !modelID) return undefined
  return { providerID, modelID }
}

function hasTextOutput(model: ModelLike) {
  return model.capabilities?.output?.text !== false
}

function isActive(model: ModelLike) {
  return model.status !== "deprecated" && model.status !== "alpha"
}

function normalizeRequestedType(value: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^temp(orary)?[:/\s-]*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return cleaned || "generalist"
}

function makeTemporaryName(requestedType: string) {
  return `daneel-temp-${normalizeRequestedType(requestedType)}`
}

export function classifyProviderModel(providerID: string, modelID: string): CostClass {
  const provider = compact(providerID)
  const model = compact(modelID)
  const joined = `${provider}/${model}`

  if (CHEAP_MODEL_HINTS.some((hint) => joined.includes(compact(hint)))) return "cheap-fast"
  if (CHEAP_PROVIDER_HINTS.some((hint) => provider.includes(compact(hint)))) return "cheap-fast"
  if (provider.includes("openrouter")) return "last-resort"
  if (LAST_RESORT_PROVIDER_HINTS.some((hint) => provider.includes(compact(hint)))) return "last-resort"
  if (LAST_RESORT_MODEL_HINTS.some((hint) => model.includes(compact(hint)))) return "last-resort"

  return "normal"
}

function scoreCandidate(input: {
  providerID: string
  modelID: string
  model: ModelLike
  allowLastResort: boolean
  exclude?: Set<string>
}) {
  if (!isActive(input.model)) return Number.POSITIVE_INFINITY
  if (!hasTextOutput(input.model)) return Number.POSITIVE_INFINITY
  if (input.exclude?.has(`${input.providerID}/${input.modelID}`)) return Number.POSITIVE_INFINITY

  const costClass = classifyProviderModel(input.providerID, input.modelID)
  if (costClass === "last-resort" && !input.allowLastResort) return Number.POSITIVE_INFINITY

  let score = 0
  if (costClass === "cheap-fast") score -= 500
  if (costClass === "last-resort") score += 1_000

  const provider = compact(input.providerID)
  const model = compact(input.modelID)
  if (provider.includes("streamlake") && model.includes("kat-coder")) score -= 120
  if (provider.includes("stepfun") || model.includes("step-3.7-flash")) score -= 110
  if (model.includes("deepseek-v4-flash")) score -= 90
  if (model.includes("flash")) score -= 25

  const inputCost = input.model.cost?.input ?? 0
  const outputCost = input.model.cost?.output ?? 0
  score += (inputCost + outputCost) * 10_000

  return score
}

export function selectCostOptimizedModel(input: {
  providers: Record<string, ProviderLike>
  mainModel?: ModelRef
  allowLastResort?: boolean
  excludeModels?: ModelRef[]
}): ModelRef | undefined {
  const candidates: Array<{ providerID: string; modelID: string; model: ModelLike }> = []
  for (const [providerKey, provider] of Object.entries(input.providers)) {
    const providerID = provider.id ?? providerKey
    for (const [modelKey, model] of Object.entries(provider.models ?? {})) {
      candidates.push({ providerID, modelID: model.id ?? modelKey, model })
    }
  }

  if (candidates.length === 0) return undefined

  const mainIsLastResort = input.mainModel
    ? classifyProviderModel(input.mainModel.providerID, input.mainModel.modelID) === "last-resort"
    : false
  const allowLastResort = input.allowLastResort === true || mainIsLastResort
  const exclude = new Set((input.excludeModels ?? []).map(modelKey))

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate({ ...candidate, allowLastResort, exclude }),
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => a.score - b.score || `${a.providerID}/${a.modelID}`.localeCompare(`${b.providerID}/${b.modelID}`))

  if (ranked[0]) return { providerID: ranked[0].providerID, modelID: ranked[0].modelID }

  if (!allowLastResort) return selectCostOptimizedModel({ ...input, allowLastResort: true })
  return undefined
}

export function selectApprovalModel(input: {
  providers: Record<string, ProviderLike>
  mainModel?: ModelRef
  candidateModel?: ModelRef
}): ModelRef | undefined {
  const exclude = [input.mainModel, input.candidateModel].filter(Boolean) as ModelRef[]
  return selectCostOptimizedModel({ providers: input.providers, mainModel: input.mainModel, excludeModels: exclude })
}

export function selectApprovalAgent(agents: AgentLike[], currentAgent: string) {
  if (agents.some((agent) => agent.name === "general")) return "general"
  const subagent = agents.find((agent) => agent.mode === "subagent" && agent.hidden !== true)
  if (subagent) return subagent.name
  return currentAgent
}

function buildTemporaryPrompt(input: { requestedType: string; basePrompt?: string; model?: ModelRef; approvalReason?: string }) {
  return [
    input.basePrompt,
    `You are a silent, temporary Daneel session subagent of type "${input.requestedType}".`,
    "You exist only for this session. Do not claim to be a permanent configured agent.",
    "Work autonomously on the delegated task, keep output concise, return concrete findings/evidence, and do not ask the user questions.",
    "Prefer cheap, fast configured models for boring verification, summarization, extraction, and small review work.",
    "Treat OpenRouter, OpenAI/ChatGPT, Gemini, Claude/Anthropic, and xAI/Grok as last-resort routes unless they were explicitly selected by the user or by a trusted agent definition.",
    input.model ? `Selected model: ${modelKey(input.model)}.` : undefined,
    input.approvalReason ? `Selection gate: ${input.approvalReason}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n")
}

function createTemporaryAgent(input: {
  requestedType: string
  baseAgent: AgentLike
  model?: ModelRef
  approvalReason?: string
}): AgentLike {
  const normalized = normalizeRequestedType(input.requestedType)
  const description = `Temporary Daneel ${normalized} subagent for this session`
  return {
    ...input.baseAgent,
    name: makeTemporaryName(input.requestedType),
    description,
    mode: "subagent",
    native: true,
    hidden: true,
    model: input.model ?? input.baseAgent.model,
    prompt: buildTemporaryPrompt({
      requestedType: normalized,
      basePrompt: input.baseAgent.prompt,
      model: input.model,
      approvalReason: input.approvalReason,
    }),
    options: {
      ...(input.baseAgent.options ?? {}),
      daneelTemporaryAgent: true,
      daneelRequestedType: input.requestedType,
      daneelApprovalReason: input.approvalReason ?? "pending-secondary-approval",
    },
  }
}

export function resolveAgent(input: {
  requestedType: string
  agents: AgentLike[]
  providers: Record<string, ProviderLike>
  mainModel?: ModelRef
}): AgentSelection | undefined {
  const existing = input.agents.find((agent) => agent.name === input.requestedType)
  if (existing) {
    return {
      agent: existing,
      kind: "existing",
      requestedType: input.requestedType,
      reason: "configured agent selected",
      requiresApproval: false,
      approval: { state: "not-required", attempts: 0, reason: "configured agent definitions are treated as explicit user configuration" },
    }
  }

  const baseAgent =
    input.agents.find((agent) => agent.name === "general") ??
    input.agents.find((agent) => agent.mode === "subagent") ??
    input.agents[0]
  if (!baseAgent) return undefined

  const selectedModel = selectCostOptimizedModel({ providers: input.providers, mainModel: input.mainModel }) ?? input.mainModel
  const agent = createTemporaryAgent({ requestedType: input.requestedType, baseAgent, model: selectedModel })

  return {
    agent,
    kind: "temporary",
    requestedType: input.requestedType,
    reason: selectedModel
      ? `created temporary agent with cost-aware model ${modelKey(selectedModel)}`
      : "created temporary agent using fallback base agent model",
    requiresApproval: true,
  }
}

export function buildApprovalPrompt(input: { selection: AgentSelection; mainModel?: ModelRef; approvalModel?: ModelRef }) {
  const selectedModel = input.selection.agent.model
  return `You are Daneel's secondary temporary-agent selection judge.

Review this proposed temporary subagent selection. Return ONLY one JSON object, no markdown.

Policy:
- Approve temporary agents only when their role is narrow, session-local, and useful.
- For small boring tasks, prefer cheap/fast configured models: StreamLake KAT Coder plan models named like kat-coder, StepFun 3.5/3.7 flash models, and DeepSeek v4 flash.
- OpenRouter is last resort because it can become costly quickly.
- OpenAI/ChatGPT, Gemini, Claude/Anthropic, and xAI/Grok are last resort unless the user explicitly selected them as the main model or an existing agent definition selected them.
- Avoid endless disagreement: either approve, or provide one replacement_model as provider/model. Do not negotiate.

Proposed selection:
${JSON.stringify(
  {
    requested_type: input.selection.requestedType,
    temporary_agent: input.selection.agent.name,
    selected_model: selectedModel ? modelKey(selectedModel) : null,
    main_model: input.mainModel ? modelKey(input.mainModel) : null,
    approval_model: input.approvalModel ? modelKey(input.approvalModel) : null,
    reason: input.selection.reason,
  },
  null,
  2,
)}

Required JSON shape:
{
  "approved": true,
  "reason": "short reason",
  "replacement_subagent_type": null,
  "replacement_model": null
}`
}

export function parseApprovalDecision(text: string): ApprovalDecision | undefined {
  const trimmed = text.trim()
  const raw = trimmed.startsWith("{") ? trimmed : (trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "")
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return undefined
    return {
      approved: parsed.approved === true,
      reason: typeof parsed.reason === "string" ? parsed.reason : "no reason supplied",
      replacement_subagent_type:
        typeof parsed.replacement_subagent_type === "string" ? parsed.replacement_subagent_type : null,
      replacement_model: typeof parsed.replacement_model === "string" ? parsed.replacement_model : null,
    }
  } catch {
    return undefined
  }
}

export function applyApprovalDecision(input: {
  selection: AgentSelection
  decision: ApprovalDecision | undefined
  providers: Record<string, ProviderLike>
  mainModel?: ModelRef
  approverModel?: ModelRef
}): AgentSelection {
  if (!input.selection.requiresApproval) return input.selection

  if (!input.approverModel) {
    return {
      ...input.selection,
      approval: {
        state: "skipped-no-independent-model",
        attempts: 0,
        reason: "No configured secondary model distinct from the main/candidate model was available",
      },
    }
  }

  if (input.decision?.approved) {
    return {
      ...input.selection,
      approval: {
        state: "approved",
        attempts: 1,
        approverModel: input.approverModel,
        reason: input.decision.reason,
      },
      agent: createTemporaryAgent({
        requestedType: input.selection.requestedType,
        baseAgent: input.selection.agent,
        model: input.selection.agent.model,
        approvalReason: input.decision.reason,
      }),
    }
  }

  const requestedReplacement = parseModelRef(input.decision?.replacement_model)
  const current = input.selection.agent.model
  const replacement =
    requestedReplacement && input.providers[requestedReplacement.providerID]?.models?.[requestedReplacement.modelID]
      ? requestedReplacement
      : selectCostOptimizedModel({
          providers: input.providers,
          mainModel: input.mainModel,
          excludeModels: current ? [current] : [],
        })

  if (replacement) {
    const requestedType = input.decision?.replacement_subagent_type || input.selection.requestedType
    return {
      ...input.selection,
      requestedType,
      reason: `secondary selector replaced temporary agent model with ${modelKey(replacement)}`,
      approval: {
        state: "rejected-replaced",
        attempts: 1,
        approverModel: input.approverModel,
        reason: input.decision?.reason ?? "secondary selector rejected the original selection",
      },
      agent: createTemporaryAgent({
        requestedType,
        baseAgent: input.selection.agent,
        model: replacement,
        approvalReason: input.decision?.reason ?? "secondary selector replacement applied",
      }),
    }
  }

  return {
    ...input.selection,
    approval: {
      state: "forced-after-budget",
      attempts: 1,
      approverModel: input.approverModel,
      reason:
        input.decision?.reason ??
        "Secondary selector did not approve, but no valid replacement was available; deterministic one-attempt budget exhausted",
    },
  }
}

export function sessionReminder(input: { turn: number; agentName: string; parentSessionID?: string | null }) {
  if (input.parentSessionID) return undefined
  if (input.agentName !== "build") return undefined
  if (input.turn !== 1 && input.turn % 4 !== 0) return undefined

  return `<system-reminder>
Daneel autonomous temporary agent maker is active.

When existing configured agents do not fit, you may call the task tool with a new narrow subagent_type. Daneel will treat it as a session-only temporary agent candidate, select a cost-aware provider/model, and run a secondary selector gate before launch. Do not ask the user to define it.

Cost policy: use configured StreamLake KAT Coder plan, StepFun 3.5/3.7 flash, and DeepSeek v4 flash for cheap/fast boring work such as summaries, small reviews, extraction, and verification. Treat OpenRouter, OpenAI/ChatGPT, Gemini, Claude/Anthropic, and xAI/Grok as last resort unless explicitly selected by the user or an existing trusted agent definition.
</system-reminder>`
}

export const DaneelTemporaryAgentPolicy = {
  classifyProviderModel,
  selectCostOptimizedModel,
  selectApprovalModel,
  selectApprovalAgent,
  resolveAgent,
  buildApprovalPrompt,
  parseApprovalDecision,
  applyApprovalDecision,
  sessionReminder,
}
