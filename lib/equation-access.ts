import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The password gate on /equation. The password lives only in the server's
 * EQUATION_PASSWORD env var (no NEXT_PUBLIC_ prefix, so it's never bundled
 * into the browser). A correct entry sets an httpOnly cookie holding a hash
 * derived from the password, not the password itself, so changing the
 * password locks out everyone who unlocked with the old one.
 *
 * With the env var unset the page stays locked: it fails closed.
 */
export const ACCESS_COOKIE = "equation_access";

/** One day, then the password is asked for again. */
export const ACCESS_MAX_AGE = 60 * 60 * 24;

function password() {
  return process.env.EQUATION_PASSWORD || null;
}

/** The cookie value a correct password earns. */
export function accessToken() {
  const secret = password();
  if (!secret) return null;
  return createHmac("sha256", secret).update("equation-access").digest("hex");
}

/**
 * Constant-time comparison, so response timing gives away nothing about how
 * much of a guess was right. Both sides are hashed first to make them the
 * same length, which timingSafeEqual requires.
 */
function same(a: string, b: string) {
  const digest = (s: string) =>
    createHmac("sha256", "compare").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function isCorrectPassword(guess: string) {
  const secret = password();
  return secret !== null && same(guess, secret);
}

/** Whether this request carries a valid unlock cookie. */
export async function hasEquationAccess() {
  const token = accessToken();
  if (!token) return false;
  const cookie = (await cookies()).get(ACCESS_COOKIE)?.value;
  return cookie !== undefined && same(cookie, token);
}
