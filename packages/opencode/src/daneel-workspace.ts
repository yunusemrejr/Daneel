import fs from "node:fs/promises"
import path from "node:path"
import { Effect } from "effect"

const STORE_DIR = "." + "daneel"
const STATE_FILE = "memory" + ".md"
const GOAL_FILE = "goal-autoresearch" + ".md"
const RUN_DIR = "sessions"
const MAX_CONTEXT_CHARS = 12_000

export type DaneelWorkspaceTurnInput = {
  workspaceRoot: string
  workingDirectory?: string
  sessionID: string
  messageID: string
  agent?: string
  model?: string
  userText: string
  changedFiles?: string[]
}

function hasCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === code
}

async function writeFileIfMissing(filepath: string, content: string) {
  try {
    await fs.writeFile(filepath, content, { flag: "wx" })
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error
  }
}

async function readLimited(filepath: string) {
  try {
    const value = await fs.readFile(filepath, "utf8")
    if (value.length <= MAX_CONTEXT_CHARS) return value
    return "[older Daneel notes omitted]\n" + value.slice(value.length - MAX_CONTEXT_CHARS)
  } catch (error) {
    if (hasCode(error, "ENOENT")) return ""
    throw error
  }
}

async function ensureProject(workspaceRoot: string) {
  const root = path.resolve(workspaceRoot)
  const dir = path.join(root, STORE_DIR)
  const sessions = path.join(dir, RUN_DIR)
  const state = path.join(dir, STATE_FILE)
  const goal = path.join(dir, GOAL_FILE)

  await fs.mkdir(sessions, { recursive: true })
  await writeFileIfMissing(path.join(dir, ".gitignore"), "*\n")
  await writeFileIfMissing(
    path.join(dir, "README.md"),
    "# Daneel workspace notes\n\nDaneel creates this hidden folder automatically inside every workspace it operates in.\n",
  )
  await writeFileIfMissing(state, "# Daneel workspace notes\n\nUse ISO-8601 timestamped sections.\n\n")
  await writeFileIfMissing(goal, "# Daneel goal autoresearch notes\n\nUse ISO-8601 timestamped sections.\n\n")
  return { root, dir, state, goal, sessions }
}

async function readSystemUnsafe(input: { workspaceRoot: string }) {
  const paths = await ensureProject(input.workspaceRoot)
  const [state, goal] = await Promise.all([readLimited(paths.state), readLimited(paths.goal)])
  await fs.appendFile(
    path.join(paths.sessions, "context-loads.jsonl"),
    JSON.stringify({
      schema: "daneel.workspace.context.v1",
      timestamp: new Date().toISOString(),
      kind: "context-load",
      workspace_root: paths.root,
    }) + "\n",
    "utf8",
  )

  return [
    `<daneel_workspace_notes importance="high">`,
    `Path: ${paths.dir}`,
    `Daneel persists workspace notes here and treats them as important context for current and future sessions.`,
    `Update ${STORE_DIR}/${STATE_FILE} or ${STORE_DIR}/${GOAL_FILE} with ISO-8601 timestamped notes when durable goal context changes.`,
    "",
    `--- ${STORE_DIR}/${STATE_FILE} ---`,
    state.trim() || "[empty]",
    `--- end ${STATE_FILE} ---`,
    "",
    `--- ${STORE_DIR}/${GOAL_FILE} ---`,
    goal.trim() || "[empty]",
    `--- end ${GOAL_FILE} ---`,
    `</daneel_workspace_notes>`,
  ].join("\n")
}

export const DaneelWorkspace = {
  readSystem: Effect.fn("DaneelWorkspace.readSystem")(function* (input: { workspaceRoot: string }) {
    return yield* Effect.promise(() => readSystemUnsafe(input)).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
  }),

  writeTurn: Effect.fn("DaneelWorkspace.writeTurn")(function* (_input: DaneelWorkspaceTurnInput) {
    return undefined
  }),
}
