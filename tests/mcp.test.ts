import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @ai-sdk/mcp before importing McpManager
vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: vi.fn(),
}));

import { createMCPClient } from "@ai-sdk/mcp";
import { McpManager } from "../src/mcp/index.ts";

const mockCreateMCPClient = vi.mocked(createMCPClient);

describe("McpManager", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("connect", () => {
    it("should skip connection when config is undefined", async () => {
      const manager = new McpManager();
      await manager.connect(undefined);

      expect(mockCreateMCPClient).not.toHaveBeenCalled();
      expect(manager.serverCount).toBe(0);
    });

    it("should skip connection when servers is empty", async () => {
      const manager = new McpManager();
      await manager.connect({ enabled: true, servers: {} });

      expect(mockCreateMCPClient).not.toHaveBeenCalled();
      expect(manager.serverCount).toBe(0);
    });

    it("should skip connection when mcp is disabled", async () => {
      const manager = new McpManager();
      await manager.connect({
        enabled: false,
        servers: {
          test: { url: "http://localhost:3001/mcp" },
        },
      });

      expect(mockCreateMCPClient).not.toHaveBeenCalled();
      expect(manager.serverCount).toBe(0);
    });

    it("should connect to a single server successfully", async () => {
      const mockClient = {
        tools: vi.fn().mockResolvedValue({}),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockCreateMCPClient.mockResolvedValue(mockClient as never);

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
        },
      });

      expect(mockCreateMCPClient).toHaveBeenCalledTimes(1);
      expect(mockCreateMCPClient).toHaveBeenCalledWith({
        transport: {
          type: "http",
          url: "http://localhost:3001/mcp",
          headers: undefined,
        },
      });
      expect(manager.serverCount).toBe(1);
      expect(manager.connectedServers).toEqual(["filesystem"]);
    });

    it("should connect to multiple servers", async () => {
      const mockClient = {
        tools: vi.fn().mockResolvedValue({}),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockCreateMCPClient.mockResolvedValue(mockClient as never);

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
          github: {
            url: "http://localhost:3002/mcp",
            headers: { Authorization: "Bearer token" },
          },
        },
      });

      expect(mockCreateMCPClient).toHaveBeenCalledTimes(2);
      expect(manager.serverCount).toBe(2);
    });

    it("should warn and continue when a server fails to connect", async () => {
      mockCreateMCPClient.mockRejectedValue(new Error("Connection refused"));

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          failing: { url: "http://localhost:9999/mcp" },
        },
      });

      expect(manager.serverCount).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Connection failed"),
      );
    });

    it("should connect remaining servers when one fails", async () => {
      const mockClient = {
        tools: vi.fn().mockResolvedValue({}),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockCreateMCPClient
        .mockRejectedValueOnce(new Error("Connection refused"))
        .mockResolvedValueOnce(mockClient as never);

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          failing: { url: "http://localhost:9999/mcp" },
          working: { url: "http://localhost:3001/mcp" },
        },
      });

      expect(manager.serverCount).toBe(1);
      expect(manager.connectedServers).toContain("working");
    });

    it("should provide helpful message for OIDC-related errors", async () => {
      mockCreateMCPClient.mockRejectedValue(
        new Error("401 Unauthorized: OIDC authentication required"),
      );

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          secure: { url: "http://localhost:3001/mcp" },
        },
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("OIDC is not supported"),
      );
    });
  });

  describe("getTools", () => {
    it("should return empty object when no clients connected", async () => {
      const manager = new McpManager();
      const tools = await manager.getTools();

      expect(tools).toEqual({});
    });

    it("should namespace tools with server name", async () => {
      const mockClient = {
        tools: vi.fn().mockResolvedValue({
          read_file: { description: "Read a file" },
          write_file: { description: "Write a file" },
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockCreateMCPClient.mockResolvedValue(mockClient as never);

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
        },
      });

      const tools = await manager.getTools();

      expect(Object.keys(tools)).toEqual([
        "filesystem.read_file",
        "filesystem.write_file",
      ]);
    });

    it("should aggregate tools from multiple servers", async () => {
      const fsClient = {
        tools: vi.fn().mockResolvedValue({
          read_file: { description: "Read a file" },
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const ghClient = {
        tools: vi.fn().mockResolvedValue({
          create_issue: { description: "Create an issue" },
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockCreateMCPClient
        .mockResolvedValueOnce(fsClient as never)
        .mockResolvedValueOnce(ghClient as never);

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
          github: { url: "http://localhost:3002/mcp" },
        },
      });

      const tools = await manager.getTools();

      expect(Object.keys(tools).sort()).toEqual([
        "filesystem.read_file",
        "github.create_issue",
      ]);
    });

    it("should handle tool retrieval errors gracefully", async () => {
      const mockClient = {
        tools: vi.fn().mockRejectedValue(new Error("Tool listing failed")),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockCreateMCPClient.mockResolvedValue(mockClient as never);

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          failing: { url: "http://localhost:3001/mcp" },
        },
      });

      const tools = await manager.getTools();

      expect(tools).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get tools"),
      );
    });
  });

  describe("close", () => {
    it("should close all connected clients", async () => {
      const mockClient = {
        tools: vi.fn().mockResolvedValue({}),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockCreateMCPClient.mockResolvedValue(mockClient as never);

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
        },
      });

      expect(manager.serverCount).toBe(1);

      await manager.close();

      expect(mockClient.close).toHaveBeenCalledTimes(1);
      expect(manager.serverCount).toBe(0);
    });

    it("should handle close errors gracefully", async () => {
      const mockClient = {
        tools: vi.fn().mockResolvedValue({}),
        close: vi.fn().mockRejectedValue(new Error("Close failed")),
      };
      mockCreateMCPClient.mockResolvedValue(mockClient as never);

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
        },
      });

      // Should not throw
      await manager.close();

      expect(manager.serverCount).toBe(0);
    });

    it("should be safe to call multiple times", async () => {
      const mockClient = {
        tools: vi.fn().mockResolvedValue({}),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockCreateMCPClient.mockResolvedValue(mockClient as never);

      const manager = new McpManager();
      await manager.connect({
        enabled: true,
        servers: {
          filesystem: { url: "http://localhost:3001/mcp" },
        },
      });

      await manager.close();
      await manager.close(); // Should not throw

      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });
  });
});
