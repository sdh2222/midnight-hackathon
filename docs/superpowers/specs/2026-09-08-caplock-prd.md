# Private Intent Execution for AI Agents — 해커톤 MVP PRD

<!-- 변경 이력 (2026-09-18): 기존 Caplock의 공장 배출 강도 검증 PRD → 구매자·판매자의 비공개 거래 intent 협상 및 Midnight 검증 PRD. 기존 파일명은 링크가 끊기지 않도록 유지했다. -->
<!-- 변경 이력: Verifier/Plant/Buyer/Bank 역할 → Buyer/Seller/AI parser/Buyer Agent/Seller Agent/증명 실행자 역할. E/P/salt와 band_id → 비공개 가격 한도와 조건 검증 결과. lock/request/grant/proveBand 흐름 → 입력/변환/승인/협상/증명/검증 흐름. -->

상태: 팀 검토용 초안
원래 작성일: 2026-09-08 / 방향 수정: 2026-09-18
프로젝트: Midnight Korea Hackathon 2026

> 이 문서는 사용자가 설명한 “Private Intent Execution for AI Agents”를 기준으로 한다. 기존 Caplock 설계 문서와 docs/superpowers/diagrams의 그림은 **이전 아이디어의 기록**이며, 이 PRD의 거래 흐름이나 계약 명세로 사용하지 않는다.

## 1. 한 문장 설명

구매자와 판매자가 자연어로 거래 의도를 입력하고, AI가 구조화한 조건을 각자 승인한다. 에이전트는 공개 가능한 정보로 협상하고, 비공개 가격 조건을 만족하는지는 ZK proof로 증명해 Midnight에서 검증한다.

## 2. 문제와 목표

양측은 원하는 거래를 자연어로 설명하고 싶지만, 구매자의 최대 지불 가격이나 판매자의 최소 수락 가격을 상대방에게 그대로 공개하고 싶지 않다. 앱은 두 intent를 실행 가능한 형식으로 바꾸고, 사용자가 승인한 조건에 묶인 검증 결과를 보여준다.

MVP 성공 기준은 **“양측이 승인한 조건에 맞는 제안인지 Midnight에서 검증했다”**는 사실을 시연하는 것이다. 실제 결제나 자산 이전이 없다면 화면과 발표에서 “거래 완료”라고 부르지 않는다.

## 3. MVP 범위

<!-- 변경: 기존 한 공장·한 검증 기간·구매자/은행의 배출 강도 구간 판정 → 한 상품, 구매자 1명과 판매자 1명, 가격 조건 1건의 거래 intent 검증. -->

### 포함

- 구매자와 판매자가 각각 자연어 intent를 입력한다.
- AI가 각 입력을 공통 structured intent 형식으로 변환한다.
- 사용자가 변환 결과를 확인·수정하고 명시적으로 승인한다.
- Buyer Agent와 Seller Agent가 승인된 intent를 기반으로 하나의 거래 제안을 만든다.
- 비공개 가격 조건을 만족한다는 proof를 생성하고 Midnight에서 검증한다.
- 앱이 파싱 오류, 불일치, 증명 실패, 검증 실패, 검증 성공을 구분해 표시한다.
- 성공·불일치·조작된 값에 대한 고정 데모 데이터를 제공한다.

### 제외

- 실제 대금 결제, 토큰·상품 이전, 법적 계약 체결
- 다수 사용자 매칭 시장, 복수 상품·분할 주문, 복잡한 경매
- AI가 사용자 승인 없이 거래 조건을 확정하거나 수정하는 기능
- 프로덕션 인증·권한 관리, 대화 전문 공개, 실거래 가격 데이터

## 4. 사용자와 시스템 역할

