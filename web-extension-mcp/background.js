let socket;

function log(...args) {
    console.log(...args)
}

// Helper to get the port from storage and connect
async function getPortAndConnect() {
    const items = await browser.storage.local.get(['wsPort']);
    const port = items.wsPort || 8080;
    connectWebSocket(port);
}

function connectWebSocket(port) {

  log("Connecting to WebSocket...");

  const wsUrl = `ws://localhost:${port}`;
  socket = new WebSocket(wsUrl);

  socket.addEventListener('open', () => {
    log("WebSocket connection established.");
  });

  socket.addEventListener('message', (event) => {
    log("Received message from MCP server:", event.data);
    try {
        const obj = JSON.parse(event.data);
        handleMessage(obj);
    } catch (e) {
        log("Unable to be parsed")
    }
  });

  socket.addEventListener('close', () => {
    log("WebSocket closed. Retrying in 3s...");
    setTimeout(getPortAndConnect, 3000); // Retry using the same port
  });

  socket.addEventListener('error', (err) => {
    console.error("WebSocket error:", err);
  });
}

async function callBrowserApi(apiName, methodName, args, obj) {
    if (typeof browser[apiName] !== 'object' || typeof browser[apiName][methodName] !== 'function') {
        log(`Unknown or unsupported ${apiName} method:`, methodName);
        socket.send(JSON.stringify({
            responseType: `${apiName}.${methodName}`,
            responseGuid: obj.guid || null,
            error: `Unknown or unsupported ${apiName} method: ${methodName}`
        }));
        return;
    }
    try {
        log(`calling browser.${apiName} method`, methodName, args);
        const response = await browser[apiName][methodName](...args);
        const stringifiedResponse = JSON.stringify({
            responseType: `${apiName}.${methodName}`,
            responseGuid: obj.guid || null,
            response: response
        });
        log("response", response);
        socket.send(stringifiedResponse);
    } catch (e) {
        log(`Error calling browser.${apiName} method`, methodName, e);
        socket.send(JSON.stringify({
            responseType: `${apiName}.${methodName}`,
            responseGuid: obj.guid || null,
            error: e.message
        }));
    }
}

async function handleMessage(obj) {
    log('handleMessage', obj);
    if (typeof obj.type === "string" && (obj.type.startsWith("tabs.") || obj.type.startsWith("windows."))) {
        const [apiName, methodName] = obj.type.split(".");
        let args = obj.args || [];
        if (!Array.isArray(args)) {
            args = [args];
        }
        await callBrowserApi(apiName, methodName, args, obj);
    } else {
        log("Unknown or unsupported message type:", obj.type);
        socket.send(JSON.stringify({
            responseType: obj.type,
            responseGuid: obj.guid || null,
            error: `Unknown or unsupported message type: ${obj.type}`
        }));
    }
}

// On extension startup, get port and connect
getPortAndConnect();

// Listen for changes to the port and reconnect
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.wsPort) {
        getPortAndConnect();
    }
});
