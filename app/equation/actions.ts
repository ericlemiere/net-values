"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  accessToken,
  isCorrectPassword,
} from "@/lib/equation-access";

export type UnlockState = { error: string | null };

/** Checks the password on the server and, if it's right, sets the cookie. */
export async function unlock(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const guess = String(formData.get("password") ?? "");
  const token = accessToken();

  if (!token || !isCorrectPassword(guess)) {
    // A pause on every miss makes guessing slow without bothering anyone
    // who types it right.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { error: "That password isn't right." };
  }

  (await cookies()).set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/equation",
    maxAge: ACCESS_MAX_AGE,
  });
  redirect("/equation");
}