| 역할 | 행동 | 볼 수 있는 정보 |
|---|---|---|
| Buyer | 구매 intent 확인·수정·승인 | 자신의 전체 intent, 상대방이 공개하기로 한 조건, 최종 검증 결과 |
| Seller | 판매 intent 확인·수정·승인 | 자신의 전체 intent, 상대방이 공개하기로 한 조건, 최종 검증 결과 |
| AI parser | 자연어를 정해진 형식으로 변환 | 파싱을 위해 전달된 원문 |
| Buyer Agent / Seller Agent | 승인된 조건으로 제안·응답 | 전달받은 공개 조건과 허용된 협상 메시지 |
| 증명 실행자 | 비공개 witness로 proof 생성 | MVP 신뢰 경계에 따라 필요한 원본 조건 |
| Midnight | 제출된 proof와 공개 입력 검증 | 계약이 공개하도록 정한 값과 검증 결과 |
| 앱/백엔드 | 단계 실행, 상태 기록, UI용 결과 제공 | 아래의 비공개 경계에 따라 달라짐 |

## 5. 비공개 경계와 신뢰 가정

<!-- 변경: 기존 비공개 값 E(배출량), P(생산량), salt → 구매자 최대 가격과 판매자 최소 가격 및 각 조건의 nonce/salt. 기존의 구간 결과 band_id → 조건 충족 여부. -->

- 기본 데모에서는 상품명·수량·통화는 공개 가능한 조건으로, 구매자 최대 가격과 판매자 최소 가격은 상대방 에이전트와 공개 ledger에 숨길 조건으로 취급한다.
- 원문에 가격이 포함되어 AI API로 전달되면 AI 제공자는 그 원문을 처리한다. “AI 제공자에게도 비공개”라고 주장하지 않는다.
- MVP의 제안 신뢰 모델은 **신뢰된 백엔드/증명 실행자가 양측의 비공개 값을 받아 proof를 만드는 방식**이다. 이 실행자는 두 값을 볼 수 있다. 증명 서버 또한 witness를 처리하므로 로컬 또는 팀이 통제하는 환경에서 운영한다.
- Buyer Agent에는 판매자의 최소 가격을, Seller Agent에는 구매자의 최대 가격을 전달하지 않는다. 비공개 값은 URL, 브라우저 영속 저장소, 일반 로그, 공개 API 응답에 넣지 않는다.
- 공개 commitment가 작은 가격 범위를 추측하는 단서가 되지 않도록 충분한 nonce/salt를 사용한다. 정확한 commitment 구성과 저장 방식은 계약 담당자가 확정한다.
- 양측의 값을 어느 신뢰 주체도 함께 보지 못하게 하는 설계가 요구된다면, 이는 별도 암호 프로토콜 및 증명 설계가 필요한 **MVP 외 후속 목표**다.

## 6. 사용자 흐름

<!-- 변경: 기존 verifier lock → requester request → plant grant → proveBand → band_id 조회를 아래의 양측 intent 흐름으로 교체. -->

1. Buyer와 Seller가 각자 자연어로 상품, 수량, 가격 조건을 입력한다.
2. AI parser가 양측 입력을 structured intent로 변환한다. 해석이 불분명하거나 필수 값이 없으면 승인 전 수정하도록 한다.
3. 각 사용자가 자신의 structured intent와 비공개로 표시된 필드를 확인·수정·승인한다.
4. 백엔드가 승인된 버전을 고정하고, 에이전트 협상을 시작한다. 이후 수정은 새 버전과 새 승인으로 처리한다.
5. 에이전트가 거래 제안 하나를 만들거나 제안 불가를 반환한다. 신뢰된 백엔드가 제안을 비공개 조건과 대조한다. 에이전트의 문장만으로 조건 충족을 확정하지 않는다. 반복적인 가격 탐색은 MVP에서 제외한다.
6. 제안이 있으면 증명 실행자가 승인된 intent 및 제안에 묶인 proof를 생성한다.
7. Midnight 계약 호출과 검증 결과를 확인한다.
8. 앱이 검증된 조건 일치, 조건 불일치, proof 생성 실패, 체인 검증 실패를 구분해서 보여준다.

## 7. 공통 데이터 형식 초안

