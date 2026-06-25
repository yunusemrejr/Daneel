import { createMemo, createSignal } from "solid-js"
import { useLocal } from "../context/local"
import { map, pipe, flatMap, entries, filter, sortBy, take } from "remeda"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { createDialogProviderOptions, DialogProvider } from "./dialog-provider"
import { DialogVariant } from "./dialog-variant"
import * as fuzzysort from "fuzzysort"
import { useConnected } from "./use-connected"
import { useSync } from "../context/sync"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useSDK } from "../context/sdk"
import { useProject } from "../context/project"
import { useToast } from "../ui/toast"

type ModelChoice = { providerID: string; modelID: string }

export function DialogModel(props: { providerID?: string }) {
  const local = useLocal()
  const sync = useSync()
  const dialog = useDialog()
  const sdk = useSDK()
  const project = useProject()
  const toast = useToast()
  const [query, setQuery] = createSignal("")

  const connected = useConnected()
  const providers = createDialogProviderOptions()

  const showExtra = createMemo(() => connected() && !props.providerID)

  const options = createMemo(() => {
    const needle = query().trim()
    const showSections = showExtra() && needle.length === 0
    const favorites = connected() ? local.model.favorite() : []
    const recents = local.model.recent()

    function toOptions(items: typeof favorites, category: string) {
      if (!showSections) return []
      return items.flatMap((item) => {
        const provider = sync.data.provider.find((provider) => provider.id === item.providerID)
        if (!provider) return []
        const model = provider.models[item.modelID]
        if (!model) return []
        return [
          {
            key: item,
            value: { providerID: provider.id, modelID: model.id },
            title: model.name ?? item.modelID,
            description: provider.name,
            category,
            disabled: provider.id === "opencode" && model.id.includes("-nano"),
            footer: model.cost?.input === 0 && provider.id === "opencode" ? "Free" : undefined,
            onSelect: () => {
              onSelect(provider.id, model.id)
            },
          },
        ]
      })
    }

    const favoriteOptions = toOptions(favorites, "Favorites")
    const recentOptions = toOptions(
      recents.filter(
        (item) => !favorites.some((fav) => fav.providerID === item.providerID && fav.modelID === item.modelID),
      ),
      "Recent",
    )

    const providerOptions = pipe(
      sync.data.provider,
      sortBy(
        (provider) => provider.id !== "opencode",
        (provider) => provider.name,
      ),
      flatMap((provider) =>
        pipe(
          provider.models,
          entries(),
          filter(([_, info]) => info.status !== "deprecated"),
          filter(([_, info]) => (props.providerID ? info.providerID === props.providerID : true)),
          map(([model, info]) => ({
            value: { providerID: provider.id, modelID: model },
            title: info.name ?? model,
            releaseDate: info.release_date,
            description: favorites.some((item) => item.providerID === provider.id && item.modelID === model)
              ? "(Favorite)"
              : undefined,
            category: connected() ? provider.name : undefined,
            disabled: provider.id === "opencode" && model.includes("-nano"),
            footer: info.cost?.input === 0 && provider.id === "opencode" ? "Free" : undefined,
            onSelect() {
              onSelect(provider.id, model)
            },
          })),
          filter((option) => {
            if (!showSections) return true
            if (
              favorites.some(
                (item) => item.providerID === option.value.providerID && item.modelID === option.value.modelID,
              )
            )
              return false
            if (
              recents.some(
                (item) => item.providerID === option.value.providerID && item.modelID === option.value.modelID,
              )
            )
              return false
            return true
          }),
          (options) => sortModelOptions(options, props.providerID !== undefined),
        ),
      ),
    )

    const popularProviders = !connected()
      ? pipe(
          providers(),
          map((option) => ({
            ...option,
            category: "Popular providers",
          })),
          take(6),
        )
      : []

    if (needle) {
      return [
        ...sortModelOptions(
          fuzzysort.go(needle, providerOptions, { keys: ["title", "category"] }).map((x) => x.obj),
          false,
        ),
        ...fuzzysort.go(needle, popularProviders, { keys: ["title"] }).map((x) => x.obj),
      ]
    }

    return [...favoriteOptions, ...recentOptions, ...providerOptions, ...popularProviders]
  })

  const provider = createMemo(() =>
    props.providerID ? sync.data.provider.find((item) => item.id === props.providerID) : null,
  )

  const title = createMemo(() => {
    const value = provider()
    if (!value) return "Select model"
    return value.name
  })

  function onSelect(providerID: string, modelID: string) {
    local.model.set({ providerID, modelID }, { recent: true })
    const list = local.model.variant.list()
    const cur = local.model.variant.selected()
    if (cur === "default" || (cur && list.includes(cur))) {
      dialog.clear()
      return
    }
    if (list.length > 0) {
      dialog.replace(() => <DialogVariant />)
      return
    }
    dialog.clear()
  }

  function currentEndpoint(choice: ModelChoice) {
    const config = sync.data.config as any
    const providerConfig = config.provider?.[choice.providerID]
    const providerInfo = sync.data.provider.find((provider) => provider.id === choice.providerID)
    const modelInfo = providerInfo?.models[choice.modelID] as any
    return providerConfig?.options?.baseURL ?? providerInfo?.options?.baseURL ?? modelInfo?.api?.url ?? ""
  }

  async function editEndpoint(choice: ModelChoice) {
    const value = await DialogPrompt.show(dialog, "Edit provider endpoint", {
      value: currentEndpoint(choice),
      placeholder: "Provider endpoint URL",
    })
    if (value === null) return

    const next = value.trim()
    if (next.length > 0) {
      try {
        new URL(next)
      } catch {
        toast.show({ variant: "error", message: "Endpoint must be a URL" })
        void editEndpoint(choice)
        return
      }
    }

    const config = sync.data.config as any
    const providerConfig = { ...(config.provider?.[choice.providerID] ?? {}) }
    const providerOptions = { ...(providerConfig.options ?? {}) }
    if (next.length === 0) delete providerOptions.baseURL
    else providerOptions.baseURL = next
    providerConfig.options = providerOptions

    await sdk.client.config.update(
      {
        workspace: project.workspace.current(),
        config: {
          ...config,
          provider: {
            ...(config.provider ?? {}),
            [choice.providerID]: providerConfig,
          },
        },
      },
      { throwOnError: true },
    )
    await sdk.client.instance.dispose()
    await sync.bootstrap()
    toast.show({ variant: "success", message: `Updated endpoint for ${choice.providerID}` })
    dialog.replace(() => <DialogModel providerID={choice.providerID} />)
  }

  return (
    <DialogSelect<ReturnType<typeof options>[number]["value"]>
      options={options()}
      actions={[
        {
          command: "provider.connect",
          title: connected() ? "Connect provider" : "View all providers",
          onTrigger() {
            dialog.replace(() => <DialogProvider />)
          },
        },
        {
          command: "model.dialog.provider",
          title: "Endpoint",
          disabled(option) {
            const value = option?.value as Partial<ModelChoice> | undefined
            return !value?.providerID || !value?.modelID
          },
          onTrigger: (option) => {
            const value = option.value as ModelChoice
            void editEndpoint(value)
          },
        },
        {
          command: "model.dialog.favorite",
          title: "Favorite",
          hidden: !connected(),
          onTrigger: (option) => {
            local.model.toggleFavorite(option.value as { providerID: string; modelID: string })
          },
        },
      ]}
      onFilter={setQuery}
      flat={true}
      skipFilter={true}
      title={title()}
      current={local.model.current()}
    />
  )
}

export function sortModelOptions<T extends { footer?: string; releaseDate: string | number; title: string }>(
  options: T[],
  newestFirst: boolean,
) {
  if (newestFirst) return sortBy(options, [(option) => option.releaseDate, "desc"], (option) => option.title)
  return sortBy(
    options,
    (option) => option.footer !== "Free",
    [(option) => option.releaseDate, "desc"],
    (option) => option.title,
  )
}
