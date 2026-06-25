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
  "deepseek-direct": {
    primaryBaseURL: "https://api.deepseek.com",
    knownBaseURLs: ["https://api.deepseek.com", "https://api.deepseek.com/v1"],
    fallbackBaseURLs: ["https://api.deepseek.com/v1"],
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
