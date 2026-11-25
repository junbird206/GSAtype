import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('../.github/traffic/cloud-state.mjs', import.meta.url));
test('cloud checkpoint imports local attempts and reserves work before visits', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'traffic-state-test-'));
  try {
    await mkdir(resolve(directory, '.github/traffic'), { recursive: true });
    const start = new Date(Date.now() - 3_600_000).toISOString();
    const end = new Date(Date.now() + 3_600_000).toISOString();
    await writeFile(resolve(directory, '.github/traffic/plan.json'), JSON.stringify({ start, end }));
    await writeFile(resolve(directory, '.github/traffic/seed.json'), JSON.stringify({ campaign: start, attemptedSlots: [0] }));
    const run = mode => spawnSync(process.execPath, [helper, mode], { cwd: directory, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '', GITHUB_STEP_SUMMARY: '' } });
    const first = run('prepare');
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).bootstrap, true);
    assert.ok((await readFile(resolve(directory, '.local-data/traffic-check-20261124/hour-00.json.lock'), 'utf8')).includes('never replay'));
    assert.equal(run('export').status, 0);
    const second = run('prepare');
    assert.equal(second.status, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).bootstrap, false);
    assert.deepEqual(JSON.parse(second.stdout).pending, []);
    const file = resolve(directory, '.local-data/cloud-checkpoint/checkpoint.json');
    await writeFile(file, JSON.stringify({ campaign: 'wrong-campaign', attemptedSlots: [] }));
    assert.notEqual(run('prepare').status, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
