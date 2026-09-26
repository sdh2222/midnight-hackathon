# @midnight-hackathon/web

비공개 기업 구매 흐름을 제공하는 React 앱입니다.

1. 공개 검색 조건과 비공개 최대 예산을 입력합니다.
2. 검색 전에 Midnight `commitRange`로 예산 commitment를 기록합니다.
3. Jev가 mock Alibaba 후보를 평가하면 브라우저에서 예산 충족 여부를 비교합니다.
4. 사용자가 후보 하나를 승인하면 `commitVerify`로 조건 충족과 견적 commitment를 기록합니다.
5. 승인된 공개 견적과 체인 트랜잭션 ID를 영속화하고 `거래 내역`에서 조회합니다.

## 실행

저장소 루트에서 API와 웹 앱을 각각 실행합니다.

```bash
npm run dev:api
npm run dev:web
```

웹 앱은 `http://127.0.0.1:5173`에서 열립니다. 개발 중 `/v1`과 `/health`는
`127.0.0.1:3001`의 API로 프록시됩니다.

## Midnight 모드

루트 `.env`가 브라우저 어댑터를 선택합니다.

```dotenv
VITE_MIDNIGHT_MODE=lace
VITE_NETWORK_ID=undeployed
VITE_CONTRACT_ADDRESS=<64자리 로컬 배포 주소>
```

- `demo`: 브라우저 메모리에서 동일한 순서를 시연합니다.
- `lace`: Connector API 4.x 호환 지갑과 배포된 컨트랙트에 연결합니다.

`npm run compact:zk --workspace @midnight-hackathon/intent-contract`가 proving key와
ZKIR을 생성합니다. 웹 빌드의 `copy:zk` 단계가 이 산출물을 `public/keys`와
`public/zkir`로 복사하므로, 별도 bootstrap 전역 객체는 필요하지 않습니다.

최대 예산과 salt는 검색 요청에 포함되지 않고 로컬 private intent vault에만
보관됩니다. 현재 MVP 회로는 가격 상한을 체인에서 증명하며, 공급처와 납기는 앱의
로컬 검증 계층에서 확인합니다.

거래 내역은 지갑 주소의 SHA-256 식별자로 범위를 제한합니다. 원본 지갑 주소,
최대 예산, salt는 거래 내역 API에 전송하지 않습니다.
