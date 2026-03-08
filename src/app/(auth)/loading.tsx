export default function AuthLoading() {
  return (
    <div className="w-full max-w-md animate-pulse space-y-6 rounded-2xl border border-border bg-card p-8">
      {/* Logo / title */}
      <div className="space-y-2 text-center">
        <div className="mx-auto h-10 w-10 rounded-xl bg-muted" />
        <div className="mx-auto h-6 w-40 rounded bg-muted" />
        <div className="mx-auto h-4 w-56 rounded bg-muted" />
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-10 w-full rounded-lg bg-muted" />
          </div>
        ))}
      </div>

      {/* Submit button */}
      <div className="h-10 w-full rounded-lg bg-muted" />

      {/* Footer link */}
      <div className="mx-auto h-4 w-48 rounded bg-muted" />
    </div>
  );
}
