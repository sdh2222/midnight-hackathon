import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useMemo } from "react";
import { App } from "./App";

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim();

function LoginScreen({ login, loading = false }: { login?: () => void; loading?: boolean }) {
  return (
    <div className="desk">
      <header className="bar">
        <span className="wordmark"><span>buy</span><span>list</span></span>
      </header>
      <main className="page">
        <p className="kicker">Sign in</p>
        <h1>Skip the sheet.</h1>
        <p className="lede">
          Sign in once. The next pages take one buy, let Jev sort the offers, and check the row you keep.
        </p>
        <section className="window">
          <div className="titlebar">Account</div>
          <div className="window-body">
            {login ? (
              <button className="ink" type="button" onClick={login} disabled={loading}>
                {loading ? "Checking the session" : "Continue with email or social"}
              </button>
            ) : (
              <p>
                Set <code>VITE_PRIVY_APP_ID</code> in the root <code>.env</code> before signing in.
              </p>
            )}
            <p className="fine">Privy checks the account. This page does not ask for a wallet seed.</p>
          </div>
        </section>
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
