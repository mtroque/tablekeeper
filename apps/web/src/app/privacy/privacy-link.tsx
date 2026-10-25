import Link from 'next/link';

/** Quiet link to the privacy page, for the foot of the game library. */
export function PrivacyLink() {
  return (
    <Link
      href="/privacy"
      className="inline-flex min-h-11 items-center self-center text-sm text-muted underline-offset-4 hover:underline"
    >
      Privacy
    </Link>
  );
}
