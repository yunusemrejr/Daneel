import fs from "node:fs/promises"
import path from "node:path"
import { Cause, Effect } from "effect"

const STORE_DIR = "." + "daneel"
const STATE_FILE = "memory" + ".md"
const GOAL_FILE = "goal-autoresearch" + ".md"
const RUN_DIR = "sessions"
const MAX_CONTEXT_CHARS = 12_000
const MAX_NOTE_CHARS = 2_000
const MAX_SUMMARY_CHARS = 700

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

type WorkspacePaths = {
  root: string
  dir: string
  state: string
  goal: string
  sessions: string
}

function hasCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === code
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "unknown"
}

function trim(value: string, limit: number) {
  if (value.length <= limit) return value
  return value.slice(0, limit - 15).trimEnd() + "\n[truncated]"
}

function oneLine(value: string, limit = MAX_SUMMARY_CHARS) {
  return trim(value.replace(/\s+/g, " ").trim(), limit)
}

function redact(value: string) {
  return value.replace(/(([a-z0-9_-]*(key|token|secret)[a-z0-9_-]*)\s*[:=]\s*)[^\s`'\"]{8,}/gi, "$1[REDACTED]")
}

function cleanNote(value: string) {
  return trim(redact(value).replace(/\u0000/g, "").trim(), MAX_NOTE_CHARS)
}

function isGoalText(value: string) {
  return /Daneel persistent goal mode has been requested/i.test(value) || /^\s*\/goal\b/im.test(value)
}

function extractGoal(value: string) {
  const match = value.match(/Goal:\s*([\s\S]*?)\n\s*Behavior:/i)
  return cleanNote(match?.[1] ?? value)
}

function uniqueFiles(files: string[] | undefined) {
  if (!files?.length) return []
  return [...new Set(files.map((file) => file.trim()).filter(Boolean))].slice(0, 50)
}

async function writeFileIfMissing(filepath: string, content: string) {
  try {
    await fs.writeFile(filepath, content, { flag: "wx" })
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error
  }
}

async function readLimited(filepath: string, limit: number) {
  try {
    const value = await fs.readFile(filepath, "utf8")
    if (value.length <= limit) return value
    return "[older Daneel notes omitted]\n" + value.slice(value.length - limit)
  } catch (error) {
    if (hasCode(error, "ENOENT")) return ""
    throw error
  }
}

async function append(filepath: string, content: string) {
  await fs.appendFile(filepath, content, "utf8")
}

async function ensureProject(workspaceRoot: string): Promise<WorkspacePaths> {
  const root = path.resolve(workspaceRoot)
  const dir = path.join(root, STORE_DIR)
  const sessions = path.join(dir, RUN_DIR)
  const state = path.join(dir, STATE_FILE)
  const goal = path.join(dir, GOAL_FILE)

  await fs.mkdir(sessions, { recursive: true })
  await writeFileIfMissing(path.join(dir, ".gitignore"), "*\n")
  await writeFileIfMissing(
    path.join(dir, "README.md"),
    [
      "# Daneel workspace notes",
      "",
      "Daneel creates this hidden folder automatically inside every workspace it operates in.",
      "It stores timestamped notes, goal context, and per-session JSONL traces for in-session and future reference.",
      "",
      "These files are local working state. Verify important claims against the current repository before acting on them.",
      "",
    ].join("\n"),
  )
  await writeFileIfMissing(
    state,
    [
      "# Daneel workspace notes",
      "",
      "This file is maintained by Daneel runtime and may also be updated by Daneel agents.",
      "Format: timestamped markdown sections. Keep notes concise, factual, and useful for future sessions.",
      "",
    ].join("\n"),
  )
  await writeFileIfMissing(
    goal,
    [
      "# Daneel goal autoresearch notes",
      "",
      "This file tracks goal-mode research, decisions, blockers, evidence, and judge-relevant notes.",
      "Daneel reads it as high-priority workspace context on later turns and later sessions.",
      "",
    ].join("\n"),
  )

  return { root, dir, state, goal, sessions }
}

async function readSystemUnsafe(input: { workspaceRoot: string }) {
  const paths = await ensureProject(input.workspaceRoot)
  const [state, goal] = await Promise.all([
    readLimited(paths.state, MAX_CONTEXT_CHARS),
    readLimited(paths.goal, MAX_CONTEXT_CHARS),
  ])

  return [
    `<daneel_workspace_notes importance="high">`,
    `Path: ${paths.dir}`,
    `Daneel automatically persists workspace notes here. Treat this as important project context for current and future sessions.`,
    `Use it for goal continuity, blockers, decisions, evidence, and notes. Current files and tests still override stale notes.`,
    `When you learn something durable during goal work, update ${STORE_DIR}/${STATE_FILE} or ${STORE_DIR}/${GOAL_FILE} with an ISO-8601 timestamp.`,
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

async function writeTurnUnsafe(input: DaneelWorkspaceTurnInput) {
  const paths = await ensureProject(input.workspaceRoot)
  const timestamp = new Date().toISOString()
  const goal = isGoalText(input.userText)
  const note = goal ? extractGoal(input.userText) : cleanNote(input.userText)
  const changedFiles = uniqueFiles(input.changedFiles)
  const kind = goal ? "goal_update" : "turn_note"
  const record = {
    schema: "daneel.workspace.turn.v1",
    timestamp,
    kind,
    workspace_root: paths.root,
    cwd: input.workingDirectory ? path.resolve(input.workingDirectory) : paths.root,
    session_id: input.sessionID,
    message_id: input.messageID,
    agent: input.agent,
    model: input.model,
    summary: oneLine(note),
    changed_files: changedFiles,
  }

  const sessionPath = path.join(paths.sessions, `${safeSegment(input.sessionID)}.jsonl`)
  await append(sessionPath, JSON.stringify(record) + "\n")

  const changed = changedFiles.length === 0 ? "none recorded" : changedFiles.map((file) => `\`${file}\``).join(", ")
  await append(
    paths.state,
    [
      `## ${timestamp} — ${kind}`,
      `- Session: ${input.sessionID}`,
      `- Message: ${input.messageID}`,
      input.agent ? `- Agent: ${input.agent}` : undefined,
      input.model ? `- Model: ${input.model}` : undefined,
      `- Working directory: ${record.cwd}`,
      `- Changed files: ${changed}`,
      `- Note: ${note || "[empty]"}`,
      "",
    ]
      .filter((line): line is string => line !== undefined)
      .join("\n"),
  )

  if (goal) {
    await append(
      paths.goal,
      [
        `## ${timestamp} — active goal update`,
        `- Session: ${input.sessionID}`,
        `- Message: ${input.messageID}`,
        "",
        "### Goal / user update",
        note || "[empty]",
        "",
        "### Runtime rule",
        `Daneel should keep ${STORE_DIR}/${GOAL_FILE}, ${STORE_DIR}/${STATE_FILE}, and ${STORE_DIR}/${RUN_DIR}/${safeSegment(input.sessionID)}.jsonl useful for continuity and judge review.`,
        "",
      ].join("\n"),
    )
  }
}

export const DaneelWorkspace = {
  readSystem: Effect.fn("DaneelWorkspace.readSystem")(function* (input: { workspaceRoot: string }) {
    return yield* Effect.promise(() => readSystemUnsafe(input)).pipe(
      Effect.catchCause((cause) =>
        Effect.gen(function* () {
          yield* Effect.logWarning("failed to read Daneel workspace notes", { error: String(Cause.squash(cause)) })
          return undefined
        }),
      ),
    )
  }),

  writeTurn: Effect.fn("DaneelWorkspace.writeTurn")(function* (input: DaneelWorkspaceTurnInput) {
    yield* Effect.promise(() => writeTurnUnsafe(input)).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("failed to write Daneel workspace notes", { error: String(Cause.squash(cause)) }),
      ),
    )
  }),
}
