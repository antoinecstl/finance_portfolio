import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Fi-Hub — Suivi de patrimoine PEA, CTO, AV';

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
          background: 'linear-gradient(135deg, #0b1120 0%, #1e3a8a 100%)',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            ↗
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>Fi-Hub</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
            Suivez votre patrimoine
            <br />
            <span style={{ color: '#60a5fa' }}>sans Excel.</span>
          </div>
          <div style={{ fontSize: 28, color: '#cbd5e1', lineHeight: 1.3, maxWidth: 980 }}>
            PEA · CTO · Livrets · Assurance-vie — un tableau de bord unique, valorisé en temps réel.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#94a3b8',
            fontSize: 22,
          }}
        >
          <div>fi-hub.subleet.com</div>
          <div>Gratuit pour démarrer</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
