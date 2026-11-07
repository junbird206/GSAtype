import { cp } from 'node:fs/promises';
for (const name of ['assets', '_headers', '_redirects']) {
  await cp(name, `dist/${name}`, { recursive: true });
}
