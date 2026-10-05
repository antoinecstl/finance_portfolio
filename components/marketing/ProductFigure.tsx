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
    desktop: m('apercu-synthese', 2272, 1782),
    mobile: m('apercu-synthese-mobile', 716, 1944),
    dark: { desktop: m('apercu-synthese-sombre', 2272, 1782), mobile: m('apercu-synthese-mobile-sombre', 716, 1944) },
    alt: "Vue d'ensemble Fi-Hub : patrimoine total, performance de l'année hors apports, répartition actions, épargne et liquidités, puis évolution du patrimoine sur un an, empilée par compte, et répartition par compte.",
  },
  accounts: {
    desktop: m('comptes', 2272, 1446),
    mobile: m('comptes-mobile', 716, 1298),
    dark: { desktop: m('comptes-sombre', 2272, 1446), mobile: m('comptes-mobile-sombre', 716, 1298) },
    alt: 'Liste des comptes (PEA, compte-titres, Livret A, LDDS) avec la variation depuis le 1er janvier ; le PEA déplié montre liquidités, actions, apports nets, dividendes et performance hors apports de l’année.',
  },
  positions: {
    desktop: m('positions-pru', 2272, 1004),
    mobile: m('positions-pru-mobile', 716, 2088),
    dark: { desktop: m('positions-pru-sombre', 2272, 1004), mobile: m('positions-pru-mobile-sombre', 716, 2088) },
    alt: 'Détail par position regroupé par compte (PEA, compte-titres) : quantité, PRU, cours, variation du jour, valeur, poids et plus ou moins-value latente.',
  },
  positionDetail: {
    desktop: m('cours-operations', 2268, 1850),
    mobile: m('cours-operations-mobile', 712, 1844),
    dark: { desktop: m('cours-operations-sombre', 2268, 1850), mobile: m('cours-operations-mobile-sombre', 712, 1844) },
    alt: 'Position Schneider Electric dépliée : quantité, PRU, plus-value, totaux des achats, ventes et dividendes, courbe du cours sur six mois avec le dividende placé sur la date de versement, et historique des opérations.',
  },
  benchmark: {
    desktop: m('benchmark', 2272, 960),
    mobile: m('benchmark-mobile', 716, 988),
    dark: { desktop: m('benchmark-sombre', 2272, 960), mobile: m('benchmark-mobile-sombre', 716, 988) },
    alt: 'Performance hors apports du portefeuille comparée au CAC 40 depuis le début de l’année : +2,45 % contre +9,58 %, soit un écart de −7,13 points.',
  },
  projection: {
    desktop: m('projection', 2272, 1192),
    mobile: m('projection-mobile', 716, 1536),
    dark: { desktop: m('projection-sombre', 2272, 1192), mobile: m('projection-mobile-sombre', 716, 1536) },
    alt: 'Projection du patrimoine à trois ans, sans futurs apports : scénarios pessimiste, moyen et optimiste tirés de la performance et de la volatilité passées.',
  },
  dividends: {
    desktop: m('dividendes', 2272, 1890),
    mobile: m('dividendes-mobile', 716, 1966),
    dark: { desktop: m('dividendes-sombre', 2272, 1890), mobile: m('dividendes-mobile-sombre', 716, 1966) },
    alt: 'Module dividendes : total reçu, douze derniers mois, année en cours comparée à la même période de l’an dernier, meilleure ligne, revenus par année et, par position, montant moyen par action et rendement sur coût.',
  },
  api: {
    desktop: m('acces-api', 1728, 1886),
    mobile: m('acces-api-mobile', 716, 1580),
    dark: { desktop: m('acces-api-sombre', 1728, 1886), mobile: m('acces-api-mobile-sombre', 716, 1580) },
    alt: 'Paramètres, Accès API : Claude connecté par OAuth et un jeton personnel en lecture seule, chacun révocable séparément.',
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
