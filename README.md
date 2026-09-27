# Midnight Hackathon

기업의 최대 예산을 공개하지 않고 AI가 B2B 공급처를 탐색·비교하도록 돕는
private procurement workspace입니다.

## 구성

- `apps/web`: 구매 요청 → 후보 비교 → 사용자 승인 React UI
- `apps/api`: mock Alibaba catalog와 Jev 평가 파이프라인
- `contract`: `commitRange`와 `commitVerify` Compact 컨트랙트
- `packages/shared`: 요청, 견적, 검색 결과의 공통 스키마

승인된 거래는 기본적으로 `apps/api/data/executions.json`에 저장되며 이 경로는
Git에서 제외됩니다. 저장 레코드는 공개 견적과 체인 트랜잭션만 포함하고, 최대 예산과
salt 및 원본 지갑 주소는 포함하지 않습니다.

승인 직후 주문 상태 머신이 실행되고 Mock Alibaba 어댑터가 주문 접수 ID를 만듭니다.
거래 내역 화면은 공급자 접수와 완료 상태를 동기화하며 실패 주문의 재시도를 지원합니다.
현재 구현은 실제 Alibaba에 주문을 전송하지 않으며, 추후 `OrderAdapter`만 교체하도록
분리되어 있습니다.

## 로컬 실행

Node.js 22+, Docker Desktop, WSL2가 필요합니다.

```bash
npm install
cp .env.example .env

npm run dev:api
npm run dev:web
```

로컬 Midnight 환경은 node `:9944`, indexer `:8088`, proof server `:6300`을
사용합니다. proof server는 증명 witness를 처리하므로 로컬에서만 실행하세요.

## Compact와 배포

현재 Midnight.js 4.1.1 / ledger 8 조합에 맞춰 Compact 0.31.1,
language 0.23.0, runtime 0.16.0을 사용합니다.

```bash
npm run compact:zk --workspace @midnight-hackathon/intent-contract
npm run deploy:local --workspace @midnight-hackathon/intent-contract
```

배포 명령은 로컬 컨트랙트를 배포하고 실제
`commitRange → commitVerify` 트랜잭션을 실행합니다. 출력된 주소를 루트
`.env`의 `VITE_CONTRACT_ADDRESS`에 설정하세요.

MVP 회로는 비공개 최대 예산과 salt의 commitment를 열어 선택 견적이 예산
이하인지 증명합니다. proof-server 호환성을 위해 ledger는 평탄화된 단일 intent
셀을 사용하므로, 현재 배포 인스턴스 하나에는 활성 intent 하나만 기록됩니다.
공급처와 납기 조건은 앱 계층에서 검증합니다.

## 검증

```bash
npm test
npm run build
```

## 브랜치

`dev`가 통합 브랜치이고 `main`은 최종 검토 결과를 보관합니다. 기능 브랜치는
`dev`에서 만들고 PR도 `dev`를 대상으로 여는 것을 원칙으로 합니다.

코딩 에이전트는 [`AGENTS.md`](AGENTS.md)를 먼저 읽는다. `main`의 Caplock 문서는
현재 제품이 아니다. 심사 문구와 `dev` → `main` 제출 체크리스트는
[`docs/product/hackathon-prompt.md`](docs/product/hackathon-prompt.md).
