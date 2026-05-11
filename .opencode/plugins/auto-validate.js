/**
 * Auto-validate plugin for oh-my-refcardz
 *
 * Automatically runs validation when the agent finishes editing files.
 * Tracks edited files during the session and runs appropriate checks
 * based on what was modified.
 */
export const AutoValidatePlugin = async ({ $ }) => {
  const filesEdited = new Set()

  return {
    "file.edited": async ({ event }) => {
      filesEdited.add(event.properties.path)
    },

    "session.idle": async () => {
      if (filesEdited.size === 0) return

      const paths = [...filesEdited]
      filesEdited.clear()

      const hasYaml = paths.some((p) =>
        p.includes("content/cheatsheets/") && p.endsWith(".yaml")
      )
      const hasSchema = paths.some((p) => p.includes("yaml-cheatsheets.ts"))
      const hasTs = paths.some((p) => /\.(ts|tsx)$/.test(p))
      const hasE2e = paths.some((p) => p.startsWith("e2e/"))

      // Run validations based on what changed
      if (hasYaml || hasSchema) {
        console.log("[auto-validate] Running cheatsheet validation...")
        await $`npm run validate:cheatsheets`
      }

      if (hasTs || hasSchema) {
        console.log("[auto-validate] Running lint and tests...")
        await $`npm run lint && npm run test`
      }

      if (hasE2e) {
        console.log("[auto-validate] Running E2E tests...")
        await $`npm run test:e2e`
      }
    },
  }
}
