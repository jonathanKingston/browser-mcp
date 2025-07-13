import WebSocket, { WebSocketServer } from 'ws';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
let browserWebSocketServer = null

const server = new McpServer({
    name: "browser_service",
    version: "0.0.1"
});

const tab = z.object({
    id: z.number().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    favIconUrl: z.string().optional(),
    active: z.boolean().optional(),
    pinned: z.boolean().optional(),
    windowId: z.number().optional()
}).catchall(z.unknown())

server.registerTool(
    "tabsQuery",
    {
      title: "Query current browser tabs",
      description: "Query tabs",
      inputSchema: {
        active: z.boolean().optional().describe("Whether the tabs are active in their windows."),
        audible: z.boolean().optional().describe("Whether the tabs are audible. Chrome 45+"),
        autoDiscardable: z.boolean().optional().describe("Whether the tabs can be discarded automatically by the browser when resources are low. Chrome 54+"),
        currentWindow: z.boolean().optional().describe("Whether the tabs are in the current window."),
        discarded: z.boolean().optional().describe("Whether the tabs are discarded. A discarded tab is one whose content has been unloaded from memory, but is still visible in the tab strip. Its content is reloaded the next time it is activated. Chrome 54+"),
        frozen: z.boolean().optional().describe("Whether the tabs are frozen. A frozen tab cannot execute tasks, including event handlers or timers. It is visible in the tab strip and its content is loaded in memory. It is unfrozen on activation. Chrome 132+"),
        groupId: z.number().optional().describe("The ID of the group that the tabs are in, or tabGroups.TAB_GROUP_ID_NONE for ungrouped tabs. Chrome 88+"),
        highlighted: z.boolean().optional().describe("Whether the tabs are highlighted."),
        index: z.number().optional().describe("The position of the tabs within their windows."),
        lastFocusedWindow: z.boolean().optional().describe("Whether the tabs are in the last focused window."),
        muted: z.boolean().optional().describe("Whether the tabs are muted. Chrome 45+"),
        pinned: z.boolean().optional().describe("Whether the tabs are pinned."),
        status: z.string().optional().describe("The tab loading status."),
        title: z.string().optional().describe("Match page titles against a pattern. This property is ignored if the extension does not have the 'tabs' permission or host permissions for the page."),
        url: z.union([z.string(), z.array(z.string())]).optional().describe("Match tabs against one or more URL patterns. Fragment identifiers are not matched. This property is ignored if the extension does not have the 'tabs' permission or host permissions for the page."),
        windowId: z.number().optional().describe("The ID of the parent window, or windows.WINDOW_ID_CURRENT for the current window."),
        windowType: z.string().optional().describe("The type of window the tabs are in."),
      },
      outputSchema: {
        connectionResponses: z.array(z.array(
            tab
        ))
      },
    },
    async (queryInfo) => {
        const response = await browserWebSocketServer.tabsQuery(queryInfo);
        return {
            content: [
                {
                    "type": "text",
                    "text": JSON.stringify(response)
                }
            ],
            structuredContent: response
        }
    }
);

server.registerTool(
    "tabsCreate",
    {
      title: "Create browser tab",
      description: "Create tab",
      inputSchema: {
        active: z.boolean().optional().describe("Whether the tab should become the active tab in the window. Does not affect whether the window is focused (see windows.update). Defaults to true."),
        index: z.number().optional().describe("The position the tab should take in the window. The provided value is clamped to between zero and the number of tabs in the window."),
        openerTabId: z.number().optional().describe("The ID of the tab that opened this tab. If specified, the opener tab must be in the same window as the newly created tab."),
        pinned: z.boolean().optional().describe("Whether the tab should be pinned. Defaults to false."),
        selected: z.boolean().optional().describe("Deprecated. Please use active. Whether the tab should become the selected tab in the window. Defaults to true."),
        url: z.string().optional().describe("The URL to initially navigate the tab to. Fully-qualified URLs must include a scheme (i.e., 'http://www.google.com', not 'www.google.com'). Relative URLs are relative to the current page within the extension. Defaults to the New Tab Page."),
        windowId: z.number().optional().describe("The window in which to create the new tab. Defaults to the current window.")
      },
      outputSchema: {
        tab
      },
    },
    async (createProperties) => {
        const tab = await browserWebSocketServer.tabsCreate(createProperties);
        const response = {tab};
        return {
            content: [
                {
                    "type": "text",
                    "text": JSON.stringify(response)
                }
            ],
            structuredContent: response
        }
    }
);

