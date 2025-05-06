const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map();

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'register') {
                clients.set(data.deviceId, ws);
                console.log(`Device registered: ${data.deviceId}`);
            } else if (data.type === 'speak') {
                // Broadcast to all other clients
                clients.forEach((client, deviceId) => {
                    if (deviceId !== data.deviceId && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        // Remove client from map
        for (const [deviceId, client] of clients.entries()) {
            if (client === ws) {
                clients.delete(deviceId);
                console.log(`Device disconnected: ${deviceId}`);
                break;
            }
        }
    });
});

console.log('WebSocket server running on port 8080');
