import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Fi-Hub — Suivi de patrimoine PEA, CTO, AV';

const theme = {
  paper: '#f7f2e8',
  paper2: '#efe7d4',
  ink: '#0e0c0a',
  ink2: '#2a2520',
  soft: '#5b524a',
  rule: '#d8cdb6',
  accent: '#b91c1c',
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
          fontFamily: 'Georgia, Times New Roman, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              background: theme.accent,
              color: theme.paper,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            ↗
          </div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>Fi-Hub</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>
            Suivez votre patrimoine
            <br />
            <span style={{ color: theme.accent }}>sans Excel.</span>
          </div>
          <div style={{ fontSize: 28, color: theme.ink2, lineHeight: 1.3, maxWidth: 980 }}>
            PEA · CTO · Livrets · Assurance-vie — un tableau de bord unique, valorisé en temps réel.
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
          <div
            style={{
              background: theme.paper2,
              border: `1px solid ${theme.rule}`,
              borderRadius: 999,
              color: theme.ink2,
              padding: '8px 16px',
            }}
          >
            Gratuit pour démarrer
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
