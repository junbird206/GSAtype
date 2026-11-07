import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { createIcons, Copy, ArrowUpRight, Check } from 'lucide';
import { writeClipboard } from './clipboard.js';

const WIDTH = 1080;
const HEIGHTS = { feed: 1350, story: 1920 };
const FONT = '"IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif';
let active = false;

async function loadImage(src) {
  const image = new Image(); image.src = src; await image.decode(); return image;
}
function drawTitle(ctx, text, y, size) {
  ctx.font = `700 ${size}px ${FONT}`;
  while (ctx.measureText(text).width > 960 && size > 20) ctx.font = `700 ${--size}px ${FONT}`;
  ctx.fillText(text, 60, y);
}
function preview(dataUrl, file, shareUrl, title, onClose, personalize, sample) {
  const focus = document.activeElement;
  const dialog = document.createElement('dialog'); dialog.className = 'app-dialog export-dialog';
  dialog.setAttribute('aria-labelledby', 'export-title');
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="export-title">이미지 미리보기</h2><button class="icon-button export-close" aria-label="닫기">×</button></div><img class="export-preview" alt=""><p class="export-help">이미지를 길게 눌러 저장할 수도 있어요. 저장이 안 되면 링크를 복사하거나 외부 브라우저에서 열어 주세요.</p><div class="export-actions"><a class="primary-button export-download">이미지 저장</a><button class="secondary-button export-share">이미지 공유</button><button class="secondary-button export-link">링크 복사</button></div><p class="export-status" role="status"></p>`;
  const image = dialog.querySelector('img'); image.src = dataUrl; image.alt = title;
  const download = dialog.querySelector('.export-download'); download.href = dataUrl; download.download = file.name;
  const share = dialog.querySelector('.export-share');
  let canShare = false;
  try { canShare = Boolean(navigator.canShare?.({ files: [file] })); } catch {}
  share.hidden = !canShare || sample;
  dialog.querySelector('.export-link').hidden = sample;
  const status = dialog.querySelector('.export-status');
  share.addEventListener('click', async () => {
    share.disabled = true;
    try { await navigator.share({ files: [file], title }); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = '공유하지 못했어요. 이미지 저장이나 링크 복사를 이용해 주세요.'; }
    finally { share.disabled = false; }
  });
  download.addEventListener('click', () => { status.textContent = '저장이 안 되면 이미지를 길게 눌러 주세요.'; });
  dialog.querySelector('.export-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl); status.textContent = '평가 링크를 복사했어요.'; }
    catch {
      let input = dialog.querySelector('.copy-field');
      if (!input) { input = document.createElement('input'); input.className = 'copy-field'; input.readOnly = true; input.setAttribute('aria-label', '공유 링크'); dialog.append(input); }
      input.value = shareUrl; input.focus(); input.select();
      status.textContent = '선택된 링크를 복사해 주세요.';
    }
  });
  if (personalize) {
    const next = document.createElement('section'); next.className = 'export-personalize';
    next.innerHTML = `<div class="personalize-heading"><h3>다음은, 내 얼굴로.</h3><img src="/assets/gemini/google-gemini-lockup.png" alt="Google Gemini"></div><p>카드를 저장한 뒤, 내 상반신 사진과 함께<br>Gemini에 넣어 보세요.</p><button class="primary-button export-prompt"><i data-lucide="Copy" aria-hidden="true"></i> 프롬프트 복사</button><a class="secondary-button gemini-open" href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">Gemini 열기 <i data-lucide="ArrowUpRight" aria-hidden="true"></i></a><button class="text-button export-continue">사진 카드 만들기 · 학생 혜택 <i data-lucide="ArrowUpRight" aria-hidden="true"></i></button><p class="export-prompt-status" role="status"></p>`;
    const copy = next.querySelector('.export-prompt');
    const promptStatus = next.querySelector('.export-prompt-status');
    copy.addEventListener('click', async () => {
      if (await writeClipboard(personalize.prompt, dialog)) {
        promptStatus.textContent = '복사했어요. 저장한 카드와 내 사진, 두 장을 함께 첨부해 주세요.';
        copy.innerHTML = '<i data-lucide="Check" aria-hidden="true"></i> 복사 완료';
        createIcons({ icons: { Check }, root: copy }); personalize.onCopy?.();
      } else {
        let field = next.querySelector('textarea');
        if (!field) { field = document.createElement('textarea'); field.className = 'copy-field'; field.rows = 6; field.readOnly = true; field.setAttribute('aria-label', '복사할 프롬프트'); next.append(field); }
        field.value = personalize.prompt; field.focus(); field.select();
        promptStatus.textContent = '자동 복사가 안 돼요. 아래 선택된 프롬프트를 직접 복사해 주세요.';
      }
    });
    next.querySelector('.gemini-open').addEventListener('click', () => personalize.onOpen?.());
    next.querySelector('.export-continue').addEventListener('click', () => { dialog.close(); personalize.onContinue(); });
    dialog.append(next);
  }
  dialog.querySelector('.export-close').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { dialog.remove(); active = false; focus?.focus(); onClose?.(); }, { once: true });
  document.body.append(dialog); createIcons({ icons: { Copy, ArrowUpRight }, root: dialog }); dialog.showModal();
  return () => dialog.close();
}

