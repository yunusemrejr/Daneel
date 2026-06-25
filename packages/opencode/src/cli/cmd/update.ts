import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"

export const UpdateCommand = {
  command: "update [target]",
  describe: "update Daneel from the official Daneel GitHub repository",
  builder: (yargs: Argv) => {
    return yargs.positional("target", {
      describe: "Daneel branch to update from",
      type: "string",
      default: "dev",
    })
  },
  handler: async (args: { target?: string }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("Daneel update")

    const target = args.target || "dev"
    const spinner = prompts.spinner()
    spinner.start("Updating from yunusemrejr/Daneel and rebuilding...")
    const err = await Installation.updateDaneel(target).catch((error) => error)
    if (err) {
      spinner.stop("Daneel update failed", 1)
      if (err instanceof Error) prompts.log.error(err.message)
      prompts.outro("Done")
      return
    }
    spinner.stop("Daneel update complete")
    prompts.outro("Done")
  },
}
