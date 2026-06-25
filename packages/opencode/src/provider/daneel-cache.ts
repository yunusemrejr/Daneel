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

export function usageFromEvent(value: unknown): CacheUsage | undefined {
  const event = asRecord(value)
  if (!event) return undefined
  return fromUsageObject(event.usage) ?? fromUsageObject(asRecord(event.response)?.usage)
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

export function toLLMUsage(usage: CacheUsage | undefined) {
  if (!usage) return {}
  const inputTokens = usage.promptTokens ?? addDefined(usage.promptCacheHitTokens, usage.promptCacheMissTokens)
  const totalTokens = usage.totalTokens ?? addDefined(inputTokens, usage.completionTokens)
  return compact({
    inputTokens,
    outputTokens: usage.completionTokens,
    totalTokens,
    nonCachedInputTokens: usage.promptCacheMissTokens,
    cacheReadInputTokens: usage.promptCacheHitTokens,
    cacheWriteInputTokens:
      usage.promptCacheHitTokens !== undefined || usage.promptCacheMissTokens !== undefined ? 0 : undefined,
    reasoningTokens: usage.reasoningTokens,
    providerMetadata: providerMetadata(usage),
  })
}

export function mergeProviderMetadata(metadata: Record<string, Record<string, unknown>> | undefined, usage: CacheUsage | undefined) {
  const extra = providerMetadata(usage)
  if (!extra) return metadata
  return {
    ...metadata,
    [TARGET_PROVIDER]: {
      ...metadata?.[TARGET_PROVIDER],
      ...extra[TARGET_PROVIDER],
    },
  }
}

function fromUsageObject(value: unknown): CacheUsage | undefined {
  const usage = asRecord(value)
  if (!usage) return undefined
  const completionDetails = asRecord(usage.completion_tokens_details) ?? {}
  const result = compact({
    promptTokens: numberField(usage, "prompt_tokens"),
    completionTokens: numberField(usage, "completion_tokens"),
    totalTokens: numberField(usage, "total_tokens"),
    promptCacheHitTokens: numberField(usage, ["prompt", "cache", "hit", "tokens"].join("_")),
    promptCacheMissTokens: numberField(usage, ["prompt", "cache", "miss", "tokens"].join("_")),
    reasoningTokens: numberField(completionDetails, "reasoning_tokens"),
  })
  return Object.keys(result).length === 0 ? undefined : (result as CacheUsage)
}

function providerMetadata(usage: CacheUsage | undefined) {
  if (!usage) return undefined
  const hit = usage.promptCacheHitTokens ?? 0
  const miss = usage.promptCacheMissTokens ?? 0
  const denominator = hit + miss
  return {
    [TARGET_PROVIDER]: compact({
      cachePolicy: DANEEL_CACHE_POLICY_VERSION,
      cache: compact({
        hitTokens: usage.promptCacheHitTokens,
        missTokens: usage.promptCacheMissTokens,
        hitRate: denominator > 0 ? hit / denominator : undefined,
      }),
      usage: compact({
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        promptCacheHitTokens: usage.promptCacheHitTokens,
        promptCacheMissTokens: usage.promptCacheMissTokens,
        reasoningTokens: usage.reasoningTokens,
      }),
    }),
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function sum(a: number | undefined, b: number | undefined) {
  if (a === undefined) return b
  if (b === undefined) return a
  return a + b
}

function addDefined(a: number | undefined, b: number | undefined) {
  if (a === undefined && b === undefined) return undefined
  return (a ?? 0) + (b ?? 0)
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function compact<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Record<string, unknown>
}
