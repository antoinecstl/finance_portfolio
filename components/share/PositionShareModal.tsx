'use client';

import { useMemo, useRef, useState } from 'react';
import { Copy, Download, Share2, X } from 'lucide-react';
import type { PositionMetrics } from '@/lib/position-metrics';
import { createPositionShareData, DEFAULT_SHARE_CARD_SETTINGS, SHARE_CARD_DIMENSIONS, type ShareCardFormat, type ShareCardSettings, type ShareCardTheme } from '@/lib/share-card';
import { canCopyPng, copyPng, downloadPng, renderShareCardPng, sharePng } from '@/lib/share-image';
import { PositionShareCard } from './PositionShareCard';

const privacyOptions: Array<[keyof ShareCardSettings, string]> = [
  ['showTotalValue', 'Valorisation'], ['showInvestedAmount', 'Montant investi'], ['showGainAmount', 'Gain en montant'],
  ['showGainPercent', 'Performance en %'], ['showQuantity', 'Quantité'], ['showAveragePrice', 'PRU'],
  ['showCurrentPrice', 'Cours actuel'], ['showWeight', 'Poids'], ['showAccountName', 'Nom du compte'], ['showDividends', 'Dividendes'],
];

export function PositionShareModal({ metric, valuationDate, onClose }: { metric: PositionMetrics; valuationDate: string; onClose: () => void }) {
  const [settings, setSettings] = useState(DEFAULT_SHARE_CARD_SETTINGS);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const data = useMemo(() => createPositionShareData(metric, settings, valuationDate), [metric, settings, valuationDate]);
  const dimensions = SHARE_CARD_DIMENSIONS[settings.format]; const previewWidth = 320; const scale = previewWidth / dimensions.width;
  const makeBlob = async () => { if (!cardRef.current) throw new Error('Carte indisponible.'); return renderShareCardPng(cardRef.current); };
  const run = async (action: 'share' | 'download' | 'copy') => { setBusy(true); setError(''); try { const blob = await makeBlob(); if (action === 'share') { const shared = await sharePng(blob, metric.symbol, valuationDate); if (!shared) downloadPng(blob, metric.symbol, valuationDate); } else if (action === 'download') downloadPng(blob, metric.symbol, valuationDate); else await copyPng(blob); } catch (e) { setError(e instanceof Error ? e.message : 'Impossible de générer l’image.'); } finally { setBusy(false); } };
  const patch = <K extends keyof ShareCardSettings>(key: K, value: ShareCardSettings[K]) => setSettings(current => ({ ...current, [key]: value }));

  return <div className="fixed inset-0 z-50 bg-black/65 p-3 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="share-position-title" onClick={onClose}>
    <div className="mx-auto max-w-5xl rounded-xl bg-white dark:bg-zinc-900 shadow-2xl" onClick={event => event.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 p-4"><div><h2 id="share-position-title" className="font-semibold text-zinc-900 dark:text-zinc-100">Partager {metric.symbol}</h2><p className="text-xs text-zinc-500">Aucun montant ni compte n’est affiché par défaut.</p></div><button type="button" onClick={onClose} aria-label="Fermer"><X className="h-5 w-5" /></button></header>
      <div className="grid lg:grid-cols-[360px_1fr] gap-6 p-4 sm:p-6">
        <section aria-label="Prévisualisation"><div className="overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 mx-auto" style={{ width: previewWidth, height: dimensions.height * scale }}><div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}><PositionShareCard ref={cardRef} data={data} settings={settings} /></div></div></section>
        <section className="space-y-5">
          <fieldset><legend className="text-sm font-semibold mb-2">Format</legend><div className="flex flex-wrap gap-2">{([['square', 'Publication 1:1'], ['portrait', 'Portrait 4:5'], ['story', 'Story 9:16']] as [ShareCardFormat, string][]).map(([value, label]) => <button type="button" key={value} onClick={() => patch('format', value)} className={`rounded-lg border px-3 py-2 text-sm ${settings.format === value ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-300 dark:border-zinc-700'}`}>{label}</button>)}</div></fieldset>
          <fieldset><legend className="text-sm font-semibold mb-2">Thème figé</legend><div className="flex gap-2">{(['light', 'dark'] as ShareCardTheme[]).map(value => <button type="button" key={value} onClick={() => patch('theme', value)} className={`rounded-lg border px-4 py-2 text-sm ${settings.theme === value ? 'ring-2 ring-red-700' : ''}`}>{value === 'light' ? 'Clair' : 'Sombre'}</button>)}</div></fieldset>
          <fieldset><legend className="text-sm font-semibold mb-2">Informations visibles</legend><div className="grid sm:grid-cols-2 gap-2">{privacyOptions.map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm"><span>{label}</span><input type="checkbox" checked={Boolean(settings[key])} onChange={e => patch(key, e.target.checked as never)} className="h-4 w-4 accent-red-700" /></label>)}</div></fieldset>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => run('share')} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50"><Share2 className="h-4 w-4" />Partager</button><button disabled={busy} onClick={() => run('download')} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2"><Download className="h-4 w-4" />Télécharger l’image</button>{canCopyPng() && <button disabled={busy} onClick={() => run('copy')} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2"><Copy className="h-4 w-4" />Copier l’image</button>}</div>
        </section>
      </div>
    </div>
  </div>;
}
