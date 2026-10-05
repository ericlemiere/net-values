"use client";

import { useActionState } from "react";
import { unlock, type UnlockState } from "./actions";

const INITIAL: UnlockState = { error: null };

/** The only thing /equation renders until the password is entered. */
export function PasswordForm() {
  const [state, action, pending] = useActionState(unlock, INITIAL);

  return (
    <form action={action} className="mt-6 flex max-w-sm flex-col gap-3">
      <label htmlFor="equation-password" className="text-sm text-white/70">
        Password
      </label>
      <input
        id="equation-password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "equation-password-error" : undefined}
        className="rounded-md border border-white/20 bg-background-box px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
      />
      {state.error && (
        <p
          id="equation-password-error"
          role="alert"
          className="text-sm text-red-400"
        >
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:cursor-default disabled:opacity-60"
      >
        {pending ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}
