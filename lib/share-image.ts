'use client';

function fileName(symbol: string, date: string) { return `fi-hub-${symbol.replace(/[^a-z0-9.-]/gi, '-')}-${date}.png`; }

export async function renderShareCardPng(node: HTMLElement): Promise<Blob> {
  await document.fonts?.ready;
  await Promise.all(Array.from(node.querySelectorAll('img')).map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => resolve(), { once: true }); })));
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const { toBlob } = await import('html-to-image');
  const blob = await toBlob(node, { pixelRatio: 1, cacheBust: true, backgroundColor: getComputedStyle(node).backgroundColor });
  if (!blob) throw new Error('La génération de l’image a échoué.');
  return blob;
}

export function shareFile(blob: Blob, symbol: string, date: string) {
  return new File([blob], fileName(symbol, date), { type: 'image/png' });
}

export async function sharePng(blob: Blob, symbol: string, date: string): Promise<boolean> {
  const file = shareFile(blob, symbol, date);
  if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: `Ma position ${symbol} sur Fi-Hub` }); return true; }
  return false;
}
export function downloadPng(blob: Blob, symbol: string, date: string) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = fileName(symbol, date); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
export async function copyPng(blob: Blob) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); }
export function canCopyPng() { return typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.write) && typeof ClipboardItem !== 'undefined'; }
