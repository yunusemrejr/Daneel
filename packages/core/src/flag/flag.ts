import { Config } from "effect"

function value(key: string) {
  return process.env[key]
}

export function truthy(key: string) {
  const result = value(key)?.toLowerCase()
  return result === "true" || result === "1"
}

const copy = value("DANEEL_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
const fff = value("DANEEL_DISABLE_FFF")

function enabledByExperimental(key: string) {
  return value(key) === undefined ? truthy("DANEEL_EXPERIMENTAL") : truthy(key)
}

const serverPasswordKey = "SERVER_" + "PASSWORD"

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: value("OTEL_EXPORTER_OTLP_ENDPOINT"),
  OTEL_EXPORTER_OTLP_HEADERS: value("OTEL_EXPORTER_OTLP_HEADERS"),

  OPENCODE_AUTO_HEAP_SNAPSHOT: truthy("DANEEL_AUTO_HEAP_SNAPSHOT"),
  OPENCODE_GIT_BASH_PATH: value("DANEEL_GIT_BASH_PATH"),
  OPENCODE_CONFIG: value("DANEEL_CONFIG"),
  OPENCODE_CONFIG_CONTENT: value("DANEEL_CONFIG_CONTENT"),
  OPENCODE_DISABLE_AUTOUPDATE: truthy("DANEEL_DISABLE_AUTOUPDATE"),
  OPENCODE_ALWAYS_NOTIFY_UPDATE: truthy("DANEEL_ALWAYS_NOTIFY_UPDATE"),
  OPENCODE_DISABLE_PRUNE: truthy("DANEEL_DISABLE_PRUNE"),
  OPENCODE_DISABLE_TERMINAL_TITLE: truthy("DANEEL_DISABLE_TERMINAL_TITLE"),
  OPENCODE_SHOW_TTFD: truthy("DANEEL_SHOW_TTFD"),
  OPENCODE_DISABLE_AUTOCOMPACT: truthy("DANEEL_DISABLE_AUTOCOMPACT"),
  OPENCODE_DISABLE_MODELS_FETCH: truthy("DANEEL_DISABLE_MODELS_FETCH"),
  OPENCODE_DISABLE_MOUSE: truthy("DANEEL_DISABLE_MOUSE"),
  OPENCODE_FAKE_VCS: value("DANEEL_FAKE_VCS"),
  ["OPENCODE_" + serverPasswordKey]: value("DANEEL_" + serverPasswordKey),
  OPENCODE_SERVER_USERNAME: value("DANEEL_SERVER_USERNAME"),
  OPENCODE_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("DANEEL_DISABLE_FFF"),

  OPENCODE_EXPERIMENTAL_FILEWATCHER: Config.boolean("DANEEL_EXPERIMENTAL_FILEWATCHER").pipe(Config.withDefault(false)),
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("DANEEL_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("DANEEL_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  OPENCODE_MODELS_URL: value("DANEEL_MODELS_URL"),
  OPENCODE_MODELS_PATH: value("DANEEL_MODELS_PATH"),
  OPENCODE_DB: value("DANEEL_DB"),

  OPENCODE_WORKSPACE_ID: value("DANEEL_WORKSPACE_ID"),
  OPENCODE_EXPERIMENTAL_WORKSPACES: enabledByExperimental("DANEEL_EXPERIMENTAL_WORKSPACES"),

  get OPENCODE_DISABLE_PROJECT_CONFIG() {
    return truthy("DANEEL_DISABLE_PROJECT_CONFIG")
  },
  get OPENCODE_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("DANEEL_EXPERIMENTAL_REFERENCES")
  },
  get OPENCODE_TUI_CONFIG() {
    return value("DANEEL_TUI_CONFIG")
  },
  get OPENCODE_CONFIG_DIR() {
    return value("DANEEL_CONFIG_DIR")
  },
  get OPENCODE_PURE() {
    return truthy("DANEEL_PURE")
  },
  get OPENCODE_PERMISSION() {
    return value("DANEEL_PERMISSION")
  },
  get OPENCODE_PLUGIN_META_FILE() {
    return value("DANEEL_PLUGIN_META_FILE")
  },
  get OPENCODE_CLIENT() {
    return value("DANEEL_CLIENT") ?? "cli"
  },
}
