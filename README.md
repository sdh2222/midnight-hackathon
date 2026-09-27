# Midnight Hackathon

기업의 최대 예산을 공개하지 않고 AI가 B2B 공급처를 탐색·비교하도록 돕는
private procurement workspace입니다.

## 구성

- `apps/web`: Privy 로그인 → 구매 요청 → 후보 비교 → 사용자 승인 React UI
- `apps/api`: ReefAPI/Mock Alibaba catalog와 Jev 평가 파이프라인
- `contract`: `commitRange`와 `commitVerify` Compact 컨트랙트
- `packages/shared`: 요청, 견적, 검색 결과의 공통 스키마

승인된 데모 거래는 기본적으로 `apps/api/data/executions.json`에 저장되며 이 경로는
Git에서 제외됩니다. 저장 레코드는 공개 견적과 체인 트랜잭션만 포함하고, 최대 예산과
salt 및 원본 지갑 주소는 포함하지 않습니다.

승인 직후 주문 상태 머신이 실행되고 Mock Alibaba 어댑터가 주문 접수 ID를 만듭니다.
거래 내역 화면은 공급자 접수와 완료 상태를 동기화하며 실패 주문의 재시도를 지원합니다.
ReefAPI는 실제 Alibaba.com 상품 검색에 사용하지만, 검색 카드 가격은 확정 견적이 아닙니다.
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

루트 `.env`에 동일한 Privy App ID를 `PRIVY_APP_ID`와 `VITE_PRIVY_APP_ID`에 넣고,
ReefAPI 키를 `REEF_API_KEY`에 설정해야 실제 검색이 됩니다. Privy 대시보드에서
로컬 앱 도메인과 로그인 방식을 허용하세요. 키 없이 데모를 확인하려면
`CATALOG_PROVIDER=mock`, `JEV_PROVIDER=mock`, `VITE_MIDNIGHT_MODE=demo`를 사용합니다.
Privy 로그인은 계정 인증이며 Midnight 거래 서명은 아닙니다. 실제 지갑 없는 체인
연동은 후속 설계 과제입니다.

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