export async function exportCard({ node, nickname, kind = 'card', format = 'feed', shareUrl, perspective = 'friends', onClose, personalize, sample = false } = {}) {
  if (active) throw new Error('이미지 미리보기를 먼저 닫아 주세요.');
  if (!(node instanceof HTMLElement) || !node.isConnected) throw new Error('저장할 카드를 찾지 못했어요.');
  const url = new URL(shareUrl, location.href);
  if (!['http:', 'https:'].includes(url.protocol) || !HEIGHTS[format]) throw new Error('저장할 카드 형식을 확인해 주세요.');
  active = true;
  try {
    await document.fonts.ready;
    await Promise.all([...node.querySelectorAll('img')].map(image => image.decode()));
    // Capture the actual rendered card once, then compose a fixed-size share image.
    const capture = await toPng(node, {
      pixelRatio: 3, preferredFontFormat: 'woff2', backgroundColor: '#fbfbfc',
      style: { margin: '0', marginInline: '0', marginBlock: '0' },
      filter: element => !element.matches?.('button, input, [hidden]'),
      onImageErrorHandler: () => { throw new Error('그림을 불러오지 못했어요. 다시 저장해 주세요.'); },
    });
    const [card, qr] = await Promise.all([
      loadImage(capture),
      QRCode.toDataURL(url.href, { width: 440, margin: 4, errorCorrectionLevel: 'M' }).then(loadImage),
    ]);
    const height = HEIGHTS[format];
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbfbfc'; ctx.fillRect(0, 0, WIDTH, height);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#747b85'; drawTitle(ctx, `${nickname} · MY TIGER TYPE${sample ? ' · SAMPLE' : ''}`, 50, 24);
    ctx.fillStyle = '#a8173a';
    const title = kind === 'comparison' ? '내가 아는 나와 친구들이 아는 나' : perspective === 'self' ? '내가 본 나의 호랑이 카드' : '친구들이 본 나의 호랑이 카드';
    drawTitle(ctx, title, 96, 44);
    const top = 194; const bottom = height - 276; const areaHeight = bottom - top;
    const scale = Math.min(940 / card.width, areaHeight / card.height);
    const imageWidth = card.width * scale; const imageHeight = card.height * scale;
    ctx.drawImage(card, (WIDTH - imageWidth) / 2, top + (areaHeight - imageHeight) / 2, imageWidth, imageHeight);
    ctx.strokeStyle = '#dedfe3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, height - 246); ctx.lineTo(1020, height - 246); ctx.stroke();
    if (!sample) ctx.drawImage(qr, 800, height - 226, 220, 220);
    ctx.fillStyle = '#323d48'; ctx.font = `600 27px ${FONT}`;
    ctx.fillText(sample ? '미리보기 · 실제 친구 평가가 아닌 샘플입니다' : '친구들이 보는 너는 어떤 호랑이?', 60, height - 204);
    ctx.fillStyle = '#78818a'; ctx.font = `400 21px ${FONT}`;
    if (!sample) {
      ctx.fillText(url.host, 60, height - 149);
      ctx.fillText(`${url.pathname}${url.search}`, 60, height - 111);
    }
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지 저장에 실패했어요.')), 'image/png'));
    const filename = `${String(nickname).replace(/[^\p{L}\p{N}_-]/gu, '') || 'tiger'}-${kind}-${perspective}${sample ? '-sample' : ''}-${format}.png`;
    const file = new File([blob], filename, { type: 'image/png' });
    const close = preview(canvas.toDataURL('image/png'), file, url.href, title, onClose, personalize, sample);
    return { file, blob, close };
  } catch (error) { active = false; throw error; }
}
