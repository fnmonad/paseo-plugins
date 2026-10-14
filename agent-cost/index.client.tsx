import type {
  PluginButtonContentProps,
  PluginButtonRegistration,
  PluginClientContext,
} from "@getpaseo/plugin/client";
import { Text, View } from "react-native";

interface Usage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  totalCostUsd?: number;
}

interface Agent {
  id: string;
  workspaceId?: string | null;
  lastUsage?: Usage;
}

const usages = new Map<string, Usage>();

function formatCost(cost: number) {
  return cost < 0.01 ? "<$0.01" : `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number | undefined) {
  return (tokens ?? 0).toLocaleString("en-US");
}

function CostDetails(props: PluginButtonContentProps) {
  const { theme } = props;
  const usage = props.context === "agent" ? usages.get(props.agentId) : undefined;
  const text = { color: theme.colors.foreground };
  const muted = { color: theme.colors.foregroundMuted };
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...text, fontSize: 18 }}>{formatCost(usage?.totalCostUsd ?? 0)}</Text>
      <Text style={muted}>Input: {formatTokens(usage?.inputTokens)} tokens</Text>
      <Text style={muted}>Cached input: {formatTokens(usage?.cachedInputTokens)} tokens</Text>
      <Text style={muted}>Output: {formatTokens(usage?.outputTokens)} tokens</Text>
      <Text style={muted}>API-equivalent cost since the agent was last loaded.</Text>
    </View>
  );
}

export default function contribute(client: PluginClientContext) {
  const pills = new Map<string, PluginButtonRegistration>();
  const lifetime = new AbortController();

  const remove = (agentId: string) => {
    pills.get(agentId)?.remove();
    pills.delete(agentId);
    usages.delete(agentId);
  };

  const sync = (agent: Agent) => {
    const usage = { ...usages.get(agent.id), ...agent.lastUsage };
    const cost = usage.totalCostUsd;
    if (!agent.workspaceId || cost === undefined) return remove(agent.id);
    usages.set(agent.id, usage);
    const label = formatCost(cost);
    const pill = pills.get(agent.id);
    if (pill) return pill.update({ label });
    pills.set(
      agent.id,
      client.addComposerPill({
        id: "cost",
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        button: {
          title: "Session cost",
          icon: "CircleDollarSign",
          label,
          behavior: { kind: "popover", Content: CostDetails },
        },
      }),
    );
  };

  void client.paseo.agents
    .list({ subscribe: {}, signal: lifetime.signal })
    .then(({ subscription }) => {
      subscription.subscribe({
        snapshot: ({ entries }) => {
          for (const id of [...pills.keys()]) remove(id);
          for (const { agent } of entries) sync(agent);
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "remove") remove(update.agentId);
          else sync(update.agent);
        },
      });
      return undefined;
    })
    .catch((error) => {
      if (!lifetime.signal.aborted) console.error("Agent cost observation failed", error);
    });

  return () => {
    lifetime.abort();
    for (const id of [...pills.keys()]) remove(id);
  };
}
