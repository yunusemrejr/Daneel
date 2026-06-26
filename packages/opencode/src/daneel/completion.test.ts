import { describe, expect, test } from "bun:test"
import { DaneelCompletion } from "./completion"

function text(value: string) {
  return {
    info: { role: "user" },
    parts: [{ type: "text", text: value }],
  }
}

const goal = text(`<system-reminder>
Daneel persistent goal mode has been requested.
Goal: harden the harness
</system-reminder>`)

describe("Daneel goal completion gate", () => {
  test("does not gate sessions without active goal mode", () => {
    expect(DaneelCompletion.evaluateGoalCompletionGate({ messages: [text("normal task")] })).toEqual({
      action: "allow",
      reason: "no active Daneel goal marker",
    })
  })

  test("blocks active goal completion before evidence markers", () => {
    const decision = DaneelCompletion.evaluateGoalCompletionGate({ messages: [goal, text("done")] })
    expect(decision.action).toBe("block")
    if (decision.action === "block") {
      expect(decision.reason).toBe("missing goal criteria evidence marker")
      expect(decision.reminder).toContain("DANEEL_COMPLETION_GATE_BLOCKED")
    }
  })

  test("blocks after criteria pass until council approval exists", () => {
    const decision = DaneelCompletion.evaluateGoalCompletionGate({
      messages: [goal, text("DANEEL_GOAL_CRITERIA_PASSED: true")],
    })
    expect(decision.action).toBe("block")
    if (decision.action === "block") expect(decision.reason).toBe("missing council approval marker")
  })

  test("allows final completion after council approval marker", () => {
    expect(
      DaneelCompletion.evaluateGoalCompletionGate({
        messages: [goal, text("DANEEL_COUNCIL_APPROVED: true")],
      }),
    ).toEqual({ action: "allow", reason: "council approval marker found" })
  })

  test("has a deterministic retry budget", () => {
    const blocked = text("DANEEL_COMPLETION_GATE_BLOCKED")
    const decision = DaneelCompletion.evaluateGoalCompletionGate({
      messages: [goal, blocked, blocked, blocked],
    })
    expect(decision.action).toBe("exhausted")
  })
})
