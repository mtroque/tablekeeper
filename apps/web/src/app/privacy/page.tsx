import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy' };

const ISSUES_URL = 'https://github.com/mtroque/tablekeeper/issues';

/** What Tablekeeper stores and who processes it. Each claim is checked in docs/slices/X1-privacy-policy.md. */
export default function PrivacyPage() {
  return (
    <article className="flex flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">Privacy</h1>
        <p className="text-sm text-muted">Last updated 25 October 2026</p>
      </header>

      <Section title="Without an Account">
        <p>
          Everything works without signing in. A game in progress or a campaign stays in this
          browser and is never sent to an account.
        </p>
      </Section>

      <Section title="With an Account">
        <p>
          You sign in with Google. Tablekeeper receives your email address and name from Google and
          stores them with the games and campaigns you save, so you can see your history on any
          device. Other players can&apos;t see your saved games.
        </p>
      </Section>

      <Section title="Board Photos">
        <p>
          Photos are read on your device. While you score, the photo is kept in this browser tab and
          is gone when you close it. Photos are never uploaded.
        </p>
      </Section>

      <Section title="Rules Questions">
        <p>
          A rules question is sent to Anthropic, which writes the answer from the rulebook.
          Tablekeeper doesn&apos;t store your questions. To apply daily limits, it counts how many
          questions each account asks per day, or for guests, each IP address, stored in a scrambled
          form (a salted hash) rather than as the address itself.
        </p>
      </Section>

      <Section title="Logs and Storage">
        <p>
          The server logs each request&apos;s address within the app, result and duration, not who
          made it. The hosting services keep their own standard request logs.
        </p>
        <p>
          This browser stores your sign-in and any game in progress. There are no cookies, ads or
          analytics.
        </p>
      </Section>

      <Section title="Services Used">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Vercel hosts the website.</li>
          <li>Render hosts the server.</li>
          <li>Supabase holds the database and handles sign-in.</li>
          <li>Google provides the sign-in.</li>
          <li>Anthropic writes rules answers.</li>
        </ul>
      </Section>

      <Section title="Questions">
        <p>
          Open an issue on{' '}
          <a
            href={ISSUES_URL}
            className="font-semibold text-accent underline underline-offset-4"
            rel="noreferrer"
          >
            GitHub
          </a>
          . Issues are public, so don&apos;t include personal details.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl">{title}</h2>
      {children}
    </section>
  );
}
