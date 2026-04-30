export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
