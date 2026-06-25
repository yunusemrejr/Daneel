export const DANEEL_CACHE_POLICY_VERSION = "daneel-cache-v1"

export function stableSystemBlocks(stableParts: readonly string[], dynamicParts: readonly string[]) {
  const stable = stableParts.map((value) => value.trim()).filter(Boolean).join("\n")
  const dynamic = dynamicParts.map((value) => value.trim()).filter(Boolean).join("\n")
  return [stable, dynamic].filter((value) => value.length > 0)
}
