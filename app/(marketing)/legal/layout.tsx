export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <article className="max-w-3xl mx-auto px-4 py-16 prose prose-zinc dark:prose-invert prose-headings:font-bold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-8">
      {children}
    </article>
  );
}
