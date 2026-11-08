export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Placeholder while a form that reads the URL (callbackUrl, token) hydrates. */
export function AuthFormFallback({ fields = 2 }: { fields?: number }) {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
        </div>
      ))}
      <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
    </div>
  );
}
