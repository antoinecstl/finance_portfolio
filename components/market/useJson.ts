'use client';

import { useEffect, useState } from 'react';

function errorMessage(status: number): string {
  if (status === 404) return 'not_found';
  if (status === 429) return 'Trop de requêtes en peu de temps. Réessayez dans une minute.';
  return 'Les données de marché sont momentanément indisponibles.';
}

// Requête JSON avec état de chargement par URL ; la donnée précédente reste
// affichée (atténuée) pendant le chargement de la suivante.
export function useJson<T>(url: string | null) {
  const [nonce, setNonce] = useState(0);
  const key = url ? `${url}#${nonce}` : null;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null; at: number }>({
    key: null, data: null, error: null, at: 0,
  });

  useEffect(() => {
    if (!url || !key) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        setState(res.ok
          ? { key, data: json as T, error: null, at: Date.now() }
          : { key, data: null, error: errorMessage(res.status), at: Date.now() });
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') setState({ key, data: null, error: errorMessage(0), at: Date.now() });
      });
    return () => controller.abort();
  }, [url, key]);

  return {
    data: state.data,
    error: state.key === key ? state.error : null,
    loading: key !== null && state.key !== key,
    fetchedAt: state.at,
    reload: () => setNonce((n) => n + 1),
  };
}
