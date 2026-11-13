import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/juny/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const errors = [];
const screenshots = new URL('../test-results/', import.meta.url).pathname;
await mkdir(screenshots, { recursive: true });
const stats = ['intelligence', 'stamina', 'character', 'wealth', 'charm', 'humor'];
const owner = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1 });
const page = await owner.newPage();
page.on('pageerror', error => errors.push(error.message));
let card;
async function capture(name, page, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${screenshots}${name}.png`, fullPage });
  const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, broken: [...document.images].filter(img => !img.complete || !img.naturalWidth).map(img => img.src) }));
  assert.ok(layout.scroll <= layout.width, `${name}: horizontal overflow ${JSON.stringify(layout)}`);
  assert.deepEqual(layout.broken, [], `${name}: broken images`);
}
async function selectScores(page, values) {
  for (const [index, key] of stats.entries()) await page.locator(`input[name=${key}][value="${values[index]}"]`).check();
}
try {
  await page.goto(base); await page.getByRole('link', { name: /내 호랑이 카드 만들기/ }).waitFor();
  await capture('home-360', page);
  await page.getByRole('link', { name: /내 호랑이 카드 만들기/ }).click();
  await page.getByLabel('카드에 적을 이름').fill('안암테스터');
  assert.equal(await page.locator('[type=submit]').isDisabled(), true);
  await selectScores(page, [4, 2, 2, 3, 4, 3]);
  await capture('new-360', page);
  const created = page.waitForResponse(res => res.url().endsWith('/api/cards') && res.request().method() === 'POST');
  await page.locator('[type=submit]').click(); card = await (await created).json();
  assert.ok(card.ownerKey);
  await page.locator('.player-card').waitFor();
  await capture('owner-preview-360', page);
  assert.equal(await page.locator('#comparison').count(), 0);
  // The owner's device cannot submit a friend rating.
  await page.goto(`${base}/r/${card.shareId}`); await selectScores(page, [4,4,4,4,4,4]);
  await page.locator('[type=submit]').click(); await page.getByRole('alert').filter({ hasText: '내 카드에는 평가할 수 없어요' }).waitFor();
  for (let index = 0; index < 3; index++) {
    const friend = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const rater = await friend.newPage(); rater.on('pageerror', error => errors.push(error.message));
    await rater.goto(`${base}/r/${card.shareId}?ch=kakao`);
    const publicData = await (await friend.request.get(`${base}/api/public/${card.shareId}`)).json();
    assert.equal(publicData.selfScores, undefined); assert.equal(publicData.id, undefined);
    if (index < 3) assert.equal(publicData.averages, null);
    await selectScores(rater, [3,4,5,4,4,5]);
    if (index === 0) await capture('rate-360', rater);
    await rater.locator('[type=submit]').click();
    await rater.waitForURL(/\/done$/); await rater.locator('.conversion-section').waitFor();
    await capture(`done-${index + 1}-360`, rater);
    await rater.goto(`${base}/r/${card.shareId}`);
    await rater.locator('.conversion-section').waitFor();
    assert.equal(await rater.locator('#rating-form').count(), 0);
    await friend.close();
  }
  await page.goto(`${base}/c/${card.id}`); await page.locator('#comparison').waitFor();
  await capture('owner-unlocked-360', page);
  assert.equal(await page.locator('.view-tabs [aria-selected=true]').innerText(), '친구들이 본 나');
  await page.getByRole('tab', { name: '내가 본 나', exact: true }).click();
  assert.equal(await page.locator('.card-bottom').innerText(), '내가 본 나');
  assert.equal(await page.locator('.player-card').getByText('예상 카드', { exact: true }).count(), 0);
  await page.getByRole('tab', { name: '친구들이 본 나', exact: true }).click();
  await page.getByRole('button', { name: '카드 저장' }).click();
  await page.getByRole('dialog', { name: '이미지 미리보기' }).waitFor({ timeout: 45000 });
  const preview = page.getByRole('dialog', { name: '이미지 미리보기' });
  const png = await preview.locator('.export-preview').getAttribute('src');
  await writeFile(`${screenshots}export-card.png`, Buffer.from(png.split(',')[1], 'base64'));
  const decoded = PNG.sync.read(Buffer.from(png.split(',')[1], 'base64'));
  const qr = jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height);
  assert.equal(qr?.data, `${base}/r/${card.shareId}?ch=insta`);
  assert.deepEqual(await preview.locator('.export-preview').evaluate(img => [img.naturalWidth, img.naturalHeight]), [1080,1350]);
  await preview.getByRole('button', { name: '프롬프트 복사', exact: true }).click();
  await preview.getByRole('button', { name: '복사 완료', exact: true }).waitFor();
  await preview.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: /이 차이도 공유하기/ }).click();
  await page.getByRole('dialog', { name: '이미지 미리보기' }).waitFor({ timeout: 45000 });
  const gapPng = await page.getByRole('dialog').locator('img').getAttribute('src');
  await writeFile(`${screenshots}export-gap.png`, Buffer.from(gapPng.split(',')[1], 'base64'));
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('link', { name: /이 카드에 내 얼굴도/ }).click();
  await page.getByRole('button', { name: '프롬프트 복사', exact: true }).waitFor(); await capture('face-360', page);
  assert.match(await page.locator('#face-prompt').textContent(), /안암테스터/);
  assert.match(await page.locator('#face-prompt').textContent(), /두 번째 이미지 = 카드에 넣을 내 상반신 사진/);
  assert.equal(new URL(page.url()).searchParams.get('view'), 'friends');
  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base); await page.locator('.player-card').waitFor(); await capture(`home-${width}`, page);
    await page.goto(`${base}/c/${card.id}`); await page.locator('#comparison').waitFor(); await capture(`result-${width}`, page);
    await page.getByRole('link', { name: /이 카드에 내 얼굴도/ }).click();
    await page.getByRole('button', { name: '프롬프트 복사', exact: true }).waitFor(); await capture(`face-${width}`, page);
  }
  const restored = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const recovery = await restored.newPage();
  await recovery.goto(`${base}/c/${card.id}#key=${card.ownerKey}`); await recovery.locator('#comparison').waitFor();
  assert.equal(new URL(recovery.url()).hash, '');
  await recovery.reload(); await recovery.locator('#comparison').waitFor();
  await restored.close();
  assert.deepEqual(errors, []);
  console.log('PASS: create, self-rating block, 3 independent friends, unlock, private fields, duplicate UX, PNG exports, recovery, responsive pages (320/360/390/768/1280).');
} finally {
  if (card?.ownerKey) await owner.request.delete(`${base}/api/cards/${card.id}`, { headers: { Authorization: `Bearer ${card.ownerKey}` } });
  await browser.close();
}
