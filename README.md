# Browser MCP

This project provides a bridge between browser automation and the [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/sdk), enabling communication between a Node.js WebSocket server and a browser extension. It consists of two main components:

- **socket-server/**: A Node.js WebSocket server that exposes browser tab management tools via MCP.
- **web-extension-mcp/**: A browser extension that connects to the WebSocket server and executes tab-related commands.

---

## Project Structure

```
.
├── socket-server/
│   ├── index.js           # Main MCP WebSocket server
│   └── package.json       # Server dependencies
└── web-extension-mcp/
    ├── background.js      # Extension background script
    └── manifest.json      # Extension manifest
```

---

## Features

### socket-server
- Exposes browser tab management tools (query, create, reload, get current tab) via MCP.
- Communicates with browser extensions over WebSocket (default port: 8080).
- Implements tools using the [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) and [ws](https://www.npmjs.com/package/ws) libraries.

### web-extension-mcp
- Connects to the local WebSocket server.
- Listens for tab management commands and executes them using browser APIs.
- Sends responses back to the server.

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm
- Firefox

### 1. Install Dependencies

```
cd /path/to/socket-server
npm install
```

### 2. MCP Setup (socket-server)

To setup the socket server to be used:

```json
{
  "mcpServers": {
    "browser-mcp": {
      "command": "node",
      "args": ["/path/to/socket-server/index.js"]
    }
  }
}
```

### 3. Load the Browser Extension

1. Open your browser and go to the extensions page (e.g., `chrome://extensions/`).
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `web-extension-mcp` directory.
4. The extension will attempt to connect to the WebSocket server at `ws://localhost:8080`.


## Usage

Once both the server and extension are running:
- The server can send tab management commands (query, create, reload, get current tab) to the browser via the extension.
- The extension executes these commands and returns results over the WebSocket connection.

## Development Notes

- **socket-server/index.js**: Implements the MCP server and WebSocket bridge. Tools are registered for tab management and communicate with the browser via WebSocket.
- **web-extension-mcp/background.js**: Handles WebSocket connection, receives commands, and interacts with browser tabs using the `browser.tabs` API.
- The extension expects the server to be running on `localhost:8080`.
- The server uses the [zod](https://www.npmjs.com/package/zod) library for schema validation.

## Dependencies

### socket-server
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [ws](https://www.npmjs.com/package/ws)
- [zod](https://www.npmjs.com/package/zod)

### web-extension-mcp
- No external npm dependencies (uses browser APIs)

## License

This project is licensed under the MIT License. 