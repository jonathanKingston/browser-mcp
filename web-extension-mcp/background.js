let socket;

function log(...args) {
    console.log(...args)
}

function connectWebSocket() {

  log("Connecting to WebSocket...");

  socket = new WebSocket("ws://localhost:8080");

  socket.addEventListener('open', () => {
    log("WebSocket connection established.");
    socket.send("ping");
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

const messages = [
    tabsQuery,
    tabsCreate,
    tabsReload,
];
const messageStrings = messages.map(fn => fn.name);

async function handleMessage(obj) {
    log('handleMessage', obj);
    if (typeof obj.type === "string" && messageStrings.includes(obj.type)) {
        const fn = messages.find(fn => fn.name === obj.type);
        log('calling method', obj.type, obj.arguments)
        if (fn) {
            const arguments = obj.arguments || [];
            const response = await fn(...arguments);
            const stringifiedResponse = JSON.stringify({
                responseType: obj.type,
                responseGuid: obj.guid || null,
                response: response
            });
            log("response", response)
            socket.send(stringifiedResponse);
        }
    }
}

async function tabsQuery(queryInfo = {}) {
    log("get tabs", queryInfo)
    return browser.tabs.query(queryInfo);
}

async function tabsCreate(createProperties) {
    log("get tabs", createProperties)
    return browser.tabs.create(createProperties);
}

async function tabsReload(...args) {
    log("get reload", ...args)
    return browser.tabs.reload(...args);
}

connectWebSocket();
