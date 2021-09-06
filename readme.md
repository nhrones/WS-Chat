## Deno Deploy WebSocket Chat App

 * Native HTTP/WS -> BroadcastChannel
 * Zero dependencies (zero imports)
 * Only two files (index.html, server.ts)


## run it  https://deploy-socket-chat.deno.dev/

## Example MSG
 
 1. WebSocket client (instance b2) sends message 'Hi'.
 2. Isolate b broadcasts the message to all of its registered socket-clients.
 3. Isolate b then broadcasts the message to the 'chat' BroadcastChannel.
 4. All isolates in all regions listening on the 'chat' channel will
 then broadcast    
 the message to all of their registered socket-clients. 

![Drag Racing](comms.jpg)

