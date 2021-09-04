
/** WebSocket Client */
type Client = {
    id: string
    name: string
    isAlive: boolean
    socket: WebSocket
}

/** connected socket clients mapped by unique id */
const webSockets = new Map<string, Client>();
const DEV = Deno.env.get("DEV");
console.info(Deno.env.toObject())
console.info(DEV)

/** load an index.html file (clients) */
async function handleStaticFile() {
    try {
        const path = "./index.html"
        const body = await Deno.readFile(path)
        const headers = new Headers()
        headers.set("content-type", "text/html")
        return new Response(body, { status: 200, headers });
    } catch (e) {
        console.error(e.message)
        return Promise.resolve(new Response("Internal server error", {status: 500}))
    }
}

const listener = Deno.listen({ port: 8080 });
console.log("listening on http://localhost:8080")

for await (const conn of listener) {
    handleConnection(conn);
}

/** Handle each new connection */
async function handleConnection(conn: Deno.Conn) {
    const httpConn = Deno.serveHttp(conn);
    for await (const { request, respondWith } of httpConn) {
        if (request.headers.get("upgrade") === "websocket") {
            const { socket, response } = Deno.upgradeWebSocket(request);
            const client: Client = { id: '', name: '', isAlive: true, socket: socket }

            socket.onopen = () => {
                client.id = request.headers.get('sec-websocket-key') || ""
                console.log("User connected ... id=" + client.id);
                // Register our new connection(user)
                webSockets.set(client.id, client)
            }
            socket.onmessage = (msg) => {
                const data = msg.data
                if (typeof data === 'string') {
                    // user registration request?
                    if (data.startsWith('Register')) {
                        // get the users name
                        client.name = data.split(" ")[1]
                        broadcast(`${client.name} >> has joined the chat!`);
                    } else if (data === 'pong') {
                        client.isAlive = true
                    } else { // relay messages
                        broadcast(`${client.name} >> ${data}`);
                    }
                }
            }
            
            socket.onclose = () => {
                webSockets.delete(client.id);
                broadcast(`${client.name} has disconnected`)
                console.log(client.name + " disconnected from chat ...");
            }
            socket.onerror = (err: Event | ErrorEvent) => {
                console.log(err instanceof ErrorEvent ? err.message : err.type);
            }
            respondWith(response);
            // heatbeat
            setInterval(() => ping(), 10000);
        } else { // not a webSocket request just load our html
            respondWith(await handleStaticFile())
        }
    }
}

/** broadcast a message to every registered user */
function broadcast(msg: string): void {
    for (const client of webSockets.values()) {
        client.socket.send(msg)
    }
}

function ping() {
    for (const client of webSockets.values()) {
      if (!client.isAlive) { client.socket.close(); return; }
      client.isAlive = false;
      client.socket.send('ping');
    }
  }
