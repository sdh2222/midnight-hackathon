import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthVerifier = (accessToken: string) => Promise<string>;

export function createPrivyVerifier(appId: string): AuthVerifier {
  if (!appId.trim()) throw new Error("PRIVY_APP_ID is required");
  const jwks = createRemoteJWKSet(
    new URL(`https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/jwks.json`),
  );
  return async (accessToken) => {
    const { payload } = await jwtVerify(accessToken, jwks, {
      algorithms: ["ES256"],
      issuer: "privy.io",
      audience: appId,
    });
    if (typeof payload.sub !== "string" || !payload.sub.startsWith("did:privy:")) {
      throw new Error("Invalid Privy user ID");
    }
    return payload.sub;
  };
}
