export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--paper)] text-[color:var(--ink)] px-4 py-8">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
