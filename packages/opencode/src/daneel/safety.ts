import os from "os"
import path from "path"

export type DaneelPolicyAction = "allow" | "deny"

export type DaneelShellClass =
  | "read-only"
  | "safe-write"
  | "workspace-boundary-sensitive"
  | "destructive"
  | "credential-sensitive"
  | "network-sensitive"
  | "system-sensitive"
  | "unknown"

export type DaneelShellDecision = {
  action: DaneelPolicyAction
  class: DaneelShellClass
  reason: string
  commandPreview: string
  evidence: string[]
}

const redactPatterns = [
  /(Authorization:\s*Bearer\s+)[^\s'\"]+/gi,
  /((?:api[-_]?key|token|secret|password)\s*[=:]\s*)[^\s'\"]+/gi,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bnvapi-[A-Za-z0-9_-]{12,}\b/g,
]

const privilegeCommands = new Set(["sudo", "su", "doas", "pkexec"])
const systemCommands = new Set([
  "mkfs",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  "systemctl",
  "service",
  "iptables",
  "ufw",
  "mount",
  "umount",
  "diskutil",
])
const remoteFetchCommands = new Set(["curl", "wget", "fetch"])
const shellInterpreters = new Set(["sh", "bash", "zsh", "fish", "dash", "powershell", "pwsh"])
const mutatingCommands = new Set([
  "rm",
  "del",
  "erase",
  "rmdir",
  "rd",
  "cp",
  "copy",
  "mv",
  "move",
  "mkdir",
  "md",
  "touch",
  "chmod",
  "chown",
  "tee",
  "truncate",
])
const readSecretCommands = new Set(["cat", "less", "more", "head", "tail", "sed", "awk", "grep", "rg", "type"])
const separators = new Set([";", "&&", "||", "|", "&"])
const redirections = new Set([">", ">>", "1>", "1>>", "2>", "2>>"])

function redact(value: string) {
  return redactPatterns.reduce((result, pattern) => result.replace(pattern, "$1[REDACTED]"), value)
}

function previewCommand(command: string) {
  const safe = redact(command.replace(/\s+/g, " ").trim())
  return safe.length > 300 ? safe.slice(0, 297) + "..." : safe
}

function lowerCommand(token: string | undefined) {
  if (!token) return ""
  const base = token.split(/[\\/]/).pop() ?? token
  return base.toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/i, "")
}

function hasShellMeta(value: string) {
  return /[$`]|\$\{|\$\(/.test(value)
}

function expandHome(value: string) {
  if (value === "~") return os.homedir()
  if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(os.homedir(), value.slice(2))
  return value
}

function isPathLike(value: string) {
  return (
    value === "." ||
    value === ".." ||
    value === "~" ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("~/") ||
    value.startsWith("~\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.includes("/") ||
    value.includes("\\")
  )
}

function isInside(child: string, root: string) {
  const resolvedRoot = path.resolve(root)
  const resolvedChild = path.resolve(child)
  return resolvedChild === resolvedRoot || resolvedChild.startsWith(resolvedRoot + path.sep)
}

function normalizeCandidatePath(value: string, cwd: string) {
  if (!value || value.startsWith("-")) return undefined
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(value)) return undefined
  if (/^[0-9]+$/.test(value)) return undefined
  const cleaned = value.replace(/[;,]+$/g, "")
  if (hasShellMeta(cleaned)) return "dynamic"
  if (!isPathLike(cleaned)) return path.resolve(cwd, cleaned)
  return path.resolve(cwd, expandHome(cleaned))
}

export function tokenizeShell(command: string) {
  const out: string[] = []
  let current = ""
  let quote: "'" | '"' | undefined
  let escaped = false

  const flush = () => {
    if (!current) return
    out.push(current)
    current = ""
  }

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    const next = command[i + 1]

    if (escaped) {
      current += ch
      escaped = false
      continue
    }
    if (ch === "\\") {
      escaped = true
      continue
    }
    if (quote) {
      if (ch === quote) quote = undefined
      else current += ch
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      continue
    }
    if (/\s/.test(ch)) {
      flush()
      continue
    }
    if ((ch === "&" && next === "&") || (ch === "|" && next === "|") || (ch === ">" && next === ">")) {
      flush()
      out.push(ch + next)
      i++
      continue
    }
    if (ch === ";" || ch === "|" || ch === "&" || ch === ">") {
      flush()
      out.push(ch)
      continue
    }
    current += ch
  }
  flush()
  return out
}

function commandSlices(tokens: string[]) {
  const slices: string[][] = []
  let current: string[] = []
  for (const token of tokens) {
    if (separators.has(token)) {
      if (current.length) slices.push(current)
      current = []
      continue
    }
    current.push(token)
  }
  if (current.length) slices.push(current)
  return slices
}

function flagText(tokens: string[]) {
  return tokens.filter((token) => token.startsWith("-")).join("")
}

function hasRecursiveFlag(tokens: string[]) {
  const flags = flagText(tokens)
  return /(^|-)R\b/.test(flags) || /--recursive\b/.test(flags) || /^-[A-Za-z]*r/i.test(flags)
}

function hasForceFlag(tokens: string[]) {
  const flags = flagText(tokens)
  return /--force\b/.test(flags) || /^-[A-Za-z]*f/i.test(flags)
}

function isBroadTarget(value: string) {
  return ["/", ".", "..", "~", "*", "./*", "../*", "$HOME", "$PWD"].includes(value)
}

function argsAfterCommand(slice: string[]) {
  return slice.slice(1).filter((token) => !redirections.has(token))
}

function pathEscapesWorkspace(value: string, cwd: string, workspaceRoot: string) {
  const normalized = normalizeCandidatePath(value, cwd)
  if (!normalized) return false
  if (normalized === "dynamic") return true
  return !isInside(normalized, workspaceRoot)
}

function secretPath(value: string) {
  const normalized = value.toLowerCase()
  return (
    /(^|[/\\])\.env($|[.\-/\\])/.test(normalized) ||
    normalized.includes("/.ssh/") ||
    normalized.includes("\\.ssh\\") ||
    normalized.includes("/.aws/") ||
    normalized.includes("\\.aws\\") ||
    normalized.includes("/.gnupg/") ||
    normalized.includes("\\.gnupg\\") ||
    normalized.endsWith("/.npmrc") ||
    normalized.endsWith("\\.npmrc") ||
    normalized.endsWith("/.pypirc") ||
    normalized.endsWith("\\.pypirc")
  )
}

function deny(className: DaneelShellClass, reason: string, command: string, evidence: string[]): DaneelShellDecision {
  return { action: "deny", class: className, reason, commandPreview: previewCommand(command), evidence }
}

function allow(command: string, evidence: string[] = ["no hard Daneel deny rule matched"]): DaneelShellDecision {
  return {
    action: "allow",
    class: "read-only",
    reason: "Command passed Daneel hard safety preflight; normal permission checks still apply.",
    commandPreview: previewCommand(command),
    evidence,
  }
}

function hasRemoteInstallPipe(tokens: string[]) {
  for (let i = 0; i < tokens.length; i++) {
    if (!remoteFetchCommands.has(lowerCommand(tokens[i]))) continue
    const pipe = tokens.indexOf("|", i + 1)
    if (pipe === -1) continue
    const next = lowerCommand(tokens[pipe + 1])
    if (shellInterpreters.has(next)) return true
  }
  return false
}

function classifySlice(slice: string[], command: string, cwd: string, workspaceRoot: string): DaneelShellDecision | undefined {
  const name = lowerCommand(slice[0])
  const args = argsAfterCommand(slice)

  if (!name) return undefined
  if (privilegeCommands.has(name)) {
    return deny("system-sensitive", "Blocked privilege escalation; Daneel does not mutate the host with elevated privileges.", command, [name])
  }
  if (systemCommands.has(name)) {
    return deny("system-sensitive", "Blocked host/system mutation command.", command, [name])
  }
  if (name === "dd") {
    return deny("destructive", "Blocked raw block-copy command; it is too easy to target disks or secret files.", command, [name])
  }

  if (name === "rm" || name === "del" || name === "erase" || name === "rmdir" || name === "rd") {
    if (hasRecursiveFlag(args)) {
      return deny("destructive", "Blocked recursive deletion; use a reversible workspace-local cleanup plan instead.", command, [
        "recursive-delete",
      ])
    }
    if (args.some(isBroadTarget)) {
      return deny("destructive", "Blocked broad deletion target.", command, args.filter(isBroadTarget))
    }
  }

  if (name === "git" && args[0] === "clean" && (hasForceFlag(args) || hasRecursiveFlag(args))) {
    return deny("destructive", "Blocked forced git clean; it can erase untracked user work.", command, ["git clean"])
  }
  if (name === "git" && args[0] === "push" && args.some((arg) => arg === "--force" || arg === "--force-with-lease" || arg === "-f")) {
    return deny("destructive", "Blocked force push from an autonomous harness path.", command, ["git push force"])
  }

  if (name === "chmod" && hasRecursiveFlag(args) && args.some((arg) => arg === "777" || arg.endsWith("=rwx"))) {
    return deny("destructive", "Blocked recursive broad permission change.", command, ["chmod recursive broad"])
  }
  if (name === "chown" && hasRecursiveFlag(args)) {
    return deny("destructive", "Blocked recursive ownership change.", command, ["chown recursive"])
  }

  if (readSecretCommands.has(name) && args.some(secretPath)) {
    return deny("credential-sensitive", "Blocked command that would print or scan secret-bearing paths.", command, args.filter(secretPath))
  }

  if (mutatingCommands.has(name)) {
    if (!isInside(cwd, workspaceRoot)) {
      return deny("workspace-boundary-sensitive", "Blocked mutating command from outside the workspace root.", command, [cwd])
    }
    const escaped = args.filter((arg) => !arg.startsWith("-") && pathEscapesWorkspace(arg, cwd, workspaceRoot))
    if (escaped.length > 0) {
      return deny("workspace-boundary-sensitive", "Blocked mutating command targeting outside the workspace.", command, escaped)
    }
  }

  for (let i = 0; i < slice.length; i++) {
    if (!redirections.has(slice[i])) continue
    const target = slice[i + 1]
    if (target && pathEscapesWorkspace(target, cwd, workspaceRoot)) {
      return deny("workspace-boundary-sensitive", "Blocked shell redirection outside the workspace.", command, [target])
    }
  }

  return undefined
}

export function classifyShellCommand(input: {
  command: string
  cwd: string
  workspaceRoot: string
}): DaneelShellDecision {
  const command = input.command.trim()
  if (!command) return allow(input.command, ["empty command"])

  const cwd = path.resolve(input.cwd)
  const workspaceRoot = path.resolve(input.workspaceRoot)
  const tokens = tokenizeShell(command)
  if (tokens.length === 0) return allow(command, ["no shell tokens"])

  if (hasRemoteInstallPipe(tokens)) {
    return deny("network-sensitive", "Blocked network download piped directly into a shell interpreter.", command, [
      "remote-fetch-pipe-shell",
    ])
  }

  for (const slice of commandSlices(tokens)) {
    const decision = classifySlice(slice, command, cwd, workspaceRoot)
    if (decision) return decision
  }

  return allow(command, ["hard preflight passed", `workspace=${workspaceRoot}`])
}

export function formatDeniedShellOutput(decision: DaneelShellDecision) {
  return [
    "DENIED_BY_DANEEL_POLICY",
    `class: ${decision.class}`,
    `reason: ${decision.reason}`,
    `command_preview: ${decision.commandPreview}`,
    `evidence: ${decision.evidence.join(", ") || "none"}`,
    "",
    "Continue autonomously with a reversible, workspace-local, non-root alternative. If the task truly requires host administration, write exact manual instructions instead of executing it.",
  ].join("\n")
}

export const DaneelShellSafety = {
  tokenizeShell,
  classifyShellCommand,
  formatDeniedShellOutput,
}
