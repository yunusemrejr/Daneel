import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { fallbackBaseURLs } from "@opencode-ai/core/daneel/provider-endpoints"

type EndpointAwareOptions = Parameters<typeof createOpenAICompatible>[0] & {
  name: string
  baseURL?: string
  knownBaseURLs?: string[]
  fallbackBaseURLs?: string[]
  fetch?: typeof fetch
}

function shouldTryNext(status: number) {
  return status === 404 || status === 408 || status === 502 || status === 503 || status === 504
}

function replaceBase(input: RequestInfo | URL, from: string | undefined, to: string): RequestInfo | URL {
  if (!from) return input
  const source = input instanceof Request ? input.url : input.toString()
  if (!source.startsWith(from)) return input
  const next = to + source.slice(from.length)
  if (input instanceof Request) return new Request(next, input)
  if (input instanceof URL) return new URL(next)
  return next
}

export function createDaneelEndpointProvider(options: EndpointAwareOptions) {
  const active = typeof options.baseURL === "string" && options.baseURL.length > 0 ? options.baseURL : undefined
  const alternates = fallbackBaseURLs(options.name, options.fallbackBaseURLs, active)
  const upstream = options.fetch ?? fetch
  const clean = { ...options } as Record<string, unknown>

  delete clean.knownBaseURLs
  delete clean.fallbackBaseURLs

  clean.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const targets = [undefined, ...alternates]
    let lastError: unknown

    for (let index = 0; index < targets.length; index++) {
      const target = targets[index]
      const nextInput = target ? replaceBase(input, active, target) : input
      try {
        const response = await upstream(nextInput, init)
        if (index === targets.length - 1 || !shouldTryNext(response.status)) return response
        await response.arrayBuffer().catch(() => undefined)
      } catch (error) {
        lastError = error
        if (index === targets.length - 1) throw error
      }
    }

    throw lastError
  }

  return createOpenAICompatible(clean as Parameters<typeof createOpenAICompatible>[0])
}
