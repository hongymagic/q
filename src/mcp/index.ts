import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import type { McpConfig, McpServerConfig } from "../config/index.ts";
import { logDebug, logWarn, McpError } from "../errors.ts";

const MAX_TOOL_STEPS = 5;

export { MAX_TOOL_STEPS };

export class McpManager {
  private clients: Map<string, MCPClient> = new Map();
  debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  async connect(config: McpConfig | undefined): Promise<void> {
    if (!config?.servers || Object.keys(config.servers).length === 0) {
      logDebug("No MCP servers configured", this.debug);
      return;
    }

    if (config.enabled === false) {
      logDebug("MCP disabled in config", this.debug);
      return;
    }

    const connectPromises = Object.entries(config.servers).map(
      async ([name, serverConfig]) => {
        try {
          await this.connectServer(name, serverConfig);
        } catch (err) {
          // McpError already includes the server name prefix
          if (err instanceof McpError) {
            logWarn(err.message);
          } else {
            const message = err instanceof Error ? err.message : String(err);
            logWarn(`MCP server '${name}': ${message}`);
          }
        }
      },
    );

    await Promise.all(connectPromises);
    logDebug(`Connected to ${this.clients.size} MCP server(s)`, this.debug);
  }

  private async connectServer(
    name: string,
    config: McpServerConfig,
  ): Promise<void> {
    logDebug(`Connecting to MCP server '${name}' at ${config.url}`, this.debug);

    try {
      const client = await createMCPClient({
        transport: {
          type: "http",
          url: config.url,
          headers: config.headers,
        },
      });

      this.clients.set(name, client);
      logDebug(`Connected to MCP server '${name}'`, this.debug);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const lowerMessage = message.toLowerCase();

      // Check for OIDC-related errors (case-insensitive)
      if (
        lowerMessage.includes("oidc") ||
        lowerMessage.includes("oauth") ||
        (lowerMessage.includes("401") && lowerMessage.includes("unauthorized"))
      ) {
        throw new McpError(
          name,
          "Authentication required. OIDC is not supported; use header-based authentication instead.",
        );
      }

      throw new McpError(name, `Connection failed: ${message}`);
    }
  }

  async getTools(): Promise<ToolSet> {
    if (this.clients.size === 0) {
      return {};
    }

    const allTools: ToolSet = {};

    for (const [serverName, client] of this.clients) {
      try {
        const serverTools = await client.tools();

        // Namespace tools with server name to avoid collisions
        for (const [toolName, tool] of Object.entries(serverTools)) {
          const namespacedName = `${serverName}.${toolName}`;
          allTools[namespacedName] = tool;
          logDebug(`Registered tool: ${namespacedName}`, this.debug);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logWarn(`Failed to get tools from '${serverName}': ${message}`);
      }
    }

    logDebug(
      `Total tools available: ${Object.keys(allTools).length}`,
      this.debug,
    );
    return allTools;
  }

  async close(): Promise<void> {
    const closePromises = Array.from(this.clients.entries()).map(
      async ([name, client]) => {
        try {
          await client.close();
          logDebug(`Closed MCP connection to '${name}'`, this.debug);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logDebug(`Error closing '${name}': ${message}`, this.debug);
        }
      },
    );

    await Promise.all(closePromises);
    this.clients.clear();
  }

  get serverCount(): number {
    return this.clients.size;
  }

  get connectedServers(): string[] {
    return Array.from(this.clients.keys());
  }
}
