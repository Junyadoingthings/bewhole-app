import { redirect } from 'next/navigation';

/**
 * `/login` is an alias for `/sign-in`.
 *
 * The app ended up with two complete sign-in pages — this one and
 * `/sign-in` — both rendering <LoginForm>. Every auth guard
 * (`requireUser`, `requireStaff`, `requireAdmin`) redirects to `/sign-in`,
 * while links around the site and people typing the URL by hand land on
 * `/login`. Two pages meant a fix applied to one silently missed the other,
 * which is exactly what happened: testing showed `/login` healthy while the
 * page users actually reached was a different file.
 *
 * `/sign-in` wins because that is where the guards point. This keeps `/login`
 * working — bookmarks, old links and habit all rely on it — but there is now
 * only one page to maintain.
 *
 * `next` is preserved so a redirect chain still returns someone to where they
 * were headed.
 */
export default function LoginAliasPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : '';
  redirect(`/sign-in${next}`);
}
