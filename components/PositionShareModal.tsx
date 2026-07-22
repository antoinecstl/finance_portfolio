'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Download, X } from 'lucide-react';
import {
  buildSanitizedShareCardData,
  DEFAULT_SHARE_CARD_SETTINGS,
  hasSensitiveShareCardData,
  type PositionShareData,
  type SanitizedPositionShareData,
  type ShareCardSettings,
} from '@/lib/share-card';
import { PositionShareCard } from './PositionShareCard';

interface PositionShareModalProps {
  data: PositionShareData;
  onClose: () => void;
}

const OPTIONS: Array<[keyof ShareCardSettings, string]> = [
  ['showTicker', 'Ticker'],
  ['showPerformancePercent', 'Performance en %'],
  ['showAccountName', 'Nom du compte'],
  ['showValue', 'Valorisation'],
  ['showInvestedAmount', 'Montant investi'],
  ['showQuantity', 'Quantité'],
  ['showAveragePrice', 'PRU'],
];

function drawPng(data: SanitizedPositionShareData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 628;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Canvas indisponible'));

  context.fillStyle = '#09090b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#60a5fa';
  context.font = '600 30px sans-serif';
  context.fillText('Fi-Hub', 72, 80);
  context.fillStyle = '#ffffff';
  context.font = '700 64px sans-serif';
  if (data.ticker !== undefined) context.fillText(data.ticker, 72, 170);

  const rows: string[] = [];
  if (data.accountName !== undefined) rows.push(`Compte : ${data.accountName}`);
  if (data.performancePercent !== undefined) rows.push(`Performance : ${data.performancePercent >= 0 ? '+' : ''}${data.performancePercent.toFixed(2)} %`);
  if (data.value !== undefined) rows.push(`Valorisation : ${data.value.toLocaleString('fr-FR')} ${data.currency}`);
  if (data.investedAmount !== undefined) rows.push(`Montant investi : ${data.investedAmount.toLocaleString('fr-FR')} ${data.currency}`);
  if (data.quantity !== undefined) rows.push(`Quantité : ${data.quantity.toLocaleString('fr-FR')}`);
  if (data.averagePrice !== undefined) rows.push(`PRU : ${data.averagePrice.toLocaleString('fr-FR')} ${data.currency}`);
  context.font = '32px sans-serif';
  rows.forEach((row, index) => context.fillText(row, 72, 250 + index * 58));

  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Génération PNG impossible')), 'image/png'));
}

export function PositionShareModal({ data, onClose }: PositionShareModalProps) {
  const [settings, setSettings] = useState<ShareCardSettings>({ ...DEFAULT_SHARE_CARD_SETTINGS });
  // Only this sanitized object reaches either renderer.
  const sanitizedData = useMemo(() => buildSanitizedShareCardData(data, settings), [data, settings]);

  const download = async () => {
    const blob = await drawPng(sanitizedData);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'position-fi-hub.png';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Partager la position">
      <div className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Partager la position</h2>
          <button type="button" onClick={onClose} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <PositionShareCard data={sanitizedData} />
        <fieldset className="my-5 grid grid-cols-2 gap-3">
          <legend className="col-span-2 mb-2 text-sm font-medium">Informations visibles</legend>
          {OPTIONS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings[key]} onChange={event => setSettings(current => ({ ...current, [key]: event.target.checked }))} />
              {label}
            </label>
          ))}
        </fieldset>
        {hasSensitiveShareCardData(settings) && (
          <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Cette image contient des informations financières personnelles
          </p>
        )}
        <button type="button" onClick={download} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
          <Download className="h-4 w-4" /> Générer et télécharger le PNG
        </button>
        <p className="mt-2 text-center text-xs text-zinc-500">Génération locale dans votre navigateur.</p>
      </div>
    </div>
  );
}
