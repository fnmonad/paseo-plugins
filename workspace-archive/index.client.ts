import type { PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";

export default function contribute(client: PluginClientContext) {
  const buttons = new Map<string, PluginButtonRegistration>();
  const lifetime = new AbortController();

  const remove = (workspaceId: string) => {
    buttons.get(workspaceId)?.remove();
    buttons.delete(workspaceId);
  };

  const sync = (workspace: { id: string; archivingAt?: string | null }) => {
    if (workspace.archivingAt) return remove(workspace.id);
    if (buttons.has(workspace.id)) return;
    const button = client.addHeaderButton({
      id: "archive",
      workspaceId: workspace.id,
      button: {
        title: "Archive workspace",
        icon: "Archive",
        behavior: {
          kind: "action",
          async onPress() {
            if (typeof window !== "undefined" && typeof KeyboardEvent !== "undefined") {
              const mac = /Mac/.test(navigator.platform);
              window.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "Backspace",
                  code: "Backspace",
                  metaKey: mac,
                  ctrlKey: !mac,
                  shiftKey: true,
                  bubbles: true,
                  cancelable: true,
                }),
              );
              return;
            }
            button.update({ disabled: true });
            const result = await client.paseo.workspaces.archive(workspace.id).catch((error) => ({
              error: String(error),
            }));
            if (result.error) {
              console.error(`Archive failed: ${result.error}`);
              button.update({ disabled: false });
            }
          },
        },
      },
    });
    buttons.set(workspace.id, button);
  };

  void client.paseo.workspaces
    .list({ subscribe: {}, page: { limit: 200 } })
    .then(({ subscription }) => {
      if (lifetime.signal.aborted) return void subscription.release();
      lifetime.signal.addEventListener("abort", () => void subscription.release());
      subscription.subscribe({
        snapshot: ({ entries }) => {
          for (const id of [...buttons.keys()]) remove(id);
          for (const workspace of entries) sync(workspace);
        },
        update: (message) => {
          if (message.type !== "workspace_update") return;
          const update = message.payload;
          if (update.kind === "remove") remove(update.id);
          else sync(update.workspace);
        },
      });
      return undefined;
    })
    .catch((error) => {
      if (!lifetime.signal.aborted) console.error("Workspace observation failed", error);
    });

  return () => {
    lifetime.abort();
    for (const id of [...buttons.keys()]) remove(id);
  };
}
