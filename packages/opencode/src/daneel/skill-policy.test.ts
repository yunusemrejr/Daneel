import { describe, expect, test } from "bun:test"
import { DaneelSkillPolicy } from "./skill-policy"

const skills = [
  {
    name: "python-debugger",
    description: "Debug Python pytest failures and traceback-driven repair work.",
    location: "/home/user/skills/python-debugger/SKILL.md",
  },
  {
    name: "react-ui-review",
    description: "Review React UI components, layout, accessibility, and frontend state.",
    location: "/home/user/skills/react-ui-review/SKILL.md",
  },
  {
    name: "postgres-migration",
    description: "Design reversible SQL and Postgres migrations with rollback notes.",
    location: "/home/user/skills/postgres-migration/SKILL.md",
  },
]

describe("Daneel skill policy", () => {
  test("ranks skills by current task text", () => {
    expect(
      DaneelSkillPolicy.selectRelevant({
        skills,
        taskText: "Fix the failing pytest traceback in the Python worker.",
      }).map((skill) => skill.name)[0],
    ).toBe("python-debugger")
  })

  test("refreshes at startup and deterministic assistant intervals", () => {
    expect(DaneelSkillPolicy.shouldRefresh({ userTurns: 1, assistantTurns: 0, agentName: "build" })).toBe(true)
    expect(DaneelSkillPolicy.shouldRefresh({ userTurns: 2, assistantTurns: 3, agentName: "build" })).toBe(true)
    expect(DaneelSkillPolicy.shouldRefresh({ userTurns: 2, assistantTurns: 2, agentName: "build" })).toBe(false)
  })

  test("does not inject skill reminders into title generation", () => {
    expect(DaneelSkillPolicy.shouldRefresh({ userTurns: 1, assistantTurns: 0, agentName: "title" })).toBe(false)
  })

  test("reminder forces skill reading behavior", () => {
    const reminder = DaneelSkillPolicy.sessionReminder({
      skills,
      taskText: "Review React UI state and accessibility.",
      userTurns: 1,
      assistantTurns: 0,
      agentName: "build",
    })

    expect(reminder).toContain("<daneel-skill-reminder")
    expect(reminder).toContain("Skills are high-priority Daneel abilities")
    expect(reminder).toContain("skill({ \"name\": \"<skill-name>\" })")
    expect(reminder).toContain("react-ui-review")
  })
})
