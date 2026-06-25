import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import type { ModelsDev } from "@opencode-ai/schema/models-dev"

const here = path.dirname(fileURLToPath(import.meta.url))
const fusionProviderModule = pathToFileURL(path.join(here, "../../../opencode/src/daneel/fusion-provider.ts")).href
const endpointProviderModule = pathToFileURL(path.join(here, "../../../opencode/src/daneel/endpoint-fallback-provider.ts")).href

function textModel(input: {
  id: string
  name: string
  family: string
  context: number
  output: number
  reasoning?: boolean
  tool_call?: boolean
}): ModelsDev.Model {
  return {
    id: input.id,
    name: input.name,
    family: input.family,
    release_date: "",
    attachment: false,
    reasoning: input.reasoning ?? true,
    temperature: true,
    tool_call: input.tool_call ?? true,
    limit: {
      context: input.context,
      output: input.output,
    },
    modalities: {
      input: ["text"],
      output: ["text"],
    },
  }
}

export const DaneelProviderCatalog = {
  "streamlake-kat-coding-plan": {
    id: "streamlake-kat-coding-plan",
    name: "StreamLake KAT Coding Plan International",
    env: ["STREAMLAKE_API_KEY"],
    npm: endpointProviderModule,
    api: "https://wanqing.streamlakeapi.com/api/gateway/coding/v1",
    models: {
      "kat-coder-pro-v2": textModel({
        id: "kat-coder-pro-v2",
        name: "KAT Coder Pro V2",
        family: "kat-coder",
        context: 256000,
        output: 32768,
      }),
    },
  },
  "stepfun-step-plan": {
    id: "stepfun-step-plan",
    name: "StepFun Step Plan",
    env: ["STEPFUN_API_KEY"],
    npm: endpointProviderModule,
    api: "https://api.stepfun.ai/step_plan/v1",
    models: {
      "step-3.7-flash": textModel({
        id: "step-3.7-flash",
        name: "Step 3.7 Flash",
        family: "stepfun",
        context: 256000,
        output: 32768,
      }),
    },
  },
  "kimi-code-subscription": {
    id: "kimi-code-subscription",
    name: "Kimi Code Subscription",
    env: ["KIMI_CODE_API_KEY"],
    npm: endpointProviderModule,
    api: "https://api.kimi.com/coding/v1",
    models: {
      "kimi-for-coding": textModel({
        id: "kimi-for-coding",
        name: "Kimi for Coding",
        family: "kimi-code",
        context: 262144,
        output: 32768,
      }),
    },
  },
  "minimax-token-plan": {
    id: "minimax-token-plan",
    name: "MiniMax M3 Token Plan",
    env: ["MINIMAX_API_KEY"],
    npm: endpointProviderModule,
    api: "https://api.minimax.io/v1",
    models: {
      "MiniMax-M3": textModel({
        id: "MiniMax-M3",
        name: "MiniMax M3",
        family: "minimax-m3",
        context: 1000000,
        output: 32768,
      }),
    },
  },
  "nvidia-build-nim": {
    id: "nvidia-build-nim",
    name: "NVIDIA Build NIM",
    env: ["NVIDIA_API_KEY"],
    npm: endpointProviderModule,
    api: "https://integrate.api.nvidia.com/v1",
    models: {
      "nvidia/nemotron-3-ultra-550b-a55b": textModel({
        id: "nvidia/nemotron-3-ultra-550b-a55b",
        name: "Nemotron 3 Ultra 550B",
        family: "nemotron",
        context: 1000000,
        output: 16384,
      }),
    },
  },
  "xiaomi-mimo-token-plan": {
    id: "xiaomi-mimo-token-plan",
    name: "Xiaomi MiMo Token Plan",
    env: ["MIMO_API_KEY"],
    npm: endpointProviderModule,
    api: "https://api.xiaomimimo.com/v1",
    models: {
      "mimo-v2.5-pro": textModel({
        id: "mimo-v2.5-pro",
        name: "MiMo V2.5 Pro",
        family: "mimo",
        context: 256000,
        output: 32768,
      }),
    },
  },
  "deepseek-direct": {
    id: "deepseek-direct",
    name: "DeepSeek Direct API",
    env: ["DEEPSEEK_API_KEY"],
    npm: endpointProviderModule,
    api: "https://api.deepseek.com",
    models: {
      "deepseek-v4-flash": textModel({
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        family: "deepseek",
        context: 128000,
        output: 8192,
      }),
      "deepseek-v4-pro": textModel({
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        family: "deepseek",
        context: 128000,
        output: 8192,
      }),
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
      fusion: textModel({
        id: "fusion",
        name: "Fusion",
        family: "daneel-fusion",
        context: 256000,
        output: 32768,
      }),
    },
  },
} satisfies Record<string, ModelsDev.Provider>
