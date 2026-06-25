import { describe, expect, test } from "bun:test"
import { DaneelCache } from "./daneel-cache"

describe("DaneelCache", () => {
  test("detects the target provider without depending on a provider id shape", () => {
    const model = {
      providerID: "direct",
      id: "v4-flash",
      api: {
        id: "provider-v4-flash",
        url: "https://api." + "deep" + "seek" + ".com",
      },
    }

    expect(DaneelCache.isTargetModel(model)).toBe(true)
  })

  test("keeps stable system text separate from volatile runtime state", () => {
    const blocks = DaneelCache.stableSystemBlocks(
      ["stable provider policy", "stable agent policy"],
      ["Today's date: Thu Jun 25 2026", "Working directory: /tmp/project"],
    )

    expect(blocks).toEqual([
      "stable provider policy\nstable agent policy",
      "Today's date: Thu Jun 25 2026\nWorking directory: /tmp/project",
    ])
  })

  test("hashes only the stable leading system block", () => {
    const first = DaneelCache.stablePrefix([
      { role: "system", content: "stable" },
      { role: "system", content: "volatile date one" },
      { role: "user", content: "task" },
    ])
    const second = DaneelCache.stablePrefix([
      { role: "system", content: "stable" },
      { role: "system", content: "volatile date two" },
      { role: "user", content: "task" },
    ])

    expect(first.hash).toBe(second.hash)
    expect(first.messageCount).toBe(1)
  })

  test("normalizes provider cache usage counters", () => {
    const usage = DaneelCache.usageFromEvent({
      response: {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120,
          [["prompt", "cache", "hit", "tokens"].join("_")]: 70,
          [["prompt", "cache", "miss", "tokens"].join("_")]: 30,
        },
      },
    })

    expect(usage?.promptCacheHitTokens).toBe(70)
    expect(usage?.promptCacheMissTokens).toBe(30)
    expect(DaneelCache.toLLMUsage(usage)).toMatchObject({
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cacheReadInputTokens: 70,
      nonCachedInputTokens: 30,
    })
  })

  test("requests streaming usage from compatible providers", () => {
    expect(DaneelCache.requestOptions()).toEqual({
      stream_options: {
        include_usage: true,
      },
    })
  })
})
