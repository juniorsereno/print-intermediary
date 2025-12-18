const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Store connected clients
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log('Client connected. Total clients:', connectedClients);

  socket.on('disconnect', () => {
    connectedClients--;
    console.log('Client disconnected. Total clients:', connectedClients);
  });
});

// Helper to format currency
const formatMoney = (value) => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper to generate Saipos format
const generateSaiposContent = (order) => {
  const date = new Date().toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
  
  const printRows = [
    "<barra_mostrar>0</barra_mostrar>",
    "<barra_largura>3</barra_largura>",
    "<barra_altura>120</barra_altura>",
    "</ce><n><e>SOLI PIZZARIA</e></n>",
    "</ae></linha_simples>",
    "</ce><n><e>PEDIDO DE VENDA</e></n>",
    `</ad>${date}`,
    `</ae>Pedido: <n><a>#${order.id}</a></n>`,
    `</ae>${order.customer}`,
    "</ae></linha_simples>",
    "</ae>Endereço de Entrega:",
    `</ae>${order.address || 'Retirada'}`,
    "</linha_simples>",
    "</ae>Qt.  Descrição                         Valor",
    "</ae></linha_simples>"
  ];

  // Add items
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach(item => {
      const totalItem = formatMoney(item.price * item.quantity);
      // Format: "1  Pizza Calabresa              45,00"
      // We rely on the printer's monospaced font or basic alignment.
      // The Saipos format seems to handle spacing manually or via their parser.
      // We will try to mimic the structure: <a>Qty ItemName Price</a>
      printRows.push(`</ae><a>${item.quantity}  ${item.name}</a>`);
      // Add price on a new line aligned right or strictly formatted?
      // In the example: "<a>1  Pizza ... 61.90</a>"
      // Let's try to append the price to the name line for simplicity if it fits,
      // or mimic the example strictly if we had exact column counts.
      // For now:
      printRows.push(`</ad>${totalItem}`);
    });
  }

  printRows.push("</linha_simples>");
  
  // Totals
  const total = formatMoney(order.total || 0);
  printRows.push(`</ae>TOTAL(=)                            ${total}`);
  printRows.push("</linha_simples>");
  
  // Footer
  printRows.push("</ce>");
  printRows.push(`<code128>000${order.id}</code128>`);
  printRows.push(`ID. do pedido: ${order.id}`);
  printRows.push("</corte_parcial>");

  const saiposObject = [{
    printSettings: {
      type: 0,
      printDelivery: 1,
      printTable: 1,
      printServiceTicket: 1,
      layout: 2,
      rowColumns: 42,
      copies: 1,
      emptyLines: 3,
      emptyChar: " ",
      fontSize: 11,
      cashierPrintZeroedValueItems: 1,
      printTableCancelItem: 0,
      groupItemsQuantity: 0,
      printEscposModel: 2,
      showPaymentDetailPrintingAndApp: 0,
      escpos: true,
      idStore: 72144, // Using example ID or config
      printPath: "",
      guid: "generated-guid",
      id_user: 0,
      fileName: `${order.id}.saiposprt`
    },
    printRows: printRows,
    sale_number: `do pedido ${order.id}`,
    id_sale: order.id,
    logData: {
      id_store: 72144,
      id_sale: order.id,
      print_sent_user: 0,
      print_sent_method: 1,
      print_auto: "N"
    }
  }];

  const jsonString = JSON.stringify(saiposObject);
  const base64String = Buffer.from(jsonString).toString('base64');
  return `data:text/json;charset=utf-8,${base64String}`;
};

// API endpoint to receive print jobs
app.post('/api/print', (req, res) => {
  const printData = req.body;
  
  if (!printData) {
    return res.status(400).json({ error: 'No print data provided' });
  }

  // Generate a unique ID for the file if not present
  const fileId = printData.id || Date.now();
  const fileName = `${fileId}.saiposprt`;

  console.log(`Received print job for order ${fileId}`);
  
  // Generate the formatted content
  const fileContent = generateSaiposContent(printData);

  // Emit event to all connected clients
  io.emit('new-print-job', {
    fileName: fileName,
    content: fileContent,
    raw: printData
  });

  res.json({ success: true, message: 'Print job queued successfully' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});