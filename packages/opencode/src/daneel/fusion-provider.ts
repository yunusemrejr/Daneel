import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { selectFusionRoster } from "./fusion-roster"

function currentLanguageModel() {
  const candidate = selectFusionRoster()[0]
  if (!candidate) {
    throw new Error("Daneel Fusion needs at least one configured provider key before it can select a model.")
  }

  const sdk = createOpenAICompatible({
    name: `daneel-fusion-${candidate.id}`,
    baseURL: candidate.baseURL,
    apiKey: process.env[candidate.env],
    headers: candidate.headers,
  }) as any

  if (typeof sdk.chat === "function") return sdk.chat(candidate.model)
  if (typeof sdk.chatModel === "function") return sdk.chatModel(candidate.model)
  return sdk.languageModel(candidate.model)
}

export function createDaneelFusion() {
  return {
    languageModel() {
      return currentLanguageModel()
    },
    chat() {
      return currentLanguageModel()
    },
    responses() {
      return currentLanguageModel()
    },
  }
}
