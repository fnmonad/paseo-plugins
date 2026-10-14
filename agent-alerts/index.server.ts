import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PluginServerContext } from "@getpaseo/plugin/server";

const sounds = {
  completed: "/System/Library/Sounds/Glass.aiff",
  failed: "/System/Library/Sounds/Basso.aiff",
  permission: "/System/Library/Sounds/Ping.aiff",
};

const serverId = readFileSync(join(process.env.PASEO_HOME ?? join(homedir(), ".paseo"), "server-id"), "utf8").trim();

function alert(file: string, agentId: string, title: string, body: string) {
  execFile("lsappinfo", ["front"], (_error, asn) => {
    execFile("lsappinfo", ["info", "-only", "bundleid", asn.trim()], (_error, info) => {
      if (info.includes('"sh.paseo.desktop"')) return;
      execFile("afplay", [file], (error) => {
        if (error) console.error(`afplay ${file} failed: ${error.message}`);
      });
      execFile(
        "/opt/homebrew/bin/terminal-notifier",
        [
          "-title",
          title,
          "-message",
          body.replace(/\s+/g, " ").trim().slice(0, 200),
          "-group",
          agentId,
          "-open",
          `paseo://h/${serverId}/agent/${agentId}`,
        ],
        (error) => {
          if (error) console.error(`notification failed: ${error.message}`);
        },
      );
    });
  });
}

export default function contribute(server: PluginServerContext) {
  server.on("agent.turn_ended", ({ agent, outcome, timeline }) => {
    if (agent.parentAgentId) return;
    const title = agent.title ?? "Paseo";
    if (outcome.kind === "completed") {
      const reply = timeline.findLast((item) => item.type === "assistant_message");
      alert(sounds.completed, agent.id, title, reply?.type === "assistant_message" ? reply.text : "Finished");
    }
    if (outcome.kind === "failed") alert(sounds.failed, agent.id, title, outcome.error.message);
  });

  server.on("agent.permission_requested", ({ agent, request }) => {
    alert(sounds.permission, agent.id, agent.title ?? "Paseo", `Needs permission: ${request.title ?? request.name}`);
  });

  return () => {};
}
