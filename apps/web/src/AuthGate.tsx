import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useMemo } from "react";
import { App } from "./App";
import { Landing } from "./flow/landing";

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim();

function LoginScreen({ login, loading = false }: { login?: () => void; loading?: boolean }) {
  return <Landing login={login} loading={loading} />;
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
  if (!appId) {
    return (
      <App
        userId="local"
        userLabel="This machine"
        apiFetch={globalThis.fetch}
        onLogout={() => undefined}
      />
    );
  }
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
