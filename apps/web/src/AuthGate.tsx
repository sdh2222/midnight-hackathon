import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useMemo } from "react";
import { App } from "./App";

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim();

function LoginScreen({ login, loading = false }: { login?: () => void; loading?: boolean }) {
  return (
    <div className="app">
      <header className="top">
        <span className="mark"><span className="mark-pink">buy</span><span>list</span></span>
      </header>
      <main className="frame">
        <div className="v-page">
          <header className="v-header">
            <div className="v-header-text">
              <h1 className="v-title">Skip the sheet.</h1>
              <p className="v-desc">Sign in once. The next pages take one buy, let Jev sort the offers, and check the row you keep.</p>
            </div>
          </header>
          <section className="v-card">
            <div className="v-card-head"><h2 className="v-card-title">Account</h2></div>
            <div className="v-card-body">
              {login ? (
                <button className="v-btn" type="button" onClick={login} disabled={loading}>
                  {loading ? "Checking the session" : "Continue with email or social"}
                </button>
              ) : (
                <p>Set <code>VITE_PRIVY_APP_ID</code> in the root <code>.env</code> before signing in.</p>
              )}
              <p className="v-desc">Privy checks the account. This page does not ask for a wallet seed.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function AuthenticatedWorkspace() {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const authenticatedFetch = useMemo<typeof globalThis.fetch>(() => async (input, init) => {
    const token = await getAccessToken();
    if (!token) throw new Error("The session expired. Sign in again.");
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${token}`);
    return globalThis.fetch(input, { ...init, headers });
  }, [getAccessToken]);

  if (!ready) return <LoginScreen loading login={() => undefined} />;
  if (!authenticated || !user) return <LoginScreen login={() => login()} />;

  return (
    <App
      userId={user.id}
      userLabel={user.email?.address ?? "Signed in"}
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
