# Herdr + MCP setup

Start the desktop application with `npm start` (or `npm start -- --graphics auto` on a non-NVIDIA setup). It connects to the default Herdr socket, or accepts `--herdr-socket /path/to/herdr.sock`. The socket and reconnect control are also available in the menu. `--no-herdr` retains the manual preview studio.

Each detected Herdr root agent gets a character, with no fixed four-agent cap; the preview studio is separate. Agents inherit the studio's locally selected model when first created. Select an agent in the controls to assign a different model, hide/show it, or choose expressions for its state. Model assignments and mappings are saved locally. Internal subagents are not separately represented.

## Optional Herdr plugin

From this repository, after dependency setup:

```bash
herdr plugin link "$PWD/integrations/herdr"
herdr plugin action invoke ayla.companions.launch
```

The plugin owns a foreground service pane; it does not use a detached startup daemon. Installing/linking the plugin is not done automatically. The default manifest requests native Wayland and NVIDIA rendering. Adjust its launcher arguments for other tested setups.

## MCP bridge

Run `node /absolute/path/to/chibi-agents/scripts/mcp-bridge.mjs` as a **stdio MCP server** in each agent client. No extra npm package or API key is required. Forward `HERDR_PANE_ID` and `HERDR_SOCKET_PATH` from the agent's Herdr pane; do not copy another pane's values. The bridge contacts the running desktop through its private local socket.

Codex example (replace the absolute project path):

```toml
[mcp_servers.ayla_avatar]
command = "node"
args = ["/absolute/path/to/chibi-agents/scripts/mcp-bridge.mjs"]
env_vars = ["HERDR_PANE_ID", "HERDR_SOCKET_PATH"]
```

OpenCode local-server example:

```json
{
  "mcp": {
    "ayla_avatar": {
      "type": "local",
      "command": ["node", "/absolute/path/to/chibi-agents/scripts/mcp-bridge.mjs"],
      "enabled": true
    }
  }
}
```

An OpenCode shared/attached server may not inherit the pane's environment. In that case create a distinct pane-specific configuration using `--pane w1:p2 --herdr-socket /absolute/path/to/herdr.sock`. Do not reuse that configuration across panes. A replacement occupant invalidates old bindings; reconnect its MCP server to obtain a fresh binding.

The bridge also requires a stable agent-session identity reported by Herdr's agent integration. If a recognized agent has no session identity yet, it may still appear as a character, but MCP registration is rejected until that identity is available. This avoids authorizing commands using a reused pane alone.

Tools: `avatar_capabilities`, `avatar_animate`, `avatar_message`, `avatar_reset`, `avatar_status`. Actions are capability-based; a model need not support every action. Temporary animations are bounded to 0.2–15 seconds and restore the latest agent state. Messages are plain text, at most 500 characters. Requests are limited per binding; no tool accepts a target pane or arbitrary filesystem path.

Suggested agent instruction: “Use avatar_message for a brief public milestone or question, and avatar_animate(action=celebrate) after successful validation when the capability is available. Do not use these tools for every token or tool call.”

`COMPANION_SOCKET_PATH` overrides the desktop gateway location; give the bridge the same value. The default is `/tmp/ayla-companions-<uid>/commands.sock`, with a private directory and socket permissions.

## Acceptance checks

1. Start two root agents in Herdr and confirm two independent characters appear.
2. Select one agent, change its model/expression, and verify the other is unaffected.
3. Trigger working/blocked/idle states and check the labels and configured expressions.
4. Configure each client's bridge and call `avatar_status`, then send different messages from both clients.
5. Close/reuse a pane and confirm its previous bridge binding is rejected.
6. Disconnect Herdr and verify existing avatars display disconnected status; reconnect and reconcile current agents.

The execution sandbox cannot access the user's live Herdr socket or display. Automated checks use synthetic protocol data; live Herdr/multi-window/MCP acceptance must be performed on the desktop. Ayla's repository and client configurations have not been modified.

## Rich activity signals

The companion now consumes `completion_seq`, `state_labels` and named activity/phase tokens from Herdr snapshots. Optional terminal-status inference is available under Agents; it produces labelled, throttled hints while the agent is working and never changes Herdr status. There is no need to emit an animation on every output token.

The existing MCP `avatar_animate` tool supports `thinking`, `reading`, `searching`, `editing`, `testing`, `running`, `done` and `error` alongside the original actions. A generic local tool hook can call:

```bash
node /absolute/path/to/chibi-agents/scripts/report-activity.mjs testing 3000
node /absolute/path/to/chibi-agents/scripts/report-activity.mjs done 2200
```

Run hooks inside the recognized agent's Herdr pane, forwarding `HERDR_PANE_ID` and `HERDR_SOCKET_PATH`. The helper authenticates the current occupant, sends one bounded action, and releases its binding. `idle` invokes reset. Hooks are an optional source of explicit intent; no per-agent configuration has been rewritten automatically.
