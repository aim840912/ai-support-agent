"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    orgName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Registration failed");
    } else if (data.emailSent) {
      setCheckEmail(true);
    } else {
      router.push("/login");
    }
  }

  if (checkEmail) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-muted p-3">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-foreground"
              aria-hidden="true"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to <strong>{form.email}</strong>. Click the link to activate
          your account.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <Link href="/login" className="underline">
            sign in
          </Link>{" "}
          if you already verified.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Create account</h1>
      <p className="mb-6 text-sm text-muted-foreground">Start your AI Support Agent for free</p>

      <OAuthButtons />

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs text-muted-foreground">
          <span className="bg-card px-2">or register with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
              Your name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={form.name}
              onChange={update("name")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label htmlFor="orgName" className="mb-1 block text-sm font-medium text-foreground">
              Company name
            </label>
            <input
              id="orgName"
              type="text"
              autoComplete="organization"
              required
              value={form.orgName}
              onChange={update("orgName")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Acme Corp"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={update("email")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={update("password")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Min. 8 chars, upper, lower & number"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
