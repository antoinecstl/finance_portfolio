import { getImageProps } from 'next/image';

export type FigureSource = { src: string; width: number; height: number };

type FigureSet = {
  desktop: FigureSource;
  mobile: FigureSource;
  dark: { desktop: FigureSource; mobile: FigureSource };
  alt: string;
};

const m = (name: string, width: number, height: number): FigureSource => ({
  src: `/marketing/${name}.webp`,
  width,
  height,
});

// Captures of real app components rendered with a fictional portfolio, in the
// app's light and dark themes. See DESIGN.md §8 — never use data from a real account.
export const FIGURES = {
  overview: {
    desktop: m('apercu-synthese', 2400, 1384),
    mobile: m('apercu-synthese-mobile', 780, 1378),
    dark: { desktop: m('apercu-synthese-sombre', 2400, 1384), mobile: m('apercu-synthese-mobile-sombre', 780, 1378) },
    alt: "Tableau de bord Fi-Hub : valeur totale, portefeuille actions, variation du jour, épargne, et courbe d'évolution sur un an.",
  },
  positions: {
    desktop: m('positions-pru', 2304, 1004),
    mobile: m('positions-pru-mobile', 716, 1432),
    dark: { desktop: m('positions-pru-sombre', 2304, 1004), mobile: m('positions-pru-mobile-sombre', 716, 1432) },
    alt: 'Détail par position regroupé par compte (PEA, CTO) : quantité, PRU, cours, variation du jour, valeur, poids et plus ou moins-value latente.',
  },
  benchmark: {
    desktop: m('benchmark', 2304, 956),
    mobile: m('benchmark-mobile', 716, 864),
    dark: { desktop: m('benchmark-sombre', 2304, 956), mobile: m('benchmark-mobile-sombre', 716, 864) },
    alt: 'Performance hors apports du portefeuille comparée au CAC 40 depuis le début de l’année : +1,64 % contre +3,12 %, soit un écart de −1,48 point.',
  },
  dividends: {
    desktop: m('dividendes', 2304, 1570),
    mobile: m('dividendes-mobile', 716, 1628),
    dark: { desktop: m('dividendes-sombre', 2304, 1570), mobile: m('dividendes-mobile-sombre', 716, 1628) },
    alt: 'Module dividendes : total reçu, nombre de versements, évolution par année et, par action, montant moyen et rendement sur coût.',
  },
} satisfies Record<string, FigureSet>;

const WIDE_SIZES = '(min-width: 1152px) 1056px, (min-width: 640px) calc(100vw - 96px), calc(100vw - 64px)';
const NARROW_SIZES = '(min-width: 640px) 380px, calc(100vw - 64px)';

// `wide`: desktop capture from 640px up, mobile capture below.
// `narrow`: the mobile capture at every width, for side-by-side sections.
export function ProductFigure({
  figure,
  caption,
  variant = 'wide',
  priority = false,
}: {
  figure: FigureSet;
  caption?: string;
  variant?: 'wide' | 'narrow';
  priority?: boolean;
}) {
  const sizes = variant === 'wide' ? WIDE_SIZES : NARROW_SIZES;
  const common = { alt: figure.alt, sizes, quality: 75, priority };
  const srcSet = (source: FigureSource) => getImageProps({ ...common, ...source }).props.srcSet;
  const { props: imgProps } = getImageProps({ ...common, ...figure.mobile });

  const sources =
    variant === 'wide'
      ? [
          { media: '(prefers-color-scheme: dark) and (min-width: 640px)', source: figure.dark.desktop },
          { media: '(prefers-color-scheme: dark)', source: figure.dark.mobile },
          { media: '(min-width: 640px)', source: figure.desktop },
        ]
      : [{ media: '(prefers-color-scheme: dark)', source: figure.dark.mobile }];

  return (
    <figure className={variant === 'narrow' ? 'mx-auto w-full max-w-[380px]' : undefined}>
      <div className="figure-frame">
        <picture>
          {sources.map(({ media, source }) => (
            <source key={media} media={media} srcSet={srcSet(source)} width={source.width} height={source.height} />
          ))}
          {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
          <img {...imgProps} className="block h-auto w-full rounded-[6px]" />
        </picture>
      </div>
      <figcaption className="mt-3 text-[13px] leading-snug text-[color:var(--text-muted)]">
        {caption ? `${caption} ` : ''}Données d’exemple, portefeuille fictif.
      </figcaption>
    </figure>
  );
}
