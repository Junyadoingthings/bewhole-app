/**
 * Shown the instant someone taps "Schedule your session here".
 *
 * Without this file, Next waits for the server component to finish before it
 * paints anything — so on a slow phone connection the tap appears to do
 * nothing, the browser spins on the old page, and people conclude the button
 * is broken. That is exactly what was reported.
 *
 * With it, the route transitions immediately and this skeleton stands in until
 * the real content arrives. The page cannot feel dead any more, because
 * something visibly happens on the tap.
 *
 * Deliberately plain: no animation library, no images, no data. It has to be
 * the cheapest thing in the app or it defeats its own purpose.
 */
export default function BookLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <div className="skeleton h-3 w-28 rounded-full" />

      <div className="mt-6 space-y-3">
        <div className="skeleton h-9 w-4/5 rounded-lg" />
        <div className="skeleton h-9 w-3/5 rounded-lg" />
      </div>

      {/* Four cards: the shape of the service list that is about to load, so
          the layout does not jump when it arrives. */}
      <div className="mt-9 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-line p-5">
            <div className="flex items-start gap-4">
              <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2.5">
                <div className="skeleton h-4 w-1/2 rounded" />
                <div className="skeleton h-3 w-4/5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-ink-soft">Loading available sessions…</p>
    </div>
  );
}
