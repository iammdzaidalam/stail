// Shared between proxy (edge-safe) and server code. Must not import the DB.
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "stail_session";
export const SESSION_DAYS = 7;

export type SessionPayload = {
  sub: string; // user id
  role: string;
  name: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      role: String(payload.role ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}
