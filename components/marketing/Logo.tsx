import Link from 'next/link';
import { LOGO_MARK_PATHS } from './logo-paths';

export function LogoMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="150 180 740 660"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={LOGO_MARK_PATHS.ring} />
      <circle {...LOGO_MARK_PATHS.dot} />
      {LOGO_MARK_PATHS.bars.map((bar) => (
        <rect key={bar.y} {...bar} />
      ))}
    </svg>
  );
}

export function Logo({
  href = '/',
  size = 'md',
}: {
  href?: string;
  size?: 'md' | 'lg';
}) {
  const markClass = size === 'lg' ? 'h-8 w-8' : 'h-6 w-6';
  const textClass = size === 'lg' ? 'text-4xl' : 'text-2xl';

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-[color:var(--text)] rounded-sm"
      aria-label="Fi-Hub, accueil"
    >
      <LogoMark className={markClass} />
      <span className={`display ${textClass} leading-none`} aria-hidden="true">
        Fi&#8209;Hub
      </span>
    </Link>
  );
}
