let socket;

function log(...args) {
    console.log(...args)
}

function connectWebSocket() {

  log("Connecting to WebSocket...");

  socket = new WebSocket("ws://localhost:8080");

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
    setTimeout(connectWebSocket, 3000);
  });

  socket.addEventListener('error', (err) => {
    console.error("WebSocket error:", err);
  });
}

async function handleMessage(obj) {
    log('handleMessage', obj);
    if (typeof obj.type === "string" && obj.type.startsWith("tabs.")) {
        const methodName = obj.type.slice("tabs.".length);
        if (typeof browser.tabs[methodName] === "function") {
            try {
                let args = obj.args || [];
                if (!Array.isArray(args)) {
                    args = [args];
                }
                log('calling browser.tabs method', methodName, args);
                const response = await browser.tabs[methodName](...args);
                const stringifiedResponse = JSON.stringify({
                    responseType: obj.type,
                    responseGuid: obj.guid || null,
                    response: response
                });
                log("response", response);
                socket.send(stringifiedResponse);
            } catch (e) {
                log("Error calling browser.tabs method", methodName, e);
                socket.send(JSON.stringify({
                    responseType: obj.type,
                    responseGuid: obj.guid || null,
                    error: e.message
                }));
            }
        } else {
            log("Unknown or unsupported tabs method:", methodName);
            socket.send(JSON.stringify({
                responseType: obj.type,
                responseGuid: obj.guid || null,
                error: `Unknown or unsupported tabs method: ${methodName}`
            }));
        }
    } else {
        log("Unknown or unsupported message type:", obj.type);
        socket.send(JSON.stringify({
            responseType: obj.type,
            responseGuid: obj.guid || null,
            error: `Unknown or unsupported message type: ${obj.type}`
        }));
    }
}

connectWebSocket();
