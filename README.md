# 나의 호랑이 유형은? (친구 평가형 v2)

자기평가 예상 카드를 바로 만들고, 친구 3명의 평가가 모이면 친구들이 본 유형과 비교 리포트가 열리는 모바일 웹앱입니다. 원래 테스트 코드는 `src/`에 보존했고 새 앱은 `src/v2/`에서 실행합니다.

## Scripts

```sh
npm run dev
npm test
npm run build
```

## 실행 및 배포

- Node 22.13 이상이 필요합니다. `npm install` 후 `npm run dev`로 실행합니다.
- 로컬에서는 SQLite로 평가를 저장합니다. `http://127.0.0.1:4173/`에서 확인할 수 있습니다.
- 실제 공유 배포는 Netlify Functions와 Supabase 연결이 필요합니다. 정적 파일만 업로드하면 평가를 저장할 수 없습니다.
- [서버 연결과 검증 안내](server/README.md)를 참고하세요.

## 운영 설정

- `config/tiger.js`: 유형, 스탯, 문구, Gemini 가입 링크.
- `src/v2/app.js`: 기존 GA4 측정 ID 사용. 로컬 환경에서는 분석을 전송하지 않습니다.
- `database/`: 배포용 데이터베이스 설정. 비밀 키는 서버 환경 변수로만 설정합니다.
