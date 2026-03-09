"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function InviteConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Invalid invite link.");
      return;
    }

    setStatus("loading");

    fetch("/api/team/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
          // Reload session so new orgId is reflected
          setTimeout(() => router.push("/"), 2000);
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMsg(data.error ?? "Failed to accept invite.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Network error. Please try again.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Accepting your invitation…</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-foreground">Invitation accepted! Redirecting you now…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-destructive">{errorMsg}</p>
        <a href="/login" className="mt-4 text-sm text-primary underline">
          Return to login
        </a>
      </div>
    </div>
  );
}

export default function InviteConfirmPage() {
  return (
    <Suspense>
      <InviteConfirmContent />
    </Suspense>
  );
}
