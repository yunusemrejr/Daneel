export const DANEEL_CACHE_POLICY_VERSION = "daneel-cache-v1"

export type SimpleMessage = {
  role: string
  content: unknown
}

export function stableSystemBlocks(stableParts: readonly string[], dynamicParts: readonly string[]) {
  const stable = stableParts.map((value) => value.trim()).filter(Boolean).join("\n")
  const dynamic = dynamicParts.map((value) => value.trim()).filter(Boolean).join("\n")
  return [stable, dynamic].filter((value) => value.length > 0)
}

export function stablePrefixSource(messages: readonly SimpleMessage[], tools: readonly string[] = []) {
  const stableSystem = messages.find((msg) => msg.role === "system")
  return JSON.stringify({
    version: DANEEL_CACHE_POLICY_VERSION,
    messages: stableSystem ? [{ role: stableSystem.role, content: stableSystem.content }] : [],
    tools: [...tools].sort(),
  })
}
