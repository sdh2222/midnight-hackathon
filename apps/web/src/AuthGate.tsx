import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useMemo } from "react";
import { App } from "./App";
import { ArrowIcon, LockIcon, ShieldIcon, SparkIcon } from "./components/Icons";

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim();

function LoginScreen({ login, loading = false }: { login?: () => void; loading?: boolean }) {
  return (
    <div className="login-page">
      <header className="login-header">
        <span className="brand-mark"><ShieldIcon /></span>
        <strong>Midnight Buy</strong>
      </header>
      <main className="login-main">
        <div className="login-copy">
          <span className="hero-chip"><SparkIcon /> Private procurement workspace</span>
          <h1>공급처 탐색부터<br /><em>안전한 승인까지.</em></h1>
          <p>이메일이나 소셜 계정으로 시작하세요. AI가 공급처를 찾고, 민감한 구매 예산은 검색 서비스에 전달하지 않습니다.</p>
          <div className="login-benefits">
            <span><SparkIcon /> AI 공급처 탐색</span>
            <span><LockIcon /> 비공개 예산</span>
            <span><ShieldIcon /> 승인 내역 관리</span>
          </div>
        </div>
        <section className="login-card" aria-label="로그인">
          <div className="login-card-icon"><ShieldIcon /></div>
          <span className="section-kicker">Welcome</span>
          <h2>구매를 시작해볼까요?</h2>
          <p>로그인하면 바로 구매 요청을 작성할 수 있어요.</p>
          {login ? (
            <button className="primary-button login-button" type="button" onClick={login} disabled={loading}>
              {loading ? "로그인 확인 중" : "이메일 또는 소셜 계정으로 계속"} <ArrowIcon />
            </button>
          ) : (
            <div className="login-setup">Privy App ID가 필요합니다. 루트 <code>.env</code>에 <code>VITE_PRIVY_APP_ID</code>를 설정해 주세요.</div>
          )}
          <small>계정 인증은 Privy가 처리합니다.</small>
        </section>
      </main>
    </div>
  );
}

function AuthenticatedWorkspace() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const authenticatedFetch = useMemo<typeof globalThis.fetch>(() => async (input, init) => {
    const token = await getAccessToken();
    if (!token) throw new Error("로그인 세션이 만료됐습니다. 다시 로그인해 주세요.");
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${token}`);
    return globalThis.fetch(input, { ...init, headers });
  }, [getAccessToken]);

  if (!ready) return <LoginScreen loading login={() => undefined} />;
  if (!authenticated || !user) return <LoginScreen login={() => login()} />;

  return (
    <App
      userId={user.id}
      userLabel={user.email?.address ?? "내 계정"}
      apiFetch={authenticatedFetch}
      onLogout={() => void logout()}
    />
  );
}

export function AuthGate() {
  if (!appId) return <LoginScreen />;
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google", "apple"],
        embeddedWallets: { ethereum: { createOnLogin: "off" } },
      }}
    >
      <AuthenticatedWorkspace />
    </PrivyProvider>
  );
}
