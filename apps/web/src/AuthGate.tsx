import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useMemo } from "react";
import { App } from "./App";

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim();

function LoginScreen({ login, loading = false }: { login?: () => void; loading?: boolean }) {
  return (
    <div className="landing">
      <header className="landing-top">
        <span className="mark"><span className="mark-water">source</span>night</span>
        <nav className="landing-nav" aria-label="Sourcenight">
          <a href="#how">How a buy runs</a>
        </nav>
      </header>
      <section className="hero">
        <div className="hero-sky" aria-hidden="true" />
        <div className="hero-copy">
          <h1>Stop pasting suppliers into a sheet.</h1>
          <p className="hero-via">via Jev and Midnight</p>
          <div className="hero-actions">
            {login ? (
              <button className="hero-button" type="button" onClick={login} disabled={loading}>
                {loading ? "Checking the session" : "Open Sourcenight"}
              </button>
            ) : (
              <p>Set <code>VITE_PRIVY_APP_ID</code> in the root <code>.env</code> before signing in.</p>
            )}
            <a className="hero-link" href="#how">How a buy runs</a>
          </div>
        </div>
      </section>
      <section className="landing-section" id="how">
        <h2>One buy. One sorted list. One checked row.</h2>
        <div className="landing-grid">
          <ol className="landing-steps">
            <li><strong>You enter the buy.</strong><span>Item, quantity, keywords, and a cap. The cap stays in this browser.</span></li>
            <li><strong>Jev sorts the offers.</strong><span>It turns the public buy into a search and returns the list ranked.</span></li>
            <li><strong>Midnight checks the row you keep.</strong><span>The proof says whether that row fits the cap. Nothing else is revealed.</span></li>
          </ol>
          <p className="landing-body">
            Searching each supplier and copying the row into a spreadsheet is the slow part. Sourcenight does that pass once. You sign in with email or a social account. Privy checks the account. The page does not ask for a wallet seed.
          </p>
        </div>
      </section>
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