금액은 부동소수점 대신 통화의 최소 단위 정수로 다룬다. MVP가 KRW만 지원한다면 원 단위 정수를 사용한다. 필드명과 단위는 AI, 백엔드, 에이전트, 계약 담당자가 **같은 정의**를 사용해야 한다.

~~~json
{
  "id": "intent_123",
  "role": "buyer",
  "itemId": "demo-item-1",
  "quantity": 1,
  "currency": "KRW",
  "privatePriceLimitMinor": 1000000,
  "status": "draft",
  "version": 1
}
~~~

- Buyer의 privatePriceLimitMinor는 **최대 구매 가격**, Seller에게는 **최소 판매 가격**을 뜻한다. 실제 구현에서는 의미 혼동을 막기 위해 역할별 필드명 또는 명시적 limitType을 사용할 수 있다.
- 필수값: 역할, 상품, 수량, 통화, 가격 한도. AI가 모르는 값을 임의로 만들면 안 되며 사용자 확인을 받아야 한다.
- 협상 제안에는 intent ID와 승인된 버전, 상품·수량, 합의 가격, 공개 범위를 포함한다.
- 위 객체는 **내부 초안**이다. 상대방 에이전트나 공개 조회 API에 그대로 반환하지 않는다.

## 8. 계약과 ZK 검증 요구사항

<!-- 변경: 기존 E/P의 배출 강도 구간 계산과 band_id 공개 → 양측 승인된 가격 한도 및 제안 가격의 관계 검증. 아래는 계약 담당자에게 전달할 제품 요구사항이며 실제 Compact circuit 시그니처는 아니다. -->

MVP 검증 명제의 예:

~~~text
buyerMaxPrice >= proposedPrice
proposedPrice >= sellerMinPrice
상품·수량·통화가 양측의 승인된 intent 및 제안과 일치한다
~~~

- proof는 **승인된 intent의 특정 버전**과 제안에 묶여야 한다. 승인 뒤 가격을 바꾸거나 다른 거래의 proof를 재사용한 경우 실패해야 한다.
- 구매자 최대 가격과 판매자 최소 가격은 공개 ledger에 평문으로 기록하지 않는다.
- 공개 결과의 최소 범위는 거래 식별자, 검증 성공 여부, 트랜잭션 참조다. 제안 가격을 공개할지 여부는 양측의 공개 범위 합의에 따른다.
- “가격이 맞지 않음”과 “잘못된 witness/proof”는 서로 다른 결과로 모델링한다. Midnight 계약이 실패 거래를 ledger에 기록하는지, 단순히 트랜잭션을 거부하는지는 계약 담당자가 정하고 API에 반영한다.
- ZK는 주어진 값 사이의 관계와 commitment 결합을 검증한다. AI가 자연어를 올바르게 해석했는지, 상품이 실제로 인도됐는지까지 증명하지 않는다.

## 9. 화면

<!-- 변경: 기존 /plant, /buyer, /bank의 배출 강도 확인 화면 → 구매·판매 intent 입력/승인 및 검증 진행 화면. -->

| 경로 | 화면 | 필수 요소 |
|---|---|---|
| /buyer | 구매 intent 입력·검토·승인 | 자연어 입력, 구조화 결과, 비공개 가격 표시, 수정·승인 |
| /seller | 판매 intent 입력·검토·승인 | 자연어 입력, 구조화 결과, 비공개 가격 표시, 수정·승인 |
| /execution/:id | 협상·증명·검증 진행 및 결과 | 단계별 상태, 공개 가능한 제안 요약, 결과·오류 |

해커톤 데모에서는 역할 선택으로 두 화면을 오갈 수 있다. 실제 사용자 인증이 없는 데모임을 UI와 발표에서 명확히 한다.

## 10. 백엔드 API 계약 초안

<!-- 변경: 기존 hub의 request catalog/grant/band_id 조회 → 자연어 파싱, 양측 승인, 실행 상태 조회 인터페이스. -->

