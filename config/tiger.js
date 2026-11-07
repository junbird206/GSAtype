export const theme = {
  id: 'tiger',
  name: '나의 호랑이 유형은?',
  signupUrl: 'https://goo.gle/koreaseoul',
  stats: [
    { key: 'grade', name: '학구력', short: '학구력', low: '필요한 만큼 차근차근', high: '궁금하면 끝까지', question: '공부할 때 이 사람은?', icon: 'BookOpen' },
    { key: 'stamina', name: '체력', short: '체력', low: '중간중간 충전하는 편', high: '하루 종일 에너지 가득', question: '하루를 보내는 에너지는?', icon: 'Zap' },
    { key: 'social', name: '인싸력', short: '인싸력', low: '익숙한 사람과 깊게', high: '처음 본 사람과도 금세', question: '사람들과 어울릴 때는?', icon: 'Users' },
    { key: 'teamwork', name: '과제력', short: '과제력', low: '맡은 역할에 집중', high: '전체 진행까지 챙김', question: '팀플에서 보여주는 모습은?', icon: 'Layers' },
    { key: 'mental', name: '멘탈', short: '멘탈', low: '충분히 쉬며 회복', high: '금세 털고 다시 시작', question: '계획이 틀어졌을 때는?', icon: 'Heart' },
    { key: 'goyeon', name: '고연전', short: '고연전', low: '내 방식대로 조용히', high: '목청껏 응원하는 편', question: '고연전을 즐기는 방식은?', icon: 'Flag' },
  ],
  types: {
    grade: { name: '중광 밤샘형', oneLiner: '궁금한 건 끝까지. 깊이 파고드는 집중력.', image: '/assets/tigers/white.png', cardImage: '/assets/tigers/result-bg-white.png', color: '#285a60', tag: 'THE SCHOLAR' },
    stamina: { name: '개운사길 질주형', oneLiner: '긴 하루에도 먼저 일어서는 에너지.', image: '/assets/tigers/eng.png', cardImage: '/assets/tigers/result-bg-eng.png', color: '#28734f', tag: 'THE RUNNER' },
    social: { name: '과방 터줏대감형', oneLiner: '같이 있고 싶은 사람, 어디서나 연결의 중심.', image: '/assets/tigers/romance.png', cardImage: '/assets/tigers/result-bg-romance.png', color: '#a33c5a', tag: 'THE CONNECTOR' },
    teamwork: { name: '팀플 캐리형', oneLiner: '함께 시작한 일을 끝까지 완성하는 힘.', image: '/assets/tigers/spec.png', cardImage: '/assets/tigers/result-bg-spec.png', color: '#3961a0', tag: 'THE CAPTAIN' },
    mental: { name: '다시 뛰는 강철멘탈형', oneLiner: '한 번 넘어져도, 다음 장면은 내가 만든다.', image: '/assets/tigers/void.png', cardImage: '/assets/tigers/result-bg-void.png', color: '#735492', tag: 'THE COMEBACK' },
    goyeon: { name: '고연전 직관형', oneLiner: '함께하는 순간에 가장 뜨겁게 빛나는 사람.', image: '/assets/tigers/cheer.png', cardImage: '/assets/tigers/result-bg-cheer.png', color: '#ab1839', tag: 'THE SUPPORTER' },
    balanced: { name: '육각형 밸런스형', oneLiner: '어느 한쪽에 치우치지 않는 나만의 균형.', image: '/assets/tigers/white.png', cardImage: '/assets/tigers/result-bg-white.png', color: '#427568', tag: 'THE ALL-ROUNDER' },
  },
};

export const copy = {
  heroTitle: ['내가 아는 나,', '친구들이 아는 나.'],
  heroSubtitle: '친구들의 시선으로 완성하는 나의 호랑이 카드',
  newTitle: '먼저, 내가 보는 나',
  newDescription: '내 예상 카드를 만들고 친구들의 생각을 들어봐요.',
  lockedTitle: '친구들이 보면 어떻게 달라질까?',
  lockedDescription: '3명이 모이면 친구들의 카드와 비교 결과가 열려요.',
  resultTitle: '친구들이 발견한 나',
};

export function facePrompt(card, result) {
  return `첨부한 이미지 2장으로 선수 카드의 인물만 교체해 줘.

[이미지 역할]
첫 번째 이미지 = 수정할 원본 카드. 두 번째 이미지 = 카드에 넣을 내 상반신 사진.
첨부 순서가 다르면 호랑이와 스탯이 있는 이미지를 원본 카드로, 사람이 있는 사진을 인물 참고로 구분해 줘.

[수정할 부분]
카드 중앙의 호랑이 캐릭터와 캐릭터가 들고 있는 소품만 제거하고, 그 자리에 두 번째 사진 속 사람의 상반신을 자연스럽게 합성해 줘.
사진 속 얼굴형, 이목구비, 피부색, 헤어스타일, 안경과 의상은 그대로 유지해 줘. 실사 인물로 표현하고, 호랑이 귀·꼬리·줄무늬를 추가하거나 캐리커처로 바꾸지 마.
머리와 양쪽 어깨가 카드 안에 들어오도록 크기를 맞춰 줘. 하반신이나 사진에 없는 손을 새로 만들지 마. 인물 아래쪽은 기존 배경에 부드럽게 연결하고, 얼굴이나 몸이 OVR·닉네임·유형·스탯을 가리지 않게 해 줘.
인물의 조명과 색감만 카드 배경에 맞춰 조정해 줘.

[반드시 보존할 부분]
원본 카드의 전체 가로세로 비율, 바깥 여백, 테두리, 배경, 글자 위치·서체·크기, 모든 숫자와 문구를 유지해 줘. QR코드와 링크가 있으면 그대로 보존해 줘. 새 카드로 재디자인하거나 자르지 마.
아래는 확인용 데이터이며 새로운 문구를 추가하라는 지시가 아니야. 원본에 표시된 글자를 그대로 유지해 줘.
닉네임: ${JSON.stringify(String(card.nickname))}
유형: ${result.type.name} / ${result.type.tag}
OVR: ${result.ovr}
스탯: ${theme.stats.map(s => `${s.name} ${result.numbers[s.key]}`).join(' · ')}
원본의 시점 문구와 미리보기 표시도 그대로 유지해 줘. 학교 로고·교표·엠블럼을 새로 추가하지 마.

편집한 이미지 한 장만 출력해 줘.`;
}
