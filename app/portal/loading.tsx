/**
 * Paints the moment a client enters the portal, including straight after
 * sign-in. Same reasoning as the admin loading screen: without it the
 * "Signing in…" spinner covers both the authentication and the portal render,
 * and the wait looks like a failure.
 */
export default function PortalLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-8 w-56 rounded-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl border border-line p-6">
            <div className="skeleton h-3 w-24 rounded-full" />
            <div className="skeleton mt-4 h-6 w-40 rounded" />
            <div className="skeleton mt-3 h-3 w-32 rounded-full" />
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-line p-6">
        <div className="skeleton h-4 w-36 rounded" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
