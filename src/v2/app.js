import { createIcons, ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, Download, Share2, RefreshCw, X, LockKeyhole, ChevronRight, BookOpen, Zap, Users, Layers, Heart, Flag, Sparkles, ShieldCheck, Trash2 } from 'lucide';
import { theme, copy } from '../../config/tiger.js';
import { resultFor, difference, keys, radarPoints } from './model.js';
import { api, storage, deviceId, rememberOwner } from './api.js';
import { exportCard } from './export.js';
import { personalCard, personalCardPath } from './personalization.js';
import { writeClipboard } from './clipboard.js';
import './styles.css';

const icons = { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy, Download, Share2, RefreshCw, X, LockKeyhole, ChevronRight, BookOpen, Zap, Users, Layers, Heart, Flag, Sparkles, ShieldCheck, Trash2 };
const app = document.querySelector('#app');
const state = { card: null, tab: 'friends', self: {}, ratings: {}, nickname: '', busy: false, epoch: 0, poll: null };
const channels = ['kakao', 'insta', 'everytime', 'gopas', 'poster_qr'];
const initialParams = new URLSearchParams(location.search);
const channel = channels.includes(initialParams.get('ch')) ? initialParams.get('ch') : storage.get('tiger:channel') || 'direct';
storage.set('tiger:channel', channel);
const ownerMatch = location.pathname.match(/^\/c\/([a-zA-Z0-9-]+)/);
const recovery = new URLSearchParams(location.hash.slice(1)).get('key') || initialParams.get('k');
if (ownerMatch && recovery) {
  rememberOwner({ id: ownerMatch[1], ownerKey: recovery });
  initialParams.delete('k');
  history.replaceState({}, '', location.pathname + (initialParams.size ? `?${initialParams}` : ''));
}

