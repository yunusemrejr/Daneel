import { describe, expect, test } from "bun:test"
import * as DaneelCache from "./daneel-cache"

describe("DaneelCache", () => {
  test("detects target provider from model metadata", () => {
    const providerName = "deep" + "seek"
    expect(
      DaneelCache.isTargetModel({
        providerID: providerName,
        id: "v4-flash",
        api: { id: "v4-flash", url: "https://example.invalid" },
      }),
    ).toBe(true)
  })

  test("splits stable and dynamic blocks", () => {
    expect(DaneelCache.stableSystemBlocks(["stable"], ["dynamic"])).toEqual(["stable", "dynamic"])
  })
})
