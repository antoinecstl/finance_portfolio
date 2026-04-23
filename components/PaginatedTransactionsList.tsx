'use client';

import { useEffect, useRef } from 'react';
import type { Account } from '@/lib/types';
import { usePaginatedTransactions } from '@/lib/hooks';
import { TransactionsList } from './TransactionsList';

// Wrapper cursor-based + auto-load via IntersectionObserver.
// Cible : onglet "Historique des Transactions" quand le volume dépasse ~200 lignes.
export function PaginatedTransactionsList({
  accounts,
  accountId,
  pageSize = 50,
  onDeleted,
}: {
  accounts?: Account[];
  accountId?: string;
  pageSize?: number;
  onDeleted?: () => void | Promise<void>;
}) {
  const { transactions, loadMore, hasMore, loading, error, initialLoaded } =
    usePaginatedTransactions({ accountId, pageSize });

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) loadMore();
        }
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="space-y-3">
      <TransactionsList
        transactions={transactions}
        accounts={accounts}
        showFilters
        onDeleted={onDeleted}
      />
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 text-center">
          Erreur de chargement : {error}
        </div>
      )}
      {hasMore && (
        <div ref={sentinelRef} className="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          {loading ? 'Chargement…' : 'Défilez pour charger plus'}
        </div>
      )}
      {!hasMore && initialLoaded && transactions.length > pageSize && (
        <div className="py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Fin de l&apos;historique
        </div>
      )}
    </div>
  );
}
