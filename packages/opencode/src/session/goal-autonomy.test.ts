import { describe, expect, test } from "bun:test"
import {
  USER_VISIBLE_GOAL_AUTONOMY_COMMANDS,
  buildGoalAutonomyDecision,
  readGoalAutonomyState,
  shouldSpawnGoalCouncil,
  shouldSpawnGoalSwarm,
  startOrUpdateGoalAutonomy,
} from "./goal-autonomy"

describe("goal autonomy", () => {
  test("keeps swarm and council internal", () => {
    expect(USER_VISIBLE_GOAL_AUTONOMY_COMMANDS).toEqual([])
  })

  test("stores active goal state", () => {
    const state = readGoalAutonomyState(startOrUpdateGoalAutonomy(undefined, "ship provider routing", 1000))

    expect(state?.active).toBe(true)
    expect(state?.description).toBe("ship provider routing")
    expect(state?.swarm.count).toBe(0)
    expect(state?.council.approved).toBe(false)
  })

  test("routes goal swarm through main model first, then cheap coding providers", () => {
    const decision = buildGoalAutonomyDecision({
      kind: "swarm",
      goal: "fix tests",
      trigger: "goal-start",
      mainModel: { providerID: "main-provider", modelID: "main-model" },
    })

    expect(decision.models.map((item) => `${item.providerID}/${item.modelID}`)).toEqual([
      "main-provider/main-model",
      "stepfun-step-plan/step-3.7-flash",
      "streamlake-kat-coding-plan/kat-coder-pro-v2",
    ])
  })

  test("deduplicates main model from preferred provider set", () => {
    const decision = buildGoalAutonomyDecision({
      kind: "swarm",
      goal: "fix tests",
      trigger: "goal-start",
      mainModel: { providerID: "stepfun-step-plan", modelID: "step-3.7-flash" },
    })

    expect(decision.models.map((item) => `${item.providerID}/${item.modelID}`)).toEqual([
      "stepfun-step-plan/step-3.7-flash",
      "streamlake-kat-coding-plan/kat-coder-pro-v2",
      "deepseek-direct/deepseek-v4-flash",
    ])
  })

  test("spawns first swarm only when goal has no pending task", () => {
    const state = readGoalAutonomyState(startOrUpdateGoalAutonomy(undefined, "fix tests", 1000))

    expect(
      shouldSpawnGoalSwarm({
        state,
        messageCount: 1,
        pendingTaskCount: 0,
        assistantErrorCount: 0,
      }),
    ).toBe("goal-start")

    expect(
      shouldSpawnGoalSwarm({
        state,
        messageCount: 1,
        pendingTaskCount: 1,
        assistantErrorCount: 0,
      }),
    ).toBeUndefined()
  })

  test("spawns council only after main criteria marker", () => {
    const state = readGoalAutonomyState(startOrUpdateGoalAutonomy(undefined, "finish goal mode", 1000))

    expect(
      shouldSpawnGoalCouncil({
        state,
        assistantID: "a1",
        assistantText: "finished",
        pendingTaskCount: 0,
      }),
    ).toBe(false)

    expect(
      shouldSpawnGoalCouncil({
        state,
        assistantID: "a1",
        assistantText: "DANEEL_GOAL_CRITERIA_PASSED: true",
        pendingTaskCount: 0,
      }),
    ).toBe(true)
  })
})
