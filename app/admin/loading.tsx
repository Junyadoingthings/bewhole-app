/**
 * Paints the moment the admin console is entered — including straight after
 * sign-in.
 *
 * Without this, signing in as staff holds the "Signing in…" spinner through
 * BOTH the authentication and the full dashboard render. The person sees one
 * long, silent wait and cannot tell which half is slow, or whether anything is
 * happening at all. That is the "sometimes it opens, sometimes it doesn't"
 * report: it was always the same wait, just sometimes long enough to give up
 * on.
 *
 * With it, the redirect lands immediately on this shell and the data fills in.
 * Deliberately cheap — no images, no animation library, no data.
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="skeleton h-3 w-24 rounded-full" />
          <div className="skeleton h-9 w-48 rounded-lg" />
          <div className="skeleton h-3 w-40 rounded-full" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-9 w-32 rounded-full" />
          <div className="skeleton h-9 w-32 rounded-full" />
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-3xl border border-line p-6">
            <div className="skeleton h-3 w-20 rounded-full" />
            <div className="skeleton mt-4 h-8 w-16 rounded-lg" />
            <div className="skeleton mt-3 h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl border border-line p-6">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="mt-5 space-y-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="skeleton h-14 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
