import { ImageResponse } from 'next/og';
import { LOGO_MARK_PATHS } from '@/components/marketing/logo-paths';
import { PLANS } from '@/lib/plans';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Fi-Hub — Vos placements réunis. Votre performance en clair.';

const theme = {
  paper: '#f7f2e8',
  ink: '#0e0c0a',
  ink2: '#2a2520',
  soft: '#5b524a',
  rule: '#d8cdb6',
};

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: theme.paper,
          color: theme.ink,
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="64" height="57" viewBox="150 180 740 660" fill={theme.ink}>
            <path d={LOGO_MARK_PATHS.ring} />
            <circle {...LOGO_MARK_PATHS.dot} />
            {LOGO_MARK_PATHS.bars.map((bar) => (
              <rect key={bar.y} {...bar} />
            ))}
          </svg>
          <div style={{ fontSize: 44, fontFamily: 'Georgia, Times New Roman, serif' }}>Fi-Hub</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>
            <div>Vos placements réunis.</div>
            <div>Votre performance en clair.</div>
          </div>
          <div style={{ fontSize: 28, color: theme.ink2, lineHeight: 1.35, maxWidth: 980 }}>
            Retrouvez vos PEA, CTO et livrets au même endroit. Distinguez vos versements de vos gains et comparez la performance de votre portefeuille à un indice.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: `1px solid ${theme.rule}`,
            color: theme.soft,
            fontSize: 22,
            paddingTop: 24,
          }}
        >
          <div>fi-hub.subleet.com</div>
          <div>{`Gratuit jusqu’à ${PLANS.free.maxAccounts} comptes`}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