server.registerTool(
    "tabsGetCurrent",
    {
      title: "Get current browser tab",
      description: "Get current browser tab",
      outputSchema: {
        tab
      },
    },
    async () => {
        const tab = await browserWebSocketServer.tabsGetCurrent();
        const response = {tab};
        return {
            content: [
                {
                    "type": "text",
                    "text": JSON.stringify(response)
                }
            ],
            structuredContent: response
        }
    }
);

server.registerTool(
    "tabsReload",
    {
      title: "Reload tab",
      description: "Reload tab",
      inputSchema: {
        args: z.array(
            z.number()
              .optional()
              .describe("tabId (number, optional): The ID of the tab to reload; defaults to the selected tab of the current window."),
            z.object({
                bypassCache: z.boolean()
                  .optional()
                  .describe("Whether to bypass local caching. Defaults to false.")
            })
            .optional()
            .describe("reloadProperties (object, optional): Properties for reloading the tab."),
        )
      }
    },
    async ({ args }) => {
        const tab = await browserWebSocketServer.tabsReload(...args);
        const response = {tab};
        return {
            content: [
                {
                    "type": "text",
                    "text": JSON.stringify(response)
                }
            ],
            structuredContent: response
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("MCP server is running...");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});

class BrowserWebSocketServer {
  constructor(port = 8080) {
    this.wss = new WebSocketServer({ port });
    this._setup();
    this.connections = new Set();
    this.pendingResponses = new Map();
  }

  async tabsGetCurrent() {
    const message = { type: "tabsQuery", "arguments": [{active: true, lastFocusedWindow: true}] };
    const response = await this.sendMessageToFirstConnection(message);
    return response[0];
  }

  async tabsCreate(createProperties) {
    const message = { type: "tabsCreate", "arguments": [createProperties] };
    return this.sendMessageToFirstConnection(message);
  }

  async tabsQuery(queryInfo) {
    const message = { type: "tabsQuery", "arguments": [queryInfo] };
    return this.sendMessageToAllConnections(message)
  }

  async tabsReload(...args) {
    const message = { type: "tabsReload", "arguments": args };
    return this.sendMessageToFirstConnection(message);  
  }

  async sendMessageToFirstConnection(message) {
    const firstConnection = this.connections.values().next().value;
    if (!firstConnection) {
      return { error: "No browser clients connected" };
    }
    return this.sendMessage(firstConnection, message);
  }

  async sendMessageToAllConnections(obj) {
    if (this.connections.size === 0) {
        return { error: "No browser clients connected" };
    }
    const promises = [];
    for (const ws of this.connections) {
      if (ws.readyState === ws.OPEN) {
        promises.push(this.sendMessage(ws, obj));
      }
    }
    const results = await Promise.all(promises);
    if (!results || !results.length) {
        return { error: "No response from browser clients" };
    }
    return {connectionResponses: results}
  }

  sendMessage(ws, obj) {
    const guid = globalThis.crypto.randomUUID();
    obj.guid = guid;
    const message = JSON.stringify(obj);
    ws.send(message);

    return new Promise((resolve, reject) => {
      // Store the resolver for this guid
      this.pendingResponses.set(guid, resolve);
      // Optionally, add a timeout to reject if no response is received
      setTimeout(() => {
        if (this.pendingResponses.has(guid)) {
          this.pendingResponses.delete(guid);
          reject(new Error(`Timeout waiting for response to guid: ${guid}`));
        }
      }, 10000); // 10 seconds timeout
    });
  }

  _setup() {
    this.wss.on('connection', async (ws) => {
      this.connections.add(ws);

      ws.on('close', () => {
        this.connections.delete(ws);
        console.log("Client disconnected.");
      });
      console.log("Client connected.");
      ws.on('message', (msg) => {
        const msgStr = msg.toString();
        try {
          const obj = JSON.parse(msgStr);
          // If this is a response with a guid, resolve the corresponding promise
          if (obj.responseGuid && this.pendingResponses.has(obj.responseGuid)) {
            const resolve = this.pendingResponses.get(obj.responseGuid);
            this.pendingResponses.delete(obj.responseGuid);
            resolve(obj.response);
          } else if (obj.responseType) {
            // Fallback: log if it's a response but no matching guid
            console.log("no matching guid", obj.responseGuid);
          }
        } catch (e) {
          console.error("Message eror", e)
        }
      });
    });
  }
}

// Store an instance externally for singleton-like access
browserWebSocketServer = new BrowserWebSocketServer(8080);
