const memory = new Map();
const messages = {
  UNAUTHORIZED: '내 카드 링크를 다시 열어 주세요. 주인 확인이 필요해요.',
  OWNER_CANNOT_RATE: '내 카드에는 평가할 수 없어요. 친구에게 링크를 보내 주세요.',
  ALREADY_RATED: '이미 마음을 전한 카드예요. 친구에게는 한 번만 평가할 수 있어요.',
  RATING_LIMIT: '30명의 평가가 모두 모여 마감됐어요.',
  RATE_LIMITED: '잠시 요청이 몰렸어요. 1분 뒤에 다시 시도해 주세요.',
  VALIDATION_ERROR: '별명은 2~10자로, 여섯 항목은 모두 골라 주세요. 부적절한 별명은 사용할 수 없어요.',
  UNAVAILABLE: '저장 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  NOT_FOUND: '카드를 찾지 못했어요. 링크를 다시 확인해 주세요.',
  CAMPAIGN_ENDED: '이번 호랑이 카드 캠페인이 끝났어요. 함께해 줘서 고마워요.',
};
export const storage = {
  get(key) { try { return localStorage.getItem(key) ?? memory.get(key); } catch { return memory.get(key); } },
  set(key, value) { memory.set(key, value); try { localStorage.setItem(key, value); } catch { /* Recovery links remain available without persistent storage. */ } },
  remove(key) { memory.delete(key); try { localStorage.removeItem(key); } catch {} },
};
export function deviceId() {
  let id = storage.get('tiger:device');
  if (!id) { id = crypto.randomUUID(); storage.set('tiger:device', id); }
  return id;
}
export function rememberOwner(card) {
  storage.set(`tiger:owner:${card.id}`, card.ownerKey);
  storage.set('tiger:last-card', card.id);
}
export async function api(path, { method = 'GET', body, ownerKey, signal } = {}) {
  const response = await fetch(`/api${path}`, {
    method, signal,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(ownerKey ? { Authorization: `Bearer ${ownerKey}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(messages[result.error?.code] || '잠시 연결이 끊겼어요. 다시 시도해 주세요.');
    error.status = response.status === 401 ? 403 : response.status;
    error.code = result.error?.code;
    throw error;
  }
  return result;
}
