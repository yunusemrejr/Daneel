import { describe, expect, test } from "bun:test"
import { clearFusionCandidateHold, FUSION_MODEL_COUNT, selectFusionRoster, setFusionCandidateHold } from "./fusion-roster"

describe("Daneel fusion roster", () => {
  test("selects at most four configured models without duplicates", () => {
    const env = {
      STEPFUN_API_KEY: "x",
      DEEPSEEK_API_KEY: "x",
      KIMI_CODE_API_KEY: "x",
      STREAMLAKE_API_KEY: "x",
      MINIMAX_API_KEY: "x",
      NVIDIA_API_KEY: "x",
    }

    const roster = selectFusionRoster(env, 1_000)
    const models = new Set(roster.map((item) => item.model))

    expect(roster).toHaveLength(FUSION_MODEL_COUNT)
    expect(models.size).toBe(roster.length)
    expect(roster[0]?.id).toBe("stepfun-step-plan")
  })

  test("skips a held candidate and can restore it", () => {
    const env = {
      STEPFUN_API_KEY: "x",
      DEEPSEEK_API_KEY: "x",
      KIMI_CODE_API_KEY: "x",
      STREAMLAKE_API_KEY: "x",
    }

    setFusionCandidateHold("stepfun-step-plan", 60_000, 1_000)
    expect(selectFusionRoster(env, 2_000)[0]?.id).not.toBe("stepfun-step-plan")

    clearFusionCandidateHold("stepfun-step-plan")
    expect(selectFusionRoster(env, 2_000)[0]?.id).toBe("stepfun-step-plan")
  })
})
