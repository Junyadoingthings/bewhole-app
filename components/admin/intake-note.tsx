/**
 * What the client told us when booking: whether this is their first session,
 * and their answer to "What brings you here?". Shown wherever the practice
 * looks at a booking, so it can prepare before the session. Built from spans
 * so it can sit inside a link.
 */
export function IntakeNote({
  reason,
  isFirstSession,
}: {
  reason?: string | null;
  isFirstSession?: boolean | null;
}) {
  return (
    <span className="mt-2 block max-w-sm text-xs">
      <span
        className={
          isFirstSession === false
            ? 'inline-flex rounded-full bg-cream-200 px-2 py-0.5 font-medium text-ink-soft dark:bg-canvas-sunk'
            : 'inline-flex rounded-full bg-forest-50 px-2 py-0.5 font-medium text-forest-700 dark:bg-forest-900/30 dark:text-forest-300'
        }
      >
        {isFirstSession === false ? 'Follow-up session' : 'First session'}
      </span>
      {reason?.trim() && (
        <span className="mt-1.5 block whitespace-pre-line leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">What brings them: </span>
          {reason.trim()}
        </span>
      )}
    </span>
  );
}
