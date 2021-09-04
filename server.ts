
/** connected socket clients mapped by unique id */
const webSockets = new Map<string, WebSocket>();

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
            let id = "" // the unique socket id 
            let name = "" // id above allows for duplicate names
            socket.onopen = () => {
                id = request.headers.get('sec-websocket-key') || ""
                console.log("User connected ... id=" + id);
                // Register our new connection(user)
                webSockets.set(id, socket)
            }
            socket.onmessage = (msg) => {
                let data = msg.data
                if (typeof data === 'string') {
                    // user registration request?
                    if (data.startsWith('Register')) {
                        // get the users name
                        name = data.split(" ")[1]
                        data = `has joined the chat!`
                    }
                }
                broadcast(`${name} >> ${data}`);
            }
            socket.onclose = () => {
                webSockets.delete(id);
                broadcast(`${name} has disconnected`)
                console.log(name + " disconnected from chat ...");
            }
            socket.onerror = (err: Event | ErrorEvent) => {
                console.log(err instanceof ErrorEvent ? err.message : err.type);
            }
            respondWith(response);

        } else { // not a webSocket request just load our html
            respondWith(await handleStaticFile())
        }
    }
}

/** broadcast a message to every registered user */
export function broadcast(msg: string): void {
    for (const socket of webSockets.values()) {
        socket.send(msg)
    }
}
