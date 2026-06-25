export type DaneelProviderEndpointProfile = {
  primaryBaseURL: string
  knownBaseURLs: string[]
  fallbackBaseURLs: string[]
}

const unique = (items: Array<string | undefined>) => Array.from(new Set(items.filter((item): item is string => !!item)))

export const DaneelProviderEndpointProfiles: Record<string, DaneelProviderEndpointProfile> = {
  "streamlake-kat-coding-plan": {
    primaryBaseURL: "https://wanqing.streamlakeapi.com/api/gateway/coding/v1",
    knownBaseURLs: [
      "https://wanqing.streamlakeapi.com/api/gateway/coding/v1",
      "https://vanchin.streamlake.ai/api/gateway/v1/endpoints",
    ],
    fallbackBaseURLs: [],
  },
  "stepfun-step-plan": {
    primaryBaseURL: "https://api.stepfun.ai/step_plan/v1",
    knownBaseURLs: ["https://api.stepfun.ai/step_plan/v1", "https://api.stepfun.ai/step_plan", "https://api.stepfun.ai/v1"],
    fallbackBaseURLs: [],
  },
  "kimi-code-subscription": {
    primaryBaseURL: "https://api.kimi.com/coding/v1",
    knownBaseURLs: ["https://api.kimi.com/coding/v1", "https://api.kimi.com/coding/", "https://api.moonshot.ai/v1"],
    fallbackBaseURLs: [],
  },
  "minimax-token-plan": {
    primaryBaseURL: "https://api.minimax.io/v1",
    knownBaseURLs: ["https://api.minimax.io/v1", "https://api.minimax.io/anthropic", "https://api.minimaxi.com/v1"],
    fallbackBaseURLs: [],
  },
  "nvidia-build-nim": {
    primaryBaseURL: "https://integrate.api.nvidia.com/v1",
    knownBaseURLs: ["https://integrate.api.nvidia.com/v1", "http://localhost:8000/v1"],
    fallbackBaseURLs: [],
  },
  "xiaomi-mimo-token-plan": {
    primaryBaseURL: "https://api.xiaomimimo.com/v1",
    knownBaseURLs: ["https://api.xiaomimimo.com/v1"],
    fallbackBaseURLs: [],
  },
  "deepseek-direct": {
    primaryBaseURL: "https://api.deepseek.com",
    knownBaseURLs: ["https://api.deepseek.com", "https://api.deepseek.com/v1"],
    fallbackBaseURLs: ["https://api.deepseek.com/v1"],
  },
  "ollama-cloud-direct-openai": {
    primaryBaseURL: "https://ollama.com/v1",
    knownBaseURLs: ["https://ollama.com/v1", "https://ollama.com/api", "http://localhost:11434/v1"],
    fallbackBaseURLs: [],
  },
}

export function endpointOptions(providerID: string) {
  const profile = DaneelProviderEndpointProfiles[providerID]
  if (!profile) return {}
  return {
    baseURL: profile.primaryBaseURL,
    knownBaseURLs: unique(profile.knownBaseURLs),
    fallbackBaseURLs: unique(profile.fallbackBaseURLs),
  }
}

export function fallbackBaseURLs(providerID: string, configured: unknown, activeBaseURL: string | undefined) {
  const fromConfig = Array.isArray(configured) ? configured.filter((item): item is string => typeof item === "string") : []
  const fromProfile = DaneelProviderEndpointProfiles[providerID]?.fallbackBaseURLs ?? []
  return unique([...fromConfig, ...fromProfile]).filter((item) => item !== activeBaseURL)
}
