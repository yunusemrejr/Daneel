export type FusionCandidate = {
  id: string
  env: string
  baseURL: string
  model: string
  costRank: number
  speedRank: number
  headers?: Record<string, string>
}

export const FUSION_MODEL_COUNT = 4

export const FUSION_CANDIDATES: FusionCandidate[] = [
  {
    id: "stepfun-step-plan",
    env: "STEPFUN_API_KEY",
    baseURL: "https://api.stepfun.ai/step_plan/v1",
    model: "step-3.7-flash",
    costRank: 1,
    speedRank: 1,
  },
  {
    id: "deepseek-api",
    env: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    costRank: 2,
    speedRank: 2,
  },
  {
    id: "kimi-code-subscription",
    env: "KIMI_CODE_API_KEY",
    baseURL: "https://api.kimi.com/coding/v1",
    model: "kimi-for-coding",
    costRank: 2,
    speedRank: 2,
  },
  {
    id: "streamlake-kat-coding-plan",
    env: "STREAMLAKE_API_KEY",
    baseURL: "https://wanqing.streamlakeapi.com/api/gateway/coding/v1",
    model: "kat-coder-pro-v2",
    costRank: 3,
    speedRank: 3,
  },
  {
    id: "minimax-token-plan",
    env: "MINIMAX_API_KEY",
    baseURL: "https://api.minimax.io/v1",
    model: "MiniMax-M3",
    costRank: 3,
    speedRank: 4,
  },
  {
    id: "nvidia-nim",
    env: "NVIDIA_API_KEY",
    baseURL: "https://integrate.api.nvidia.com/v1",
    model: "nvidia/nemotron-3-ultra-550b-a55b",
    costRank: 4,
    speedRank: 4,
    headers: {
      "HTTP-Referer": "https://github.com/yunusemrejr/Daneel",
      "X-Title": "Daneel",
    },
  },
  {
    id: "xiaomi-mimo-token-plan",
    env: "MIMO_API_KEY",
    baseURL: "https://api.xiaomimimo.com/v1",
    model: "mimo-v2.5-pro",
    costRank: 2,
    speedRank: 3,
  },
  {
    id: "ollama-cloud-direct-openai",
    env: "OLLAMA_API_KEY",
    baseURL: "https://ollama.com/v1",
    model: "gpt-oss:120b",
    costRank: 2,
    speedRank: 4,
  },
]

const holdUntil = new Map<string, number>()

export function setFusionCandidateHold(id: string, ms: number, now = Date.now()) {
  holdUntil.set(id, now + ms)
}

export function clearFusionCandidateHold(id: string) {
  holdUntil.delete(id)
}

export function selectFusionRoster(env: Record<string, string | undefined> = process.env, now = Date.now()) {
  const selectedModels = new Set<string>()
  return FUSION_CANDIDATES.filter((candidate) => Boolean(env[candidate.env]?.trim()))
    .filter((candidate) => (holdUntil.get(candidate.id) ?? 0) <= now)
    .sort((a, b) => a.costRank - b.costRank || a.speedRank - b.speedRank || a.id.localeCompare(b.id))
    .filter((candidate) => {
      if (selectedModels.has(candidate.model)) return false
      selectedModels.add(candidate.model)
      return true
    })
    .slice(0, FUSION_MODEL_COUNT)
}
