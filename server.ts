const {
    listen,
    serveHttp,
    readFile,
    upgradeWebSocket,
    env
} = Deno
type Conn = Deno.Conn

/** WebSocket Client */
type Client = {
    id: string
    name: string
    isAlive: boolean
    socket: WebSocket
}
// our inter-isolate message-bus
const chatChannel = new BroadcastChannel("chat");

// message from another isolate! relay to all socket clients
chatChannel.onmessage = (e: MessageEvent) => {
    for (const client of webSockets.values()) {
        client.socket.send(e.data)
    }
}

/** connected socket clients mapped by unique id */
const webSockets = new Map<string, Client>()

/** Deploy Environment */
const DEBUG = (env.get("DEBUG") === "true")

/** load an index.html file (clients) */
async function handleStaticFile() {
    try {
        const path = "./index.html"
        const body = await readFile(path)
        const headers = new Headers()
        headers.set("content-type", "text/html")
        return new Response(body, { status: 200, headers })
    } catch (e) {
        console.error(e.message)
        return Promise.resolve(new Response("Internal server error", { status: 500 }))
    }
}

const listener = listen({ port: 8080 });
console.log("listening on http://localhost:8080")

for await (const conn of listener) {
    handleConnection(conn)
}

/** Handle each new connection */
async function handleConnection(conn: Conn) {
    const httpConn = serveHttp(conn);
    for await (const requestEvent of httpConn) {
        await requestEvent.respondWith(handleRequest(requestEvent.request));
    }
}

/** handle each new http request */
async function handleRequest(request: Request): Promise<Response> {

    if (request.headers.get("upgrade") === "websocket") {
        const { socket, response } = upgradeWebSocket(request);
        const client: Client = { id: '', name: '', isAlive: true, socket: socket }
        socket.onopen = () => {
            client.id = request.headers.get('sec-websocket-key') || ""
            if (DEBUG) console.log("Client connected ... id: " + client.id)
            // Register our new socket(user)
            webSockets.set(client.id, client)
        }
        socket.onmessage = (msg) => {
            const data = msg.data
            if (typeof data === 'string') {
                // user registration request?
                if (data.startsWith('Register')) {
                    // get the users name from the data string('Register:John Doe')
                    client.name = data.split(":")[1]// the second value of split-array
                    if (DEBUG) console.log(`${client.name} >> has joined the chat!`)
                    broadcast(`${client.name} >> has joined the chat!`);
                } else if (data === 'ACK') { // watchdog acknowledged
                    client.isAlive = true
                } else {
                    if (DEBUG) console.log(`${client.name} >> ${msg.data}`)
                    broadcast(`${client.name} >> ${msg.data}`)
                }
            }
        }
        socket.onclose = () => {
            const name = webSockets.get(client.id)?.name || 'someone'
            webSockets.delete(client.id);
            broadcast(`${name} has disconnected`)
            if (DEBUG) console.log(name + " disconnected from chat ...")
        }

        socket.onerror = (err: Event | ErrorEvent) => {
            console.log(err instanceof ErrorEvent ? err.message : err.type)
        }

        return response
    } else { // not a webSocket request just load our html
        return await handleStaticFile()
    }
}


/** broadcasts a message to every registered user on all isolates */
function broadcast(msg: string): void {
    for (const client of webSockets.values()) {
        client.socket.send(msg)
    }
    chatChannel.postMessage(msg)
}
