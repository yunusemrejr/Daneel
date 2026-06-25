import { describe, expect, test } from "bun:test"
import { DaneelTemporaryAgentPolicy } from "./temp-agent-policy"

const providers = {
  openrouter: {
    id: "openrouter",
    models: {
      "anthropic/claude-sonnet": {
        id: "anthropic/claude-sonnet",
        providerID: "openrouter",
        status: "active",
        capabilities: { output: { text: true } },
        cost: { input: 0.000003, output: 0.000015 },
      },
    },
  },
  "streamlake-kat-coding-plan": {
    id: "streamlake-kat-coding-plan",
    models: {
      "kat-coder-pro-v2": {
        id: "kat-coder-pro-v2",
        providerID: "streamlake-kat-coding-plan",
        status: "active",
        capabilities: { output: { text: true } },
        cost: { input: 0, output: 0 },
      },
    },
  },
  "stepfun-step-plan": {
    id: "stepfun-step-plan",
    models: {
      "step-3.7-flash": {
        id: "step-3.7-flash",
        providerID: "stepfun-step-plan",
        status: "active",
        capabilities: { output: { text: true } },
        cost: { input: 0, output: 0 },
      },
    },
  },
}

describe("Daneel temporary agent policy", () => {
  test("classifies cheap fast coding models", () => {
    expect(DaneelTemporaryAgentPolicy.classifyProviderModel("stepfun-step-plan", "step-3.7-flash")).toBe(
      "cheap-fast",
    )
    expect(
      DaneelTemporaryAgentPolicy.classifyProviderModel("streamlake-kat-coding-plan", "kat-coder-pro-v2"),
    ).toBe("cheap-fast")
    expect(DaneelTemporaryAgentPolicy.classifyProviderModel("deepseek", "deepseek-v4-flash")).toBe(
      "cheap-fast",
    )
  })

  test("treats OpenRouter and frontier providers as last resort", () => {
    expect(DaneelTemporaryAgentPolicy.classifyProviderModel("openrouter", "anthropic/claude-sonnet")).toBe(
      "last-resort",
    )
    expect(DaneelTemporaryAgentPolicy.classifyProviderModel("xai", "grok-4")).toBe("last-resort")
    expect(DaneelTemporaryAgentPolicy.classifyProviderModel("google", "gemini-3-pro")).toBe("last-resort")
  })

  test("selects configured cheap models before OpenRouter", () => {
    expect(DaneelTemporaryAgentPolicy.selectCostOptimizedModel({ providers })).toEqual({
      providerID: "streamlake-kat-coding-plan",
      modelID: "kat-coder-pro-v2",
    })
  })

  test("creates a temporary agent when requested type is not configured", () => {
    const selection = DaneelTemporaryAgentPolicy.resolveAgent({
      requestedType: "fast-boring-reviewer",
      providers,
      mainModel: { providerID: "openai", modelID: "gpt-5.5" },
      agents: [
        {
          name: "general",
          mode: "subagent",
          permission: [],
          options: {},
        },
      ],
    })

    expect(selection?.kind).toBe("temporary")
    expect(selection?.agent.name).toBe("daneel-temp-fast-boring-reviewer")
    expect(selection?.agent.model).toEqual({ providerID: "streamlake-kat-coding-plan", modelID: "kat-coder-pro-v2" })
    expect(selection?.requiresApproval).toBe(true)
  })

  test("parses secondary approval JSON from noisy model output", () => {
    const decision = DaneelTemporaryAgentPolicy.parseApprovalDecision(
      '```json\n{"approved":false,"reason":"too expensive","replacement_model":"stepfun-step-plan/step-3.7-flash"}\n```',
    )
    expect(decision).toEqual({
      approved: false,
      reason: "too expensive",
      replacement_subagent_type: null,
      replacement_model: "stepfun-step-plan/step-3.7-flash",
    })
  })
})
