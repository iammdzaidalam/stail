import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Simple in-memory login throttle (per server instance). Good enough for an
// internal tool; swap for a shared store if deployed multi-instance.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

export function loginThrottled(email: string): boolean {
  const now = Date.now();
  const entry = attempts.get(email);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function recordLoginFailure(email: string): void {
  const now = Date.now();
  const entry = attempts.get(email);
  if (!entry || entry.resetAt < now) {
    attempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(email: string): void {
  attempts.delete(email);
}
