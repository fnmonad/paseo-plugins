import type { PluginClientContext } from "@getpaseo/plugin/client";

const bubbleCss = `
[data-testid="user-message"] > div > div:first-child {
  background-color: #2a2620 !important;
}
[data-testid="user-message"] [data-message-text="true"] {
  color: #ffb000 !important;
}
`;

export default function contribute(client: PluginClientContext) {
  const removeTheme = client.addTheme({
    id: "high-contrast",
    name: "Hyper High Contrast",
    appearance: "dark",
    colors: {
      background: "#000000",
      foreground: "#ffffff",
      raised: "#1a1a1a",
      control: "#333333",
      border: "#4d4d4d",
      accent: "#33ff00",
      mutedForeground: "#d0d0d0",
      ring: "#808080",
    },
  });

  const style = typeof document !== "undefined" ? document.createElement("style") : null;
  if (style) {
    style.textContent = bubbleCss;
    document.head.appendChild(style);
  }

  return () => {
    removeTheme();
    style?.remove();
  };
}
