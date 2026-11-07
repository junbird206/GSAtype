import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createLocalApi } from './local.mjs';
import { errorResponse } from './errors.mjs';

const { handleApi, close } = await createLocalApi();
const server = createServer(async (incoming, outgoing) => {
  let response;
  try {
    const request = new Request(new URL(incoming.url, 'http://localhost'), {
      method: incoming.method,
      headers: incoming.headers,
      ...(['GET', 'HEAD'].includes(incoming.method) ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }),
    });
    response = await handleApi(request, { clientIp: incoming.socket.remoteAddress });
  } catch (error) {
    response = errorResponse(error);
  }
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(Number(process.env.PORT || 8787), '127.0.0.1', () => {
  console.log(`Local API: http://127.0.0.1:${server.address().port}/api (SQLite persisted; no static files served)`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => { close(); process.exit(0); }));
