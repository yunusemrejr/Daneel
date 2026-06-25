import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import type { ModelsDev } from "@opencode-ai/schema/models-dev"

const here = path.dirname(fileURLToPath(import.meta.url))
const fusionProviderModule = pathToFileURL(path.join(here, "../../../opencode/src/daneel/fusion-provider.ts")).href

export const DaneelProviderCatalog = {
  "streamlake-kat-coding-plan": {
    id: "streamlake-kat-coding-plan",
    name: "StreamLake KAT Coding Plan International",
    env: ["STREAMLAKE_API_KEY"],
    npm: "@ai-sdk/openai-compatible",
    api: "https://wanqing.streamlakeapi.com/api/gateway/coding/v1",
    models: {
      "kat-coder-pro-v2": {
        id: "kat-coder-pro-v2",
        name: "KAT Coder Pro V2",
        family: "kat-coder",
        release_date: "",
        attachment: false,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: {
          context: 256000,
          output: 32768,
        },
        modalities: {
          input: ["text"],
          output: ["text"],
        },
      },
    },
  },
  fusion: {
    id: "fusion",
    name: "Daneel Fusion",
    env: [
      "STEPFUN_API_KEY",
      "STREAMLAKE_API_KEY",
      "DEEPSEEK_API_KEY",
      "KIMI_CODE_API_KEY",
      "MINIMAX_API_KEY",
      "NVIDIA_API_KEY",
      "MIMO_API_KEY",
      "OLLAMA_API_KEY",
    ],
    npm: fusionProviderModule,
    api: "daneel:fusion",
    models: {
      fusion: {
        id: "fusion",
        name: "Fusion",
        family: "daneel-fusion",
        release_date: "",
        attachment: false,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: {
          context: 256000,
          output: 32768,
        },
        modalities: {
          input: ["text"],
          output: ["text"],
        },
      },
    },
  },
} satisfies Record<string, ModelsDev.Provider>
