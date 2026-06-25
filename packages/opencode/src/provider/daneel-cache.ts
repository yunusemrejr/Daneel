export const DANEEL_CACHE_POLICY_VERSION = "daneel-cache-v1"

export type SimpleMessage = {
  role: string
  content: unknown
}

export type CacheUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  promptCacheHitTokens?: number
  promptCacheMissTokens?: number
  reasoningTokens?: number
}

const TARGET_PROVIDER = "deep" + "seek"

export function isTargetModel(model: unknown) {
  const record = asRecord(model)
  const api = asRecord(record?.api)
  return [record?.providerID, record?.id, api?.id, api?.url]
    .map((value) => String(value ?? "").toLowerCase())
    .some((value) => value.includes(TARGET_PROVIDER))
}

export function stableSystemBlocks(stableParts: readonly string[], dynamicParts: readonly string[]) {
  const stable = stableParts.map((value) => value.trim()).filter(Boolean).join("\n")
  const dynamic = dynamicParts.map((value) => value.trim()).filter(Boolean).join("\n")
  return [stable, dynamic].filter((value) => value.length > 0)
}

export function requestOptions() {
  return {
    stream_options: {
      include_usage: true,
    },
  }
}

export function stablePrefix(messages: readonly SimpleMessage[], tools: readonly string[] = []) {
  const source = stablePrefixSource(messages, tools)
  return {
    version: DANEEL_CACHE_POLICY_VERSION,
    hash: stableHash(source),
    messageCount: messages.some((msg) => msg.role === "system") ? 1 : 0,
    charCount: source.length,
  }
}

export function stablePrefixSource(messages: readonly SimpleMessage[], tools: readonly string[] = []) {
  const stableSystem = messages.find((msg) => msg.role === "system")
  return JSON.stringify({
    version: DANEEL_CACHE_POLICY_VERSION,
    messages: stableSystem ? [{ role: stableSystem.role, content: stableSystem.content }] : [],
    tools: [...tools].sort(),
  })
}

export function mergeUsage(current: CacheUsage | undefined, next: CacheUsage | undefined): CacheUsage | undefined {
  if (!next) return current
  if (!current) return next
  return {
    promptTokens: sum(current.promptTokens, next.promptTokens),
    completionTokens: sum(current.completionTokens, next.completionTokens),
    totalTokens: sum(current.totalTokens, next.totalTokens),
    promptCacheHitTokens: sum(current.promptCacheHitTokens, next.promptCacheHitTokens),
    promptCacheMissTokens: sum(current.promptCacheMissTokens, next.promptCacheMissTokens),
    reasoningTokens: sum(current.reasoningTokens, next.reasoningTokens),
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function sum(a: number | undefined, b: number | undefined) {
  if (a === undefined) return b
  if (b === undefined) return a
  return a + b
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}
