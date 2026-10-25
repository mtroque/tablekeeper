/** Placeholder for a hub tab whose slice hasn't been built yet. */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="flex flex-col items-center gap-2 px-6 py-16 text-center"
      data-testid="coming-soon"
    >
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-[30ch] text-muted">{children}</p>
    </section>
  );
}
