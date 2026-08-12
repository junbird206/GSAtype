export const TEAM_SIGNUP_LINK = "https://example.com/team-signup-link";
export const TEST_PUBLIC_URL = "gsa-tiger.pages.dev";

export const TYPES = [
  {
    id: "white",
    name: "중앙광장 지하 거주 백호랑이",
    emoji: "📚",
    oneLiner: "1학기 충격을 딛고 학점 복구 버튼을 누른 타입",
    description:
      "이번 학기는 마음가짐부터 다릅니다. 중광이나 하스에 자리를 잡고, 밀린 강의와 전공서적을 차근차근 정리하는 쪽에 안정감을 느껴요. 완벽주의가 살짝 올라오지만, 그만큼 회복 탄력도도 좋은 편입니다. 쉬는 시간까지 계획에 넣으면 훨씬 오래 갑니다.",
    geminiStyle: "NotebookLM으로 전공서적 수백 페이지를 3분 요약해 뇌에 주입",
    goodMatch: "spec",
    badMatch: "romance",
    prompt:
      "이 전공 자료를 시험 대비용으로 3단계 요약해줘. 1단계는 핵심 개념, 2단계는 헷갈리는 비교표, 3단계는 예상 문제 5개로 정리해줘.",
    imageAsset: "./assets/tigers/white.svg"
  },
  {
    id: "cheer",
    name: "고연전 뽕 가득 응원단 호랑이",
    emoji: "📣",
    oneLiner: "9월 일정표의 중심이 강의실보다 응원석에 있는 타입",
    description:
      "사람이 모이는 곳에서 에너지가 살아납니다. 고연전, 뒤풀이, 동아리 일정이 겹쳐도 이상하게 힘이 나는 편이에요. 팀플에서도 분위기를 살리고 조율하는 능력이 좋습니다. 다만 마감은 생각보다 조용히 다가오니 캘린더 알림은 꼭 켜두세요.",
    geminiStyle: "팀플 회의록 요약과 발표 대본을 맡기고 응원 연습하러 감",
    goodMatch: "romance",
    badMatch: "eng",
    prompt:
      "이 회의록을 바탕으로 발표 흐름을 5분짜리 대본으로 만들어줘. 역할 분담과 다음 액션 아이템도 마지막에 표로 정리해줘.",
    imageAsset: "./assets/tigers/cheer.svg"
  },
  {
    id: "eng",
    name: "하나스퀘어 밤샘 공대 붉은 호랑이",
    emoji: "🛠️",
    oneLiner: "에러 로그와 실험 리포트 사이에서 살아남는 타입",
    description:
      "문제를 보면 원인부터 파고드는 해결사입니다. 과제, 실험, 코딩 에러처럼 끝이 보이지 않는 일에도 결국 답을 찾아내는 힘이 있어요. 말수는 줄어도 집중력은 깊어집니다. 가끔은 도움 요청도 생산성이라는 사실을 기억하면 좋습니다.",
    geminiStyle: "에러 로그와 수식을 던져서 1초 해독",
    goodMatch: "white",
    badMatch: "cheer",
    prompt:
      "이 에러 로그를 원인 후보별로 분석해줘. 가장 가능성 높은 원인, 확인 방법, 수정 예시 코드를 순서대로 알려줘.",
    imageAsset: "./assets/tigers/eng.svg"
  },
  {
    id: "void",
    name: "참살이길 카페 난민 우주공강 호랑이",
    emoji: "☕",
    oneLiner: "시간표가 만든 빈칸에 천천히 스며드는 타입",
    description:
      "우주공강이 생기면 처음엔 당황하지만, 어느새 자기만의 루틴을 만듭니다. 카페에서 멍때리거나 산책하며 머리를 비우는 시간이 생각보다 잘 맞아요. 급한 일에는 약해 보여도 의외로 막판 집중력이 있습니다. 계획은 작게 쪼갤수록 성공률이 올라갑니다.",
    geminiStyle: '딴짓용. "교수님 헌정 랩 가사 지어줘" 하며 시간 때움',
    goodMatch: "eng",
    badMatch: "spec",
    prompt:
      "오늘 4시간 공강 동안 할 일을 현실적으로 짜줘. 집중 25분, 휴식 10분 단위로 나누고 마지막 30분은 쉬는 시간으로 남겨줘.",
    imageAsset: "./assets/tigers/void.svg"
  },
  {
    id: "spec",
    name: "정후·법후 고시방 스펙업 호랑이",
    emoji: "📝",
    oneLiner: "이미 다음 학기와 다음 공모전까지 보고 있는 타입",
    description:
      "바쁘다는 말을 자주 듣지만, 사실 그 바쁨이 꽤 잘 어울립니다. 학회, 소모임, 공모전, 인턴 준비처럼 성장으로 이어지는 일을 빠르게 캐치해요. 초안을 만들고 구조를 세우는 데 강합니다. 번아웃을 피하려면 성과 없는 휴식도 일정에 넣어야 합니다.",
    geminiStyle: "기획서 초안과 자소서를 순식간에 구조화",
    goodMatch: "cheer",
    badMatch: "void",
    prompt:
      "이 아이디어를 공모전 기획서 초안으로 구조화해줘. 문제 정의, 타깃, 핵심 솔루션, 기대 효과, 실행 일정 순서로 써줘.",
    imageAsset: "./assets/tigers/spec.svg"
  },
  {
    id: "romance",
    name: "안암골 막걸리 사발 낭만파 호랑이",
    emoji: "🍶",
    oneLiner: "성적표보다 사람과 추억의 농도가 중요한 타입",
    description:
      "2학기의 맛을 제일 잘 압니다. 동기들과의 술자리, 갑작스러운 약속, 캠퍼스의 계절감에서 에너지를 얻어요. 느슨해 보여도 사람을 편하게 만드는 재능이 있습니다. 딱 한 가지, 결석 메일은 보내기 전에 한 번 더 읽고 보내면 완벽합니다.",
    geminiStyle: "숙취로 결석할 때 정중한 메일을 대신 써주는 용도",
    goodMatch: "void",
    badMatch: "white",
    prompt:
      "교수님께 보낼 정중한 결석 메일을 써줘. 핑계처럼 보이지 않게 간결하고 예의 있게, 보강 의지도 포함해줘.",
    imageAsset: "./assets/tigers/romance.svg"
  }
];

