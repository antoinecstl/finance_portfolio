import { useCallback, useMemo, useState } from 'react';
import { evenlySpacedTicks, tickCountForWidth } from './chart-axis';

/**
 * Repères d'axe X réguliers (premier et dernier point inclus), recalculés
 * selon la largeur réelle du graphique. Brancher `onResize` sur le
 * ResponsiveContainer et passer `ticks` + `interval={0}` à XAxis.
 */
export function useEvenXTicks<T>(values: readonly T[], minLabelWidth = 72) {
  const [width, setWidth] = useState(0);
  const onResize = useCallback((nextWidth: number) => {
    setWidth((previous) => (Math.abs(previous - nextWidth) > 1 ? nextWidth : previous));
  }, []);
  // ~56 px réservés à l'axe Y.
  const ticks = useMemo(
    () => evenlySpacedTicks(values, tickCountForWidth(width - 56, minLabelWidth)),
    [values, width, minLabelWidth]
  );
  return { ticks, onResize };
}
