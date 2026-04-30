export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[color:var(--paper)] text-[color:var(--ink)]">
      <article className="max-w-3xl mx-auto px-4 py-16 text-[color:var(--ink)] [&_a]:text-[color:var(--accent)] [&_a]:underline [&_h1]:display [&_h1]:text-4xl [&_h1]:leading-none [&_h1]:mb-6 [&_h2]:display [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:text-[color:var(--ink-soft)] [&_p]:leading-7 [&_ul]:text-[color:var(--ink-soft)] [&_li]:my-1.5">
        {children}
      </article>
    </div>
  );
}
