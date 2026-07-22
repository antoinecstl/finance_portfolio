import { forwardRef } from 'react';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { SHARE_CARD_DIMENSIONS, type PositionShareData, type ShareCardSettings } from '@/lib/share-card';

const themes = {
  light: { paper: '#f7f2e8', paper2: '#efe7d4', ink: '#0e0c0a', soft: '#5b524a', rule: '#d8cdb6', gain: '#047857', loss: '#b91c1c' },
  dark: { paper: '#0c0b0a', paper2: '#181613', ink: '#f1ead9', soft: '#9a907d', rule: '#3d362c', gain: '#34d399', loss: '#ef4444' },
};

export const PositionShareCard = forwardRef<HTMLDivElement, { data: PositionShareData; settings: ShareCardSettings }>(function PositionShareCard({ data, settings }, ref) {
  const size = SHARE_CARD_DIMENSIONS[settings.format];
  const theme = themes[settings.theme];
  const performance = data.gainPercent ?? 0;
  const facts = [
    data.totalValue !== undefined && ['Valorisation', formatCurrency(data.totalValue, data.currency)],
    data.investedAmount !== undefined && ['Montant investi', formatCurrency(data.investedAmount, data.currency)],
    data.gainAmount !== undefined && ['Gain latent', `${data.gainAmount >= 0 ? '+' : ''}${formatCurrency(data.gainAmount, data.currency)}`],
    data.quantity !== undefined && ['Quantité', data.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 8 })],
    data.averagePrice !== undefined && ['PRU', formatCurrency(data.averagePrice, data.currency)],
    data.currentPrice !== undefined && ['Cours', formatCurrency(data.currentPrice, data.currency)],
    data.weight !== undefined && ['Poids', formatPercent(data.weight)],
    data.dividends !== undefined && ['Dividendes', formatCurrency(data.dividends, 'EUR')],
    data.accountName !== undefined && ['Compte', data.accountName],
  ].filter(Boolean) as string[][];

  return <div ref={ref} data-testid="position-share-card" style={{ width: size.width, height: size.height, background: theme.paper, color: theme.ink, padding: settings.format === 'story' ? 104 : 80, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif', overflow: 'hidden', ['--paper' as string]: theme.paper, ['--paper-2' as string]: theme.paper2, ['--ink' as string]: theme.ink, ['--ink-soft' as string]: theme.soft, ['--rule' as string]: theme.rule, ['--gain' as string]: theme.gain, ['--loss' as string]: theme.loss }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${theme.rule}`, paddingBottom: 30 }}>
      <strong style={{ fontFamily: 'Georgia, serif', fontSize: 42, letterSpacing: -1 }}>Fi-Hub</strong>
      <span style={{ color: theme.soft, fontSize: 25 }}>Valorisé le {new Date(`${data.valuationDate}T12:00:00`).toLocaleDateString('fr-FR')}</span>
    </header>
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {settings.title && <p style={{ color: theme.soft, fontSize: 30, margin: '0 0 42px', maxWidth: 800 }}>{settings.title}</p>}
      <p style={{ color: theme.soft, fontSize: 30, margin: 0, textTransform: 'uppercase', letterSpacing: 5 }}>Ma position</p>
      <h1 style={{ fontFamily: 'Georgia, serif', fontSize: settings.format === 'story' ? 136 : 112, lineHeight: 1, margin: '20px 0 8px', letterSpacing: -5 }}>{data.symbol}</h1>
      <p style={{ color: theme.soft, fontSize: 34, margin: '0 0 60px' }}>{data.name}</p>
      {data.gainPercent !== undefined && <div style={{ color: performance >= 0 ? theme.gain : theme.loss, fontFamily: 'Georgia, serif', fontSize: settings.format === 'story' ? 154 : 132, fontWeight: 700 }}>{performance >= 0 ? '+' : ''}{formatPercent(performance)}</div>}
      {facts.length > 0 && <div style={{ marginTop: 66, padding: 38, background: theme.paper2, border: `2px solid ${theme.rule}`, display: 'grid', gridTemplateColumns: facts.length > 1 ? '1fr 1fr' : '1fr', gap: '34px 48px' }}>{facts.map(([label, value]) => <div key={label}><div style={{ color: theme.soft, fontSize: 22, textTransform: 'uppercase', letterSpacing: 2 }}>{label}</div><div style={{ fontSize: 34, fontWeight: 700, marginTop: 8 }}>{value}</div></div>)}</div>}
    </main>
    <footer style={{ color: theme.soft, fontSize: 23, borderTop: `2px solid ${theme.rule}`, paddingTop: 28, display: 'flex', justifyContent: 'space-between' }}><span>Suivez vos investissements avec clarté.</span><span>fi-hub.subleet.com</span></footer>
  </div>;
});
