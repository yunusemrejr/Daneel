import { describe, expect, test } from "bun:test"
import * as DaneelCache from "./daneel-cache"

describe("DaneelCache", () => {
  test("splits stable and dynamic blocks", () => {
    expect(DaneelCache.stableSystemBlocks(["stable"], ["dynamic"])).toEqual(["stable", "dynamic"])
  })
})
