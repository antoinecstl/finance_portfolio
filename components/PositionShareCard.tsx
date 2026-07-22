'use client';

import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import type { SanitizedPositionShareData } from '@/lib/share-card';

export function PositionShareCard({ data }: { data: SanitizedPositionShareData }) {
  return (
    <div className="aspect-[1.91/1] w-full rounded-2xl bg-zinc-950 p-6 text-white shadow-xl">
      <p className="text-sm font-semibold text-blue-400">Fi-Hub</p>
      {data.ticker !== undefined && <h3 className="mt-3 text-3xl font-bold">{data.ticker}</h3>}
      {data.accountName !== undefined && <p className="text-sm text-zinc-400">{data.accountName}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {data.performancePercent !== undefined && <p>Performance <strong>{formatPercent(data.performancePercent)}</strong></p>}
        {data.value !== undefined && <p>Valorisation <strong>{formatCurrency(data.value, data.currency)}</strong></p>}
        {data.investedAmount !== undefined && <p>Montant investi <strong>{formatCurrency(data.investedAmount, data.currency)}</strong></p>}
        {data.quantity !== undefined && <p>Quantité <strong>{formatNumber(data.quantity, 4)}</strong></p>}
        {data.averagePrice !== undefined && <p>PRU <strong>{formatCurrency(data.averagePrice, data.currency)}</strong></p>}
      </div>
    </div>
  );
}
