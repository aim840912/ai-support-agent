"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { demoSignIn } from "@/actions/demo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isVerified = searchParams.get("verified") === "1";
  const isReset = searchParams.get("reset") === "1";
  const authError = searchParams.get("error");
  const isDemoMode = searchParams.get("demo") === "1";

  // Auto-trigger demo login when redirected from the "Try Demo" button.
  // Using next-auth/react's signIn() here (HTTP path) avoids the Server Action
  // module-isolation issue where PrismaNeon WebSocket connections fail.
  useEffect(() => {
    if (isDemoMode) {
      signIn("credentials", {
        email: "demo@ai-support-agent.local",
        isDemo: "true",
        callbackUrl: "/overview",
        redirect: true,
      });
    }
  }, [isDemoMode]);

  const errorMessages: Record<string, string> = {
    OAuthAccountNotLinked:
      "This email is already linked to another sign-in method. Please use your original method.",
    Configuration: "There is a problem with the server configuration. Please try again later.",
    AccessDenied: "Access denied. You do not have permission to sign in.",
    Default: "An error occurred during sign-in. Please try again.",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      rememberMe: String(rememberMe), // Credentials provider passes values as strings
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/overview");
    }
  }

  // Show a loading state while demo auto-login is in progress
  if (isDemoMode) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading demo…
      </div>
    );
  }

  return (
    <>
      {isVerified && (
        <p className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm text-foreground" role="status">
          Email verified. You can now sign in.
        </p>
      )}
      {isReset && (
        <p className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm text-foreground" role="status">
          Password updated. Sign in with your new password.
        </p>
      )}
      {authError && (
        <p
          className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {errorMessages[authError] ?? errorMessages.Default}
        </p>
      )}

      <OAuthButtons />

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <label htmlFor="rememberMe" className="text-sm text-muted-foreground">
            Remember me for 30 days
          </label>
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
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={demoSignIn}>
        <button
          type="submit"
          className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Try Demo Dashboard
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/register" className="font-medium text-foreground hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Sign in</h1>
      <p className="mb-6 text-sm text-muted-foreground">Access your AI Support Agent dashboard</p>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