| 호출 | 요청 | 응답 |
|---|---|---|
| POST /api/intents/parse | role, text | intentId, draft, warnings |
| PUT /api/intents/:id | 수정한 draft, version | 최신 draft, version |
| POST /api/intents/:id/approve | 승인할 version | intentId, approvedVersion |
| POST /api/executions | buyerIntentId, sellerIntentId | executionId, status |
| GET /api/executions/:id | 없음 | status, steps, publicProposal, verification, error |

- API가 응답을 반환하는 공개 범위는 호출자 역할에 따라 달라진다. 특히 상대방의 privatePriceLimitMinor를 반환하지 않는다.
- 실행 상태의 최소 구분: negotiating, no_match, proving, verifying, verified, proof_failed, verification_failed.
- 실패 응답에는 기계가 읽을 errorCode와 화면에 표시할 안전한 message를 둔다. 원문 intent나 witness를 오류 메시지에 싣지 않는다.
- 재시도 시 동일 실행이 중복 제출되지 않도록 executionId 또는 요청 식별자를 사용한다.
- 이 표는 프런트엔드와 백엔드가 합의할 **초안**이다. 계약 구현의 실제 실패 형태에 맞춰 확정한다.

## 11. 제안 기술 구조와 팀 인계

| 영역 | MVP 제안 | 담당자가 확정해 전달할 것 |
|---|---|---|
| Frontend | React + TypeScript + Vite | 화면, API 호출, 상태 표시, 공개 범위 |
| AI parser | 서버에서 호출하는 구조화 출력 지원 모델 | 모델/API 제공자, JSON 스키마, 미해석 입력 처리 |
| Agents / Backend | Node.js + TypeScript의 단일 API | 협상 호출 규칙, 승인 버전 고정, 공개/비공개 응답 |
| Midnight | Compact 계약 + Midnight.js 연동 모듈 | 회로/함수명, 공개 입력, witness, 결과, 배포 주소 |
| 실행 환경 | 우선 로컬 Midnight 네트워크와 로컬 proof server | 네트워크·indexer·proof server 주소, 지갑 설정 |

Midnight 담당자는 컴파일된 TypeScript 연동 산출물, 호환되는 도구 버전, 배포 주소, 성공·실패 호출 예제와 예상 결과를 제공한다. 프런트엔드는 백엔드 API만 호출하며, proof server와 지갑 비밀값을 브라우저 설정에 넣지 않는다.

## 12. 데모 시나리오와 완료 기준

1. **성공:** Buyer 최대 1,000,000원, Seller 최소 900,000원, 제안 950,000원. 양측 승인 버전과 상품·수량이 일치하고 검증 성공을 표시한다.
2. **조건 불일치:** Buyer 최대 800,000원, Seller 최소 900,000원. 매칭 불가를 표시하며 검증 성공으로 처리하지 않는다.
3. **조작 방지:** 승인 뒤 가격 또는 제안 내용을 바꾼 값으로 증명을 시도한다. 승인 버전/commitment 결합이 맞지 않아 검증 성공이 나오지 않는다.
4. **시스템 오류:** proof server 중단 또는 Midnight 제출 실패를 조건 불일치와 다른 오류로 표시한다.

데모 결과에는 검증된 조건의 의미와 트랜잭션 참조를 보여준다. 실제 결제·인도가 구현되지 않았다면 “조건 검증 성공”으로 표기한다.

## 13. 팀이 구현 전에 확정할 항목

- 이 거래 intent 프로젝트가 기존 Caplock 방향을 대체하는 최종 제출 범위인지
- AI API에 양측 원문과 비공개 가격을 전달하는 신뢰 가정의 승인 여부
- 거래 제안 가격의 공개 범위와 양측의 최종 제안 승인 필요 여부
- 계약의 정확한 공개 입력, witness, commitment 방식, 실패 결과와 배포 네트워크
- 각 모듈 담당자, JSON 형식과 정수 단위, 데모 실행 순서

이 항목을 확정한 뒤 API 예시와 계약 인터페이스를 고정한다. 변경 시 이 문서와 구현을 함께 갱신한다.