export const QUESTIONS = [
  {
    id: "q1",
    text: "2학기 첫 전공 팀플, 조장이 안 정해졌을 때 나는?",
    options: [
      { label: "A", text: "답답해서 내가 조장 맡고 기획서 초안부터 뽑는다", scores: { spec: 2, white: 1 } },
      { label: "B", text: "서기나 발표 맡고 편하게 가는 법을 연구한다", scores: { void: 2, cheer: 1 } },
      { label: "C", text: "일단 조용히 있는다. 누가 하겠지", scores: { romance: 2, void: 1 } },
      { label: "D", text: "자료조사랑 분석 파트를 자원한다", scores: { eng: 2, white: 1 } }
    ]
  },
  {
    id: "q2",
    text: "수강신청 망해서 우주공강 4시간이 생겼다.",
    options: [
      { label: "A", text: "중광 지하 가서 노트북 켠다", scores: { white: 2, eng: 1 } },
      { label: "B", text: "참살이길 가서 동기 불러낸다", scores: { romance: 2, cheer: 1 } },
      { label: "C", text: "카페에서 혼자 멍때리다 하루 끝난다", scores: { void: 2, romance: 1 } },
      { label: "D", text: "그 시간에 공모전 서류 쓴다", scores: { spec: 2, white: 1 } }
    ]
  },
  {
    id: "q3",
    text: "1학기 학점표를 받았을 때 내 심정은?",
    options: [
      { label: "A", text: "2학기엔 싹 쓸어담는다. 복수혈전", scores: { white: 2, spec: 1 } },
      { label: "B", text: "학점이 무슨 상관, 9월 고연전이나 즐기자", scores: { cheer: 2, romance: 1 } },
      { label: "C", text: "전공만 살렸으면 됐다", scores: { eng: 2, void: 1 } },
      { label: "D", text: "안 봤다. 안 볼 거다", scores: { void: 2, romance: 1 } }
    ]
  },
  {
    id: "q4",
    text: "영문 논문 50페이지 과제가 나왔다.",
    options: [
      { label: "A", text: "PDF 던져서 3줄 요약부터 시킨다", scores: { white: 2, spec: 1 } },
      { label: "B", text: "커피 사들고 한 줄씩 번역하며 벼락치기", scores: { eng: 2, white: 1 } },
      { label: "C", text: "마감 전날까지 안 연다", scores: { void: 2, romance: 1 } },
      { label: "D", text: "조원들이랑 나눠서 하자고 제안한다", scores: { cheer: 2, spec: 1 } }
    ]
  },
  {
    id: "q5",
    text: "금요일 밤, 내 기본값은?",
    options: [
      { label: "A", text: "안암 어딘가에서 술자리", scores: { romance: 2, cheer: 1 } },
      { label: "B", text: "동아리 또는 학회 모임", scores: { cheer: 2, spec: 1 } },
      { label: "C", text: "집. 밀린 과제", scores: { eng: 2, white: 1 } },
      { label: "D", text: "도서관. 주말에 놀려고 미리 함", scores: { white: 2, spec: 1 } }
    ]
  },
  {
    id: "q6",
    text: "카톡 프로필이 지금 어떤 상태인가?",
    options: [
      { label: "A", text: "단체 사진, 최근 행사", scores: { cheer: 2, romance: 1 } },
      { label: "B", text: "몇 년째 그대로", scores: { eng: 2, void: 1 } },
      { label: "C", text: "다이어리나 목표 문구", scores: { spec: 2, white: 1 } },
      { label: "D", text: "아무것도 없음", scores: { void: 2, eng: 1 } }
    ]
  },
  {
    id: "q7",
    text: "9월 고연전, 나는?",
    options: [
      { label: "A", text: "응원 연습부터 뒤풀이까지 풀참", scores: { cheer: 2, romance: 1 } },
      { label: "B", text: "경기만 보고 조용히 귀가", scores: { white: 2, eng: 1 } },
      { label: "C", text: "뒤풀이만 간다", scores: { romance: 2, cheer: 1 } },
      { label: "D", text: "그날 과제 마감이라 못 간다", scores: { eng: 2, spec: 1 } }
    ]
  },
  {
    id: "q8",
    text: "2학기가 끝났을 때 가장 듣고 싶은 말은?",
    options: [
      { label: "A", text: "너 학점 미쳤더라", scores: { white: 2, spec: 1 } },
      { label: "B", text: "너 진짜 재밌게 산다", scores: { romance: 2, cheer: 1 } },
      { label: "C", text: "그거 네가 만든 거야?", scores: { eng: 2, spec: 1 } },
      { label: "D", text: "너 요즘 뭐 그렇게 바빠?", scores: { spec: 2, cheer: 1 } }
    ]
  }
];
