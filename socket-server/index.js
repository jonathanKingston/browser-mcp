import WebSocket, { WebSocketServer } from 'ws';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
let browserWebSocketServer = null

const server = new McpServer({
    name: "browser_service",
    version: "0.0.1"
}, { capabilities: { logging: {} }});

function log(...args) {
  console.error(...args);
  /*
  server.sendLoggingMessage({
    level: "info",
    data: JSON.stringify(...args)
  });
  */
}

const tab = z.object({
    id: z.number().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    favIconUrl: z.string().optional(),
    active: z.boolean().optional(),
    pinned: z.boolean().optional(),
    windowId: z.number().optional()
}).catchall(z.unknown())


const queryInfo = z.object({
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
});

server.registerTool(
    "tabsQuery",
    {
      title: "Query current browser tabs",
      description: "Query tabs",
      inputSchema: createInputSchema(queryInfo),
      outputSchema: createOutputSchema(z.array(
        tab
      )),
    },
    async (...args) => {
        return await handleConnection('tabs.query', ...args);
    }
);

// Given a zod schema, wrap it so that the input is:
// { args: schema, connect: "all" | "first" }
function createInputSchema(...args) {
  let schema =  z.union([
    args[0],
    z.tuple(args)
  ])
  // Cursor doesn't seem to accept optional arguments.
  schema = args[0];
  const inputSchema = {
    args: schema,
    connect: z.enum(["all", "first"]).optional()
  };
  return inputSchema;
}

// Given a zod schema, wrap it so that the output is either:
// { response: schema } or { response: [schema] }
// and return as a zod union type.
function createOutputSchema(schema) {
  const responseSchema = z.object({ response: schema });
  return {response: z.union([schema, z.array(schema)])};
}

const createTab = z.object({
  active: z.boolean().optional().describe("Whether the tab should become the active tab in the window. Does not affect whether the window is focused (see windows.update). Defaults to true."),
  index: z.number().optional().describe("The position the tab should take in the window. The provided value is clamped to between zero and the number of tabs in the window."),
  openerTabId: z.number().optional().describe("The ID of the tab that opened this tab. If specified, the opener tab must be in the same window as the newly created tab."),
  pinned: z.boolean().optional().describe("Whether the tab should be pinned. Defaults to false."),
  selected: z.boolean().optional().describe("Deprecated. Please use active. Whether the tab should become the selected tab in the window. Defaults to true."),
  url: z.string().optional().describe("The URL to initially navigate the tab to. Fully-qualified URLs must include a scheme (i.e., 'http://www.google.com', not 'www.google.com'). Relative URLs are relative to the current page within the extension. Defaults to the New Tab Page."),
  windowId: z.number().optional().describe("The window in which to create the new tab. Defaults to the current window.")
});

server.registerTool(
    "tabsCreate",
    {
      title: "Create browser tab",
      description: "Create tab",
      inputSchema: createInputSchema(createTab),
      outputSchema: createOutputSchema(tab)
    },
    async (...args) => {
        return await handleConnection('tabs.create', ...args);
    }
);

const createWindow = z.object({
  allowScriptsToClose: z.boolean().optional().describe("Allow scripts running in the window to close the window by calling window.close()."),
  cookieStoreId: z.string().optional().describe("Cookie store ID for all tabs created when the window is opened."),
  focused: z.boolean().optional().describe("Whether the new window will be focused. Defaults to true."),
  height: z.number().optional().describe("The height in pixels of the new window, including the frame."),
  incognito: z.boolean().optional().describe("Whether the new window should be an incognito (private) window."),
  left: z.number().optional().describe("The number of pixels to position the new window from the left edge of the screen."),
  state: z.enum(["normal", "minimized", "maximized", "fullscreen"]).optional().describe("The initial state of the window."),
  tabId: z.number().optional().describe("If included, moves a tab of the specified ID from an existing window into the new window."),
  titlePreface: z.string().optional().describe("A string to add to the beginning of the browser window's title."),
  top: z.number().optional().describe("The number of pixels to position the new window from the top edge of the screen."),
  type: z.enum(["normal", "popup", "panel", "detached_panel"]).optional().describe("Specifies what type of browser window to create."),
  url: z.union([z.string(), z.array(z.string())]).optional().describe("A URL or array of URLs to open as tabs in the window."),
  width: z.number().optional().describe("The width in pixels of the new window, including the frame.")
});

server.registerTool(
    "windowsCreate",
    {
      title: "Create browser window",
      description: "Create a new browser window",
      inputSchema: createInputSchema(createWindow),
      outputSchema: createOutputSchema(z.object({
        id: z.number(),
        focused: z.boolean(),
        top: z.number(),
        left: z.number(),
        width: z.number(),
        height: z.number(),
        incognito: z.boolean(),
        type: z.string(),
        state: z.string(),
        alwaysOnTop: z.boolean().optional(),
        tabs: z.array(z.unknown()).optional(),
        title: z.string().optional()
      }))
    },
    async (...args) => {
        return await handleConnection('windows.create', ...args);
    }
);

async function handleConnection(type, message) {
  // The zod conversion in the mcp sdk doesn't allow nested objects.
  // we want to trim out additional props before passing this onto the browser.
  const connect = message.connect;
  delete message.connect;
  const messageOut = { type, "args": message.args };
  const response = await handleConnectionMessageCall(messageOut);
  log(response)
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

function handleConnectionMessageCall(message, connect = 'first') {
  if (connect === 'all') {
    return browserWebSocketServer.sendMessageToAllConnections(message)
  }
  return browserWebSocketServer.sendMessageToFirstConnection(message);
}

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
  "getCurrentConnectionIds",
  {
    title: "Get current browser connections",
    description: "Gets all the connected browsers to the MCP server",
    outputSchema: {
      connections: z.array(z.number()).describe("Array of connection indexes"),
    },
  },
  async (...args) => {
    const connections = await browserWebSocketServer.getCurrentConnectionIds(...args);
    const response = { connections };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response)
        }
      ],
      structuredContent: response
    };
  }
);

server.registerTool(
    "tabsReload",
    {
      title: "Reload tab",
      description: "Reload tab",
      inputSchema: createInputSchema(
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
    },
    async (...args) => {
      return await handleConnection('tabs.reload', ...args);
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("MCP server is running...");
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

  async getCurrentConnectionIds() {
    // Return an array of indexes of the web sockets in the connections set
    return Array.from(this.connections).map((_, idx) => idx);
  }

  async tabsGetCurrent() {
    const message = { type: "tabs.query", "args": [{active: true, lastFocusedWindow: true}] };
    const response = await this.sendMessageToFirstConnection(message);
    return response.response[0];
  }

  async sendMessageToFirstConnection(message) {
    log('first connection sending', message)
    const firstConnection = this.connections.values().next().value;
    if (!firstConnection) {
      log('No browser clients connected')
      return { error: "No browser clients connected" };
    }
    const response = await this.sendMessage(firstConnection, message);
    log(response);
    return {response};
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
    return {response: results}
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
        log("Client disconnected.");
      });
      log("Client connected.");
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
            log("no matching guid", obj.responseGuid);
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
