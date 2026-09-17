"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  loginAction,
  registerAction,
  type AuthActionState,
} from "@/lib/auth/actions";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="auth-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <label>
        Your name
        <input name="name" type="text" required placeholder="Rahul Sharma" autoComplete="name" />
      </label>

      <label>
        Work email
        <input
          name="email"
          type="email"
          required
          placeholder="you@institute.com"
          autoComplete="email"
        />
      </label>

      <label>
        Institute / business name
        <input
          name="businessName"
          type="text"
          required
          placeholder="ABC Coaching Institute"
          autoComplete="organization"
        />
      </label>

      <label>
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
      </label>

      <button type="submit" className="primary-btn auth-submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="auth-switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="auth-form">
      {state.error ? <p className="form-error">{state.error}</p> : null}

      <label>
        Email
        <input
          name="email"
          type="email"
          required
          placeholder="you@institute.com"
          autoComplete="email"
        />
      </label>

      <label>
        Password
        <input
          name="password"
          type="password"
          required
          placeholder="Your password"
          autoComplete="current-password"
        />
      </label>

      <button type="submit" className="primary-btn auth-submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="auth-switch">
        New to CallAI? <Link href="/register">Create an account</Link>
      </p>
    </form>
  );
}