function icon(name, className = '') { return `<i data-lucide="${name}" class="${className}" aria-hidden="true"></i>`; }
function esc(text = '') { return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function hydrate() { createIcons({ icons, attrs: { 'stroke-width': 1.8 } }); }
function track(name, props = {}) { window.gtag?.('event', name, { theme: theme.id, ch: channel, ...props }); }
function once(key, event, props = {}) { if (storage.get(key)) return; track(event, props); storage.set(key, '1'); }
function signup(placement) {
  const url = new URL(theme.signupUrl);
  Object.entries({ utm_source: 'mytigertype', utm_medium: 'web', utm_campaign: 'gsa_phase2', utm_content: placement }).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.href;
}
function footer() { return `<footer class="site-footer"><span>MY TIGER TYPE · 고려대 친구 도감</span><div><button class="text-button" data-action="privacy">데이터 안내</button><a href="${signup('footer')}" data-cta="footer" target="_blank" rel="noopener noreferrer">Gemini 알아보기 ${icon('ArrowUpRight')}</a></div></footer>`; }
function shell(content, back = '/') {
  app.innerHTML = `<header class="site-header"><a class="brand" href="/" data-route><span class="brand-mark">T.</span><span>MY TIGER TYPE</span></a><div class="header-actions">${location.pathname !== '/' ? `<a class="icon-button" href="${back}" data-route aria-label="이전 화면" title="이전 화면">${icon('ArrowLeft')}</a>` : ''}${storage.get('tiger:last-card') ? `<a class="my-card-link" href="/c/${esc(storage.get('tiger:last-card'))}" data-route>내 카드 ${icon('ArrowUpRight')}</a>` : '<span class="header-tag">고려대 친구 도감</span>'}</div></header><main id="main" tabindex="-1">${content}</main>${footer()}`;
  hydrate();
}
function navigate(path) { history.pushState({}, '', path); renderRoute(); window.scrollTo(0, 0); }
window.addEventListener('popstate', renderRoute);
function toast(text) {
  const node = document.querySelector('#toast'); node.textContent = text; node.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('visible'), 3500);
}
async function copyText(text, message = '복사했어요. 친구에게 보내 주세요.') {
  if (!await writeClipboard(text)) {
    const dialog = showDialog('내용을 직접 복사해 주세요', `<textarea class="copy-field" rows="8" readonly aria-label="복사할 내용">${esc(text)}</textarea>`);
    dialog.querySelector('textarea').select();
    return false;
  }
  toast(message);
  return true;
}
function publicUrl(card, ch = 'kakao') { return `${location.origin}/r/${card.shareId}?ch=${ch}`; }
function cardMarkup(card, scores, { count = 0, sample = false, compact = false } = {}) {
  const result = resultFor(scores, count);
  return `<article class="player-card tier-${result.tier.id}${compact ? ' compact-card' : ''}" style="--type-color:${result.type.color}" aria-label="${esc(card.nickname)}님의 ${esc(result.type.name)} ${sample ? '예시' : ''} 카드">
    <div class="card-frame" aria-hidden="true"></div><div class="card-surface">
    <img class="player-scene" src="${result.type.cardImage}" width="1024" height="1536" alt="${result.type.name} 호랑이와 캠퍼스 배경" fetchpriority="high">
    <div class="card-topline"><span>MY TIGER TYPE</span>${sample ? '<span>SAMPLE</span>' : count >= 3 ? `<span>${result.tier.name}</span>` : ''}</div>
    <div class="ovr"><strong>${result.ovr}</strong><span>OVR</span><i aria-hidden="true"></i></div><div class="card-edition">KU<br><b>2026</b></div>
    <div class="player-name"><span>${esc(card.nickname)}</span><h2>${result.type.name}</h2><p>${result.type.tag}</p></div>
    <div class="card-stats">${theme.stats.map(stat => `<div><strong>${result.numbers[stat.key]}</strong><span>${stat.short}</span></div>`).join('')}</div>
    <div class="card-bottom">${card.preview ? '미리보기 · 실제 평가 아님' : sample ? '카드 예시' : count >= 3 ? `친구 ${count}명의 시선으로 완성` : '내가 본 나'}</div>
    </div>
  </article>`;
}
function landing() {
  const sample = { grade: 4, stamina: 3, social: 4.5, teamwork: 4, mental: 3.5, goyeon: 5 };
  shell(`<section class="home"><p class="eyebrow">나의 호랑이 유형은?</p><h1>${copy.heroTitle.join('<br>')}</h1><p class="intro">${copy.heroSubtitle}</p><div class="home-card">${cardMarkup({ nickname: '안암의 호랑이' }, sample, { count: 5, sample: true })}</div><div class="home-action"><a href="/new" data-route class="primary-button">내 호랑이 카드 만들기 ${icon('ArrowRight')}</a><p class="micro">가입 없이 · 6가지 스탯 · 내 예상 카드는 바로</p></div><div class="home-footnote"><span>01 <b>내가 먼저</b></span><span>02 <b>친구 3명이</b></span><span>03 <b>함께 완성</b></span></div></section>`);
}
function ratingFields(scores, self = false) {
  return `<div class="rating-fields">${theme.stats.map((stat, index) => `<fieldset class="stat-field"><legend><span class="stat-icon">${icon(stat.icon)}</span><strong>${stat.name}</strong><span class="field-number">0${index + 1}</span></legend><p>${self ? stat.question.replace('이 사람은', '나는') : stat.question}</p><div class="rating-scale">${[1, 2, 3, 4, 5].map(value => `<label><input type="radio" name="${stat.key}" value="${value}" ${scores[stat.key] === value ? 'checked' : ''} required><span>${value}</span><span class="sr-only">${stat.name} ${value}점</span></label>`).join('')}</div><div class="scale-labels"><span>${stat.low}</span><span>${stat.high}</span></div></fieldset>`).join('')}</div>`;
}
function newCard() {
  shell(`<section class="form-page"><div class="page-heading"><p class="eyebrow">MY FIRST CARD</p><h1>${copy.newTitle}</h1><p>${copy.newDescription}</p></div><form id="new-form"><div class="nickname-field"><label for="nickname">카드에 적을 이름</label><input id="nickname" name="nickname" value="${esc(state.nickname)}" placeholder="친구들이 아는 내 별명" minlength="2" maxlength="20" autocomplete="nickname" required aria-describedby="nickname-hint"><p id="nickname-hint">2~10자 · 실명 대신 별명도 좋아요</p></div><div class="form-section-title"><h2>나의 여섯 가지 스탯</h2><span id="answer-count">${Object.keys(state.self).length} / 6</span></div>${ratingFields(state.self, true)}<p class="form-note">점수가 높아야 좋은 건 아니에요. 나와 가까운 쪽을 골라요.</p><p id="form-error" class="form-error" role="alert"></p><div class="form-bottom"><button class="primary-button" type="submit" ${validForm(state.self, state.nickname) ? '' : 'disabled'}>내 예상 카드 만들기 ${icon('ArrowRight')}</button><p class="micro">내 답변은 친구에게 공개되지 않아요.</p></div></form></section>`);
}
function validForm(scores, nickname = '호랑이') { const length = Array.from(nickname.trim()).length; return keys.every(key => scores[key]) && length >= 2 && length <= 10; }
function formStatus() {
  const isSelf = location.pathname === '/new'; const scores = isSelf ? state.self : state.ratings;
  const form = document.querySelector('form'); if (!form) return;
  const count = document.querySelector('#answer-count'); if (count) count.textContent = `${Object.keys(scores).length} / 6`;
  form.querySelector('[type=submit]').disabled = state.busy || !validForm(scores, isSelf ? state.nickname : undefined);
}
function progress(card) {
  const result = resultFor(card.selfScores || card.averages || Object.fromEntries(keys.map(k => [k, 3])), card.count);
  const target = result.tier.next;
  return `<section class="progress-section"><div class="section-label"><span>${card.count < 3 ? '친구들의 시선 모으는 중' : `${result.tier.name} 카드`}</span><strong>${card.count}<span> / ${target || 30}명</span></strong></div><div class="progress-track" role="progressbar" aria-label="친구 평가 수" aria-valuenow="${card.count}" aria-valuemin="0" aria-valuemax="${target || 30}"><span style="width:${Math.min(100, card.count / (target || 30) * 100)}%"></span></div><p>${card.count < 3 ? `<b>${3 - card.count}명</b> 더 모이면 친구들의 카드가 열려요.` : target ? `<b>${target - card.count}명</b> 더 모이면 ${target === 5 ? '실버' : '골드'} 카드로!` : card.count >= 30 ? '30명의 평가가 모두 모였어요.' : '골드 달성! 친구들의 시선은 계속 쌓여요.'}</p></section>`;
}
function comparison(card) {
  const diff = difference(card.selfScores, card.averages);
  return `<section class="comparison-section" id="comparison"><p class="eyebrow">THE GAP</p><h2>내가 아는 나와<br>친구들이 아는 나</h2><p class="gap-summary">${diff.text}</p><div class="chart-legend"><span><i class="self-dot"></i>내가 본 나</span><span><i class="friend-dot"></i>친구들이 본 나</span></div><div class="comparison-chart">${theme.stats.map(stat => `<div class="comparison-row"><strong>${stat.name}</strong><div class="bar-pair"><div><span class="self-bar" style="width:${card.selfScores[stat.key] / 5 * 100}%"></span><em>${card.selfScores[stat.key].toFixed(1)}</em></div><div><span class="friend-bar" style="width:${card.averages[stat.key] / 5 * 100}%"></span><em>${card.averages[stat.key].toFixed(1)}</em></div></div></div>`).join('')}</div><p class="micro">각자의 시선은 다를 수 있어요. 1~5점 기준.</p><button class="secondary-button" data-action="export-gap">이 차이도 공유하기 ${icon('Download')}</button></section>`;
}
function radar(scores) {
  return `<div class="radar-wrap"><svg viewBox="0 0 200 200" role="img" aria-label="여섯 스탯 레이더 차트">${[1,2,3,4,5].map(n => `<polygon points="${radarPoints(Object.fromEntries(keys.map(k => [k,n])))}" fill="none" stroke="#dedfe2"/>`).join('')}<polygon points="${radarPoints(scores)}" fill="#a8173a26" stroke="#a8173a" stroke-width="2"/></svg><div class="radar-values">${theme.stats.map(stat => `<span>${stat.name}<strong>${scores[stat.key].toFixed(1)}</strong></span>`).join('')}</div></div>`;
}
function dashboard(card) {
  const unlocked = card.count >= 3 && card.averages;
  const friendView = unlocked && state.tab === 'friends';
  const scores = friendView ? card.averages : card.selfScores;
  const result = resultFor(scores, friendView ? card.count : 0);
  shell(`<section class="dashboard"><div class="page-heading"><p class="eyebrow">${unlocked ? 'OUR TIGER CARD' : 'MY PREDICTION'}</p><h1>${unlocked ? copy.resultTitle : '이건, 내가 보는 나'}</h1><p>${unlocked ? `${esc(card.nickname)}님을 아는 ${card.count}명의 시선` : '내 예상 카드가 나왔어요. 친구들은 어떻게 볼까요?'}</p></div>${unlocked ? `<div class="view-tabs" role="tablist" aria-label="카드 시점"><button role="tab" aria-selected="${friendView}" data-action="tab-friends">친구들이 본 나</button><button role="tab" aria-selected="${!friendView}" data-action="tab-self">내가 본 나</button></div>` : ''}<div id="card-export" class="card-export">${cardMarkup(card, scores, { count: friendView ? card.count : 0 })}</div><p class="type-description">${result.type.oneLiner}</p>${result.leaders.length > 1 && !result.balanced ? `<p class="micro tie-note">공동 강점: ${result.leaders.map(k => theme.stats.find(s => s.key === k).name).join(' · ')}<br>같은 점수는 정해진 스탯 순서로 표시해요.</p>` : ''}${friendView && result.secondary ? `<p class="secondary-type">또 다른 내 모습 <b>${result.secondary.name}</b></p>` : ''}${progress(card)}<div class="share-actions"><button class="primary-button" data-action="share">${card.count >= 30 ? '내 카드 자랑하기' : '친구에게 평가 부탁하기'} ${icon('Share2')}</button><div class="button-pair"><button class="secondary-button" data-action="copy-link">${icon('Copy')} 링크 복사</button><button class="secondary-button" data-action="export-card">${icon('Download')} 카드 저장</button></div></div>${!unlocked ? `<section class="locked-comparison"><div class="locked-icon">${icon('LockKeyhole')}</div><h2>${copy.lockedTitle}</h2><p>${copy.lockedDescription}</p><div class="locked-bars" aria-hidden="true"><span></span><span></span><span></span></div></section>` : `${comparison(card)}<section class="detail-section"><h2>친구들이 본 여섯 가지 스탯</h2>${radar(card.averages)}<p class="micro">평가가 쌓이면 유형과 점수도 달라질 수 있어요.</p></section>`}<section class="owner-tools"><button class="recovery-button" data-action="recovery">${icon('ShieldCheck')} 내 카드 다시 찾을 링크 보관 ${icon('ChevronRight')}</button><p>카톡 창이 닫혀도 다시 돌아올 수 있게 보관해 주세요.</p><button class="text-button" data-action="refresh">${icon('RefreshCw')} 새 평가 확인</button></section><a class="gemini-link" href="${personalCardPath(card, friendView ? 'friends' : 'self')}" data-route><img src="/assets/gemini/google-gemini-lockup.png" alt="Google Gemini"><span>이 카드에 내 얼굴도 담아볼까?</span>${icon('ArrowUpRight')}</a></section>`);
  if (card.preview) {
    const notice = document.createElement('aside');
    notice.className = 'preview-notice';
    notice.innerHTML = `<div><strong>친구 3명 평가 미리보기</strong><p>무작위 샘플 점수예요. 실제 평가에는 저장되지 않아요.</p></div><a href="/c/${card.id}" data-route>미리보기 닫기</a>`;
    document.querySelector('.dashboard').prepend(notice);
    for (const action of ['share', 'copy-link', 'export-gap']) {
      const button = app.querySelector(`[data-action="${action}"]`);
      if (button) { button.disabled = true; button.title = '미리보기에서는 공유하지 않아요.'; }
    }
  }
  if (unlocked && !card.preview) {
    once(`tiger:unlock:${card.id}`, 'card_unlock');
    for (const [threshold,tier] of [[5,'silver'],[10,'gold']]) if (card.count >= threshold) once(`tiger:tier:${card.id}:${tier}`, 'tier_up', { tier });
  }
}
function rate(card) {
  if (card.count >= 30) return shell(`<section class="message-page">${icon('Check')}<h1>이 카드는 완성됐어요</h1><p>30명의 친구들이 함께했어요.</p>${cardMarkup(card, card.averages, { count: card.count })}<a href="/new" class="primary-button" data-route>내 카드도 만들기 ${icon('ArrowRight')}</a></section>`);
  if (storage.get(`tiger:rated:${card.shareId}`)) return done(card);
  shell(`<section class="form-page"><div class="page-heading"><p class="eyebrow">A FRIEND'S PERSPECTIVE</p><h1><span class="nickname-title">${esc(card.nickname)}</span>님은<br>어떤 호랑이인가요?</h1><p>정답은 없어요. 내가 아는 친구의 모습을 골라 주세요.</p></div><div class="rater-context">${icon('Heart')}<span>친구에게는 평균만 보여요. 내 답변은 비공개.</span></div><form id="rating-form"><div class="form-section-title"><h2>내가 보는 ${esc(card.nickname)}</h2><span id="answer-count">${Object.keys(state.ratings).length} / 6</span></div>${ratingFields(state.ratings)}<p id="form-error" class="form-error" role="alert"></p><div class="form-bottom"><button type="submit" class="primary-button" ${validForm(state.ratings) ? '' : 'disabled'}>이 모습으로 전해주기 ${icon('ArrowRight')}</button><p class="micro">6번의 선택이면 충분해요.</p></div></form></section>`);
}
function done(card) {
  const rated = storage.get(`tiger:rated:${card.shareId}`);
  shell(`<section class="done-page"><div class="done-check">${icon('Check')}</div><p class="eyebrow">${rated ? 'A LITTLE MORE COMPLETE' : 'FRIENDS MAKE THE CARD'}</p><h1>${rated ? '친구의 카드에<br>내 시선을 더했어요' : '친구들의 시선이<br>모이고 있어요'}</h1><p class="intro">${esc(card.nickname)}님 ${card.count >= 3 ? `카드가 ${card.count}명의 시선으로 완성됐어요.` : `카드 완성까지 ${3 - card.count}명 남았어요.`}</p>${card.count >= 3 && card.averages ? `<div class="done-card">${cardMarkup(card, card.averages, { count: card.count })}</div>` : `<div class="done-progress">${progress(card)}</div>`}<section class="conversion-section"><p class="eyebrow">WHAT ABOUT YOU?</p><h2>친구들이 보는 나는<br>조금 다를지도?</h2><p>내 예상 카드는 바로, 친구들의 생각은 모아서.</p><a class="primary-button" href="/new" data-route data-conversion>내 카드도 만들어 보기 ${icon('ArrowRight')}</a></section><a class="text-link" href="${signup('rater_done')}" data-cta="rater_done" target="_blank" rel="noopener noreferrer">Gemini 알아보기 ${icon('ArrowUpRight')}</a></section>`);
}
function face(card) {
  const selection = personalCard(card, new URLSearchParams(location.search).get('view'));
  state.tab = selection.perspective;
  shell(`<section class="face-page">
    ${card.preview ? '<aside class="preview-notice"><div><strong>친구 3명 평가 미리보기</strong><p>저장 이미지에도 샘플 표시가 남아요. 실제 평가에는 저장되지 않아요.</p></div></aside>' : ''}
    <div class="page-heading"><p class="eyebrow">MAKE IT YOURS</p><h1>이번엔, 내 얼굴로.</h1><p>내 유형도, 스탯도 그대로.<br>카드 속 주인공만 나로 바꿔요.</p></div>
    <div id="card-export" class="card-export">${cardMarkup(card, selection.scores, { count: selection.count })}</div>
    <p class="face-perspective">${selection.perspective === 'self' ? '내가 본 나' : '친구들이 본 나'} · ${esc(card.nickname)}</p>
    <ol class="face-steps">
      <li><span class="step-number">01</span><div><h2>이 카드를 저장하고</h2><button class="secondary-button" data-action="export-card">${icon('Download')} 카드 이미지 저장</button></div></li>
      <li><span class="step-number">02</span><div><h2>내 카드 전용 프롬프트 복사</h2><button class="primary-button" data-action="copy-prompt">${icon('Copy')} 프롬프트 복사</button><details class="prompt-section"><summary>프롬프트 내용 보기</summary><pre id="face-prompt">${esc(selection.prompt)}</pre></details></div></li>
      <li><span class="step-number">03</span><div><h2>사진 두 장과 함께</h2><p>저장한 카드와 내 상반신 사진을 첨부하고,<br>복사한 프롬프트를 붙여 넣어 주세요.</p><a class="secondary-button gemini-open" href="https://gemini.google.com/app" data-gemini target="_blank" rel="noopener noreferrer"><img src="/assets/gemini/google-gemini-lockup.png" alt="Google Gemini">열기 ${icon('ArrowUpRight')}</a></div></li>
    </ol>
    <p class="form-note">얼굴과 양쪽 어깨가 잘 보이는 본인 사진을 사용해 주세요.<br>사진은 Gemini에 직접 첨부하며, 이 사이트에는 저장되지 않아요.<br>AI 편집 후 글자·점수·QR코드가 원본과 같은지 확인해 주세요.</p>
    <a class="gemini-link face-signup" href="${signup('face_card')}" data-cta="face_card" target="_blank" rel="noopener noreferrer"><img src="/assets/gemini/google-gemini-lockup.png" alt="Google Gemini"><span>Google AI 학생 혜택 확인하기</span>${icon('ArrowUpRight')}</a>
  </section>`, `/c/${card.id}${card.preview ? '?preview=friends' : ''}`);
}
function errorPage(error, retry = true) {
  shell(`<section class="message-page"><div class="locked-icon">${icon('LockKeyhole')}</div><h1>${error.status === 403 ? '내 카드 링크가 필요해요' : error.status === 404 ? '카드를 찾지 못했어요' : '잠깐, 연결을 확인해 주세요'}</h1><p>${error.status === 403 ? '카드를 만든 브라우저로 돌아가거나, 보관한 내 카드 링크를 열어 주세요.' : esc(error.message)}</p>${retry && error.status !== 403 && error.status !== 404 ? '<button class="primary-button" data-action="refresh">다시 시도</button>' : ''}<a href="/" data-route class="secondary-button">처음으로</a></section>`);
}
async function renderRoute() {
  const epoch = ++state.epoch; clearInterval(state.poll); state.poll = null; state.busy = false;
  const path = location.pathname;
  track('page_view', { page_location: location.origin + path, page_title: theme.name });
  if (path === '/') { landing(); return; }
  if (path === '/new') { newCard(); return; }
  const match = path.match(/^\/(c|r)\/([a-zA-Z0-9_-]+)(?:\/(face|done))?\/?$/);
  if (!match || (match[1] === 'c' && match[3] === 'done') || (match[1] === 'r' && match[3] === 'face')) return errorPage({ status: 404, message: '링크를 다시 확인해 주세요.' }, false);
  const [, kind, id, sub] = match;
  shell('<section class="message-page"><div class="loading-spinner"></div><p>호랑이 카드를 불러오는 중</p></section>');
  try {
    const ownerKey = kind === 'c' ? storage.get(`tiger:owner:${id}`) : undefined;
    if (kind === 'c' && !ownerKey) throw Object.assign(new Error('주인 링크가 필요해요.'), { status: 403 });
    let card = await api(kind === 'c' ? `/cards/${id}` : `/public/${id}`, { ownerKey });
    if (import.meta.env.DEV && kind === 'c' && new URLSearchParams(location.search).get('preview') === 'friends') {
      const { withSampleFriends } = await import('./friends-preview.js');
      card = withSampleFriends(card);
      if (!state.card?.preview) state.tab = 'friends';
    }
    if (epoch !== state.epoch) return;
    if (state.card?.shareId !== card.shareId) state.ratings = {};
    state.card = card;
    if (kind === 'c') {
      if (sub === 'face') face(card); else { dashboard(card); if (!card.preview) startPolling(id, ownerKey, epoch); }
    } else if (sub === 'done') done(card); else rate(card);
  } catch (error) { if (epoch === state.epoch) errorPage(error); }
}
function startPolling(id, ownerKey, epoch) {
  state.poll = setInterval(async () => {
    if (document.hidden || state.busy || document.querySelector('dialog[open]')) return;
    try {
      const card = await api(`/cards/${id}`, { ownerKey });
      if (epoch !== state.epoch) return;
      if (card.count !== state.card.count) { state.card = card; dashboard(card); toast('친구의 새로운 시선이 도착했어요.'); }
    } catch { /* Keep the current card visible during temporary network failures. */ }
  }, 12000);
}
app.addEventListener('input', event => { if (event.target.id === 'nickname') { state.nickname = event.target.value; formStatus(); } });
app.addEventListener('change', event => {
  if (!event.target.matches('input[type=radio]')) return;
  const isSelf = location.pathname === '/new';
  const scores = isSelf ? state.self : state.ratings;
  if (!isSelf && !Object.keys(scores).length) track('rating_start');
  scores[event.target.name] = Number(event.target.value); formStatus();
});
app.addEventListener('submit', async event => {
  if (!event.target.matches('#new-form, #rating-form')) return;
  event.preventDefault(); if (state.busy) return;
  const isSelf = event.target.id === 'new-form';
  const epoch = state.epoch; state.busy = true; formStatus();
  const button = event.target.querySelector('[type=submit]'); const old = button.innerHTML;
  button.textContent = isSelf ? '내 카드를 만드는 중' : '친구에게 전하는 중';
  document.querySelector('#form-error').textContent = '';
  try {
    if (isSelf) {
      const card = await api('/cards', { method: 'POST', body: { nickname: state.nickname.trim(), selfScores: state.self, deviceId: deviceId(), channel } });
      rememberOwner(card); track('card_create'); state.self = {}; state.nickname = ''; state.tab = 'friends';
      if (epoch === state.epoch) { navigate(`/c/${card.id}`); toast('예상 카드가 나왔어요. 친구들의 생각도 들어볼까요?'); }
    } else {
      const shareId = state.card.shareId;
      await api(`/public/${shareId}/ratings`, { method: 'POST', body: { scores: state.ratings, deviceId: deviceId(), channel } });
      storage.set(`tiger:rated:${shareId}`, '1'); track('rating_complete'); state.ratings = {};
      if (epoch === state.epoch) navigate(`/r/${shareId}/done`);
    }
  } catch (error) {
    if (epoch === state.epoch) {
      document.querySelector('#form-error').textContent = error.message;
      document.querySelector('#form-error').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  } finally { if (epoch === state.epoch) { state.busy = false; if (button.isConnected) { button.innerHTML = old; formStatus(); hydrate(); } } }
});
function showDialog(title, content) {
  const previous = document.activeElement;
  const dialog = document.createElement('dialog'); dialog.className = 'app-dialog';
  dialog.innerHTML = `<div class="dialog-heading"><h2>${title}</h2><button class="icon-button" data-close aria-label="닫기">${icon('X')}</button></div>${content}`;
  document.body.append(dialog); hydrate();
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { dialog.remove(); previous?.focus(); });
  dialog.showModal(); return dialog;
}
async function share() {
  const card = state.card; const url = publicUrl(card); const title = '나의 호랑이 유형은?';
  const text = card.count >= 3 ? `친구들이 본 나는 ${resultFor(card.averages).type.name}이래. 너도 해봐!` : '나 어떤 호랑이인지 30초만 봐줘!';
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); track('share_click', { method: 'native', stage: card.count >= 3 ? 'post' : 'pre' }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  await copyText(`${text}\n${url}`); track('share_click', { method: 'link', stage: card.count >= 3 ? 'post' : 'pre' });
}
app.addEventListener('click', async event => {
  const link = event.target.closest('[data-route]');
  if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); if (link.hasAttribute('data-conversion')) track('rater_to_creator'); navigate(link.getAttribute('href')); return; }
  if (event.target.closest('[data-cta]')) track('cta_click', { placement: event.target.closest('[data-cta]').dataset.cta });
  if (event.target.closest('[data-gemini]')) track('gemini_open');
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === 'tab-friends' || action === 'tab-self') { state.tab = action === 'tab-friends' ? 'friends' : 'self'; dashboard(state.card); document.querySelector(`[data-action="${action}"]`)?.focus(); }
    if (action === 'refresh') await renderRoute();
    if (action === 'share') await share();
    if (action === 'copy-link') { await copyText(publicUrl(state.card)); track('share_click', { method: 'link', stage: state.card.count >= 3 ? 'post' : 'pre' }); }
    if (action === 'export-card' || action === 'export-gap') {
      button.disabled = true; state.busy = true;
      const card = state.card;
      const selection = personalCard(card, state.tab);
      await exportCard({
        node: document.querySelector(action === 'export-gap' ? '#comparison' : '#card-export'),
        nickname: card.nickname, kind: action === 'export-gap' ? 'comparison' : 'card',
        shareUrl: publicUrl(card, 'insta'), perspective: selection.perspective, sample: Boolean(card.preview),
        personalize: action === 'export-card' ? {
          prompt: selection.prompt,
          onCopy: () => track('prompt_copy', { placement: 'export' }),
          onOpen: () => track('gemini_open', { placement: 'export' }),
          onContinue: () => navigate(personalCardPath(card, selection.perspective)),
        } : undefined,
      });
      if (!card.preview) track('share_click', { method: 'image', stage: card.count >= 3 ? 'post' : 'pre' });
    }
    if (action === 'copy-prompt') {
      if (await copyText(document.querySelector('#face-prompt').textContent, '프롬프트를 복사했어요. Gemini에 사진 두 장과 함께 붙여 넣어 주세요.')) {
        button.innerHTML = `${icon('Check')} 복사 완료`; hydrate(); track('prompt_copy', { placement: 'face' });
      }
    }
    if (action === 'recovery') {
      const key = storage.get(`tiger:owner:${state.card.id}`);
      const url = `${location.origin}/c/${state.card.id}#key=${encodeURIComponent(key)}`;
      const dialog = showDialog('이 링크는 나만 보관해요', `<p>내 카드와 자기평가를 다시 볼 수 있는 주인용 링크예요. 친구에게는 평가 링크를 보내 주세요.</p><input class="copy-field" readonly value="${esc(url)}" aria-label="주인용 복구 링크"><button class="primary-button" id="copy-recovery">${icon('Copy')} 내 카드 링크 복사</button>`);
      dialog.querySelector('#copy-recovery').onclick = async () => { await copyText(url); toast('주인용 링크를 복사했어요. 나에게 보내기로 보관해 주세요.'); };
    }
    if (action === 'privacy') {
      const dialog = showDialog('내 카드 데이터 안내', `<p>닉네임과 자기평가, 친구들의 점수를 저장해요. 친구에게는 닉네임과 평가 수, 3명 이상일 때의 평균만 공개해요.</p><p>중복 평가를 줄이기 위한 기기 식별값과 요청 제한용 IP는 서버에서 해시 처리해요. 실명·학번·사진은 받지 않아요.</p><p>카드 데이터는 2027년 1월 31일까지 보관해요. 브라우저 데이터가 사라지면 보관한 주인용 링크가 있어야 내 카드를 찾을 수 있어요.</p>${state.card?.id && storage.get(`tiger:owner:${state.card.id}`) ? '<button class="danger-button" id="delete-card">내 카드와 평가 삭제</button>' : ''}`);
      dialog.querySelector('#delete-card')?.addEventListener('click', () => {
        dialog.close(); const confirm = showDialog('이 카드를 삭제할까요?', '<p>친구들의 평가도 함께 삭제되며 복구할 수 없어요.</p><button class="danger-button" id="confirm-delete">카드 영구 삭제</button>');
        confirm.querySelector('#confirm-delete').onclick = async event => {
          event.target.disabled = true;
          try { const id = state.card.id; await api(`/cards/${id}`, { method: 'DELETE', ownerKey: storage.get(`tiger:owner:${id}`) }); storage.remove(`tiger:owner:${id}`); if (storage.get('tiger:last-card') === id) storage.remove('tiger:last-card'); state.card = null; confirm.close(); navigate('/'); toast('카드와 평가를 삭제했어요.'); }
          catch (error) { toast(error.message); event.target.disabled = false; }
        };
      });
    }
  } catch (error) { toast(error.message || '다시 한 번 시도해 주세요.'); }
  finally { button.disabled = false; state.busy = false; }
});

if (!['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date()); window.gtag('config', 'G-Z6042KHWDX', { send_page_view: false, page_location: location.origin + location.pathname });
  const script = document.createElement('script'); script.async = true; script.src = 'https://www.googletagmanager.com/gtag/js?id=G-Z6042KHWDX'; document.head.append(script);
}
renderRoute();
