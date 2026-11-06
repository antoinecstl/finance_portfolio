'use client';

import { useState } from 'react';
import { Download, Loader2, FileText } from 'lucide-react';

type PdfPeriod = 'month' | 'quarter' | 'year' | 'all';

// Exports et rapports : données complètes (JSON, RGPD) et rapport patrimonial PDF.
export function ExportsPanel() {
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState<PdfPeriod | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) throw new Error('Export échoué');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fi-hub-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur export');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async (period: PdfPeriod) => {
    setExportingPdf(period);
    setError(null);
    try {
      const res = await fetch(`/api/account/export/pdf?period=${period}`);
      if (!res.ok) throw new Error('Export PDF échoué');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fi-hub-rapport-${period}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur export PDF');
    } finally {
      setExportingPdf(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[color:var(--rule)] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-medium text-[color:var(--ink)]">Exporter mes données</h3>
            <p className="text-sm text-[color:var(--ink-soft)] mt-1">
              Téléchargez l&apos;intégralité de vos données (profil, comptes, transactions,
              positions) au format JSON, conformément au RGPD.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-outline inline-flex items-center gap-2 py-2 px-4 rounded-lg text-sm transition flex-shrink-0 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Télécharger l&apos;export JSON
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-[color:var(--rule)] p-5">
        <div className="min-w-0 mb-4">
          <h3 className="font-medium text-[color:var(--ink)]">Rapport patrimonial (PDF)</h3>
          <p className="text-sm text-[color:var(--ink-soft)] mt-1">
            Générez un rapport PDF synthétique avec votre patrimoine, la liste des comptes,
            vos positions actuelles et l&apos;activité sur la période choisie.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'month', label: 'Mois' },
            { key: 'quarter', label: 'Trimestre' },
            { key: 'year', label: 'Année' },
            { key: 'all', label: 'Depuis le début' },
          ] as Array<{ key: PdfPeriod; label: string }>).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleExportPdf(key)}
              disabled={exportingPdf !== null}
              className="btn-outline inline-flex items-center gap-2 py-2 px-3 disabled:opacity-50 rounded-lg text-sm transition"
            >
              {exportingPdf === key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {label}
            </button>
          ))}
        </div>
      </section>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
