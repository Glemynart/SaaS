import process from 'node:process';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { URL } from 'node:url';

const messages = [];

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

const httpServer = createHttpServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:8025');
  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/messages') {
    const recipient = url.searchParams.get('to')?.trim().toLowerCase();
    const matching = recipient
      ? messages.filter((message) => message.to.includes(recipient))
      : messages;
    sendJson(response, 200, { messages: matching });
    return;
  }

  sendJson(response, 404, { message: 'Not found' });
});

const smtpServer = createNetServer((socket) => {
  socket.setEncoding('utf8');
  socket.write('220 localhost E2E mail sink ready\r\n');

  let input = '';
  let receivingData = false;
  let dataLines = [];
  let recipients = [];
  let pendingAuth = false;
  let pendingPassword = false;

  function reply(message) {
    socket.write(`${message}\r\n`);
  }

  function handleLine(line) {
    if (pendingPassword) {
      pendingPassword = false;
      reply('235 2.7.0 Authentication successful');
      return;
    }

    if (receivingData) {
      if (line === '.') {
        receivingData = false;
        messages.push({
          receivedAt: new Date().toISOString(),
          to: recipients,
          raw: dataLines.join('\r\n'),
        });
        dataLines = [];
        reply('250 2.0.0 Message accepted by local E2E sink');
        return;
      }
      dataLines.push(line.startsWith('..') ? line.slice(1) : line);
      return;
    }

    if (pendingAuth) {
      pendingAuth = false;
      pendingPassword = true;
      reply('334 UGFzc3dvcmQ6');
      return;
    }

    const [command = '', ...args] = line.trim().split(/\s+/);
    const argument = args.join(' ');
    switch (command.toUpperCase()) {
      case 'EHLO':
        socket.write('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 52428800\r\n');
        break;
      case 'HELO':
        reply('250 localhost');
        break;
      case 'AUTH':
        if (/^LOGIN$/i.test(argument)) {
          pendingAuth = true;
          reply('334 VXNlcm5hbWU6');
        } else {
          reply('235 2.7.0 Authentication successful');
        }
        break;
      case 'MAIL':
        recipients = [];
        reply('250 2.1.0 Sender accepted');
        break;
      case 'RCPT': {
        const address = argument.match(/<([^>]+)>/)?.[1];
        if (address) recipients.push(address.toLowerCase());
        reply('250 2.1.5 Recipient accepted');
        break;
      }
      case 'DATA':
        receivingData = true;
        reply('354 End data with <CR><LF>.<CR><LF>');
        break;
      case 'RSET':
        recipients = [];
        reply('250 2.0.0 Reset');
        break;
      case 'NOOP':
        reply('250 2.0.0 OK');
        break;
      case 'QUIT':
        reply('221 2.0.0 Bye');
        socket.end();
        break;
      default:
        reply('502 5.5.1 Command not implemented by E2E sink');
    }
  }

  socket.on('data', (chunk) => {
    input += chunk;
    let newline = input.indexOf('\n');
    while (newline !== -1) {
      const line = input.slice(0, newline).replace(/\r$/, '');
      input = input.slice(newline + 1);
      handleLine(line);
      newline = input.indexOf('\n');
    }
  });
});

httpServer.listen(8025, '127.0.0.1');
smtpServer.listen(1025, '127.0.0.1');

function shutdown() {
  httpServer.close();
  smtpServer.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
