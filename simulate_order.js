const http = require('http');

const orderData = {
    id: 12345,
    customer: "João Silva",
    items: [
        { name: "Pizza Calabresa", quantity: 1, price: 45.00 },
        { name: "Coca-Cola 2L", quantity: 1, price: 12.00 }
    ],
    total: 57.00,
    address: "Rua das Flores, 123",
    content: "PEDIDO #12345\\n\\nCLIENTE: João Silva\\nENDEREÇO: Rua das Flores, 123\\n\\nITENS:\\n1x Pizza Calabresa - R$ 45,00\\n1x Coca-Cola 2L - R$ 12,00\\n\\nTOTAL: R$ 57,00\\n\\n--------------------------------\\nSoli Pizzaria"
};

// Use JSON.stringify twice to ensure the content string is properly escaped if we were embedding it manually,
// but here we are using JSON.stringify(orderData) which should handle standard escaping.
// However, the previous error 'Unterminated string' suggests something got cut off or bad characters.
// Let's rely on standard JSON.stringify but ensure special chars are safe.
const data = JSON.stringify(orderData);

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/print',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(data);
req.end();

console.log("Sending print job simulation...");