# @midnight-hackathon/web

비공개 기업 구매 흐름을 제공하는 React 앱입니다.

1. Privy 이메일 또는 Google/Apple 계정으로 로그인하면 구매 화면으로 이동합니다.
2. 공개 검색 조건과 비공개 최대 예산을 입력합니다.
3. 데모 모드에서 `commitRange` 순서를 시연합니다.
4. Jev가 Alibaba 후보를 평가하면 브라우저에서 예산 충족 여부를 비교합니다.
5. 사용자가 후보 하나를 승인하면 데모 `commitVerify` 순서를 시연합니다.
6. 승인된 공개 견적과 데모 거래 ID를 영속화한 뒤 Mock Alibaba 주문을 요청합니다.
7. `거래 내역`에서 주문 상태를 자동 동기화하고 실패한 주문은 다시 시도할 수 있습니다.

## 실행

저장소 루트에서 API와 웹 앱을 각각 실행합니다.

```bash
npm run dev:api
npm run dev:web
```

웹 앱은 `http://127.0.0.1:5173`에서 열립니다. 개발 중 `/v1`과 `/health`는
`127.0.0.1:3001`의 API로 프록시됩니다.

루트 `.env`에 Privy 대시보드의 같은 App ID를 웹과 API에 설정하고, Privy에서 로컬 도메인 및 이메일·Google·Apple 로그인 방식을 허용하세요. ReefAPI 검색 키는 API에만 설정합니다.

```dotenv
VITE_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_ID=your_privy_app_id
CATALOG_PROVIDER=reef
REEF_API_KEY=your_server_side_key
VITE_MIDNIGHT_MODE=demo
```

오프라인 탐색은 `CATALOG_PROVIDER=mock`로 전환할 수 있습니다. `JEV_PROVIDER=mock`도 사용하면 Jev 키 없이 시연할 수 있습니다. Reef 검색 결과는 확정 견적이 아니며, 화면의 상품금액은 검색 카드 최고 단가를 사용한 추정치입니다. 배송비·관세·실제 납기는 미확인입니다.

## Midnight 모드

루트 `.env`가 브라우저 어댑터를 선택합니다.

```dotenv
VITE_MIDNIGHT_MODE=lace
VITE_NETWORK_ID=undeployed
VITE_CONTRACT_ADDRESS=<64자리 로컬 배포 주소>
```

- `demo`: 브라우저 메모리에서 동일한 순서를 시연합니다.
- `lace`: 기존 지갑 기반 어댑터입니다. Privy 로그인만으로 Midnight 서명을 할 수 없으므로 현재 로그인 UI에서는 실제 체인 거래를 사용할 수 없습니다. 별도 서명·증명 설계 후 연결해야 합니다.

`npm run compact:zk --workspace @midnight-hackathon/intent-contract`가 proving key와
ZKIR을 생성합니다. 웹 빌드의 `copy:zk` 단계가 이 산출물을 `public/keys`와
`public/zkir`로 복사하므로, 별도 bootstrap 전역 객체는 필요하지 않습니다.

최대 예산과 salt는 검색 요청에 포함되지 않고 로컬 private intent vault에만
보관됩니다. 현재 MVP 회로는 가격 상한을 체인에서 증명하며, 공급처와 납기는 앱의
로컬 검증 계층에서 확인합니다.

새 거래 내역은 Privy DID의 SHA-256 식별자로 범위를 제한합니다. 인증 토큰에는 DID가
포함되지만 거래 레코드에는 저장하지 않습니다. 최대 예산과 salt도 거래 내역 API에
전송하지 않습니다.
기존 지갑 주소로 저장된 거래 내역은 자동 연결되지 않습니다. 안전한 이전에는 명시적인 계정 연결 절차가 필요합니다.

현재 주문 어댑터는 시연용 Mock입니다. 공급자 접수와 거래 완료 상태는 결정적으로
진행되지만 실제 Alibaba 주문은 전송하지 않습니다. 실제 연동 여부가 정해지면 API의
`OrderAdapter` 구현만 교체할 수 있습니다.
