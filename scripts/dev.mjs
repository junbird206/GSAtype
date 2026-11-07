import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createServer as createViteServer } from 'vite';
import { createLocalApi } from '../server/local.mjs';
import { errorResponse } from '../server/errors.mjs';

const { handleApi, close } = await createLocalApi();
const vite = await createViteServer({ server: { middlewareMode: true, hmr: { host: '127.0.0.1' } }, appType: 'spa' });
const server = createServer(async (incoming, outgoing) => {
  if (!incoming.url.startsWith('/api/')) return vite.middlewares(incoming, outgoing);
  let response;
  try {
    const request = new Request(new URL(incoming.url, 'http://localhost'), {
      method: incoming.method, headers: incoming.headers,
      ...(['GET', 'HEAD'].includes(incoming.method) ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }),
    });
    response = await handleApi(request, { clientIp: incoming.socket.remoteAddress });
  } catch (error) { response = errorResponse(error); }
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log(`Local: http://127.0.0.1:${server.address().port}/`);
});
server.on('error', async error => { console.error(error.message); await vite.close(); close(); process.exit(1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  await vite.close(); server.close(() => { close(); process.exit(0); });
});
