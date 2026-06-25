type SkillLike = {
  name: string
  description?: string
  location?: string
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "use",
  "when",
  "with",
])

function tokens(value: string | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 && !STOP_WORDS.has(item))
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

export function scoreSkill(input: { skill: SkillLike; taskText: string }) {
  const taskTokens = unique(tokens(input.taskText))
  const skillTokens = unique(tokens([input.skill.name, input.skill.description, input.skill.location].join(" ")))
  if (skillTokens.length === 0) return 0
  if (taskTokens.length === 0) return 1

  const task = new Set(taskTokens)
  let score = 0
  for (const item of skillTokens) {
    if (task.has(item)) score += 4
  }

  const compactTask = input.taskText.toLowerCase()
  const name = input.skill.name.toLowerCase()
  if (name && compactTask.includes(name)) score += 20

  for (const item of tokens(input.skill.name)) {
    if (compactTask.includes(item)) score += 5
  }

  return score
}

export function selectRelevant(input: { skills: SkillLike[]; taskText: string; limit?: number }) {
  const limit = input.limit ?? 5
  return input.skills
    .map((skill) => ({ skill, score: scoreSkill({ skill, taskText: input.taskText }) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .slice(0, limit)
    .map((item) => item.skill)
}

export function shouldRefresh(input: { userTurns: number; assistantTurns: number; agentName: string }) {
  if (input.agentName === "title") return false
  if (input.assistantTurns === 0) return true
  if (input.assistantTurns % 3 === 0) return true
  if (input.userTurns % 4 === 0) return true
  return false
}

export function reminderTag(input: { userTurns: number; assistantTurns: number }) {
  return `<daneel-skill-reminder turn="${input.userTurns}" assistant_turn="${input.assistantTurns}">`
}

export function sessionReminder(input: {
  skills: SkillLike[]
  taskText: string
  userTurns: number
  assistantTurns: number
  agentName: string
}) {
  if (!shouldRefresh(input)) return undefined

  const selected = selectRelevant({ skills: input.skills, taskText: input.taskText, limit: 5 })
  const candidates = selected.length > 0 ? selected : input.skills.toSorted((a, b) => a.name.localeCompare(b.name)).slice(0, 5)
  const tag = reminderTag(input)
  const candidateLines = candidates.map((item) => `- ${item.name}${item.description ? `: ${item.description}` : ""}`).join("\n")

  return `${tag}
Skills are high-priority Daneel abilities, not startup decoration.

Before continuing, compare the current task with the available skills. If a listed skill is plausibly relevant, call the skill tool now, read the skill, and apply its workflow or knowledge. If you skip a plausible skill, keep the reason explicit in your working notes or tool-result summary.

Relevant skill candidates for this turn:
${candidateLines || "- Check the available skill list for the current session."}

Use the tool call shape: skill({ "name": "<skill-name>" }).
</daneel-skill-reminder>`
}

export const DaneelSkillPolicy = {
  scoreSkill,
  selectRelevant,
  shouldRefresh,
  reminderTag,
  sessionReminder,
}
