# Scripts vidéos TikTok / Instagram — Fi-Hub

**Mis à jour :** 13 mai 2026  
**Format cible :** 9:16 vertical, 1080×1920, 30 fps  
**Chiffres réels :** patrimoine 154 462 € · perf 2026 +7,32% · CAC 40 -2,83% · dividendes 585 € · EARLY100

> **Problème identifié :** vues OK, zéro inscription. Chaque vidéo doit désormais se terminer sur une friction réduite au maximum : "gratuit, pas de CB, 2 minutes pour démarrer."

---

## Sommaire

| # | Titre | Type | Durée | Outil | Objectif |
|---|-------|------|-------|-------|----------|
| V1 | Le compteur de patrimoine | Remotion | 20s | Remotion | Wow effect / partage |
| V2 | Benchmark animé 3 courbes | Remotion | 25s | Remotion | Crédibilité perf |
| V3 | Dividendes par année | Remotion | 20s | Remotion | Snowball effect |
| V4 | Onboarding en 60s | Screen recording | 60s | CapCut | **Conversion directe** |
| V5 | Excel vs Fi-Hub chronométré | Screen recording | 45s | CapCut | Pain point |
| V6 | EARLY100 — il reste X places | Texte animé | 15s | CapCut | **Urgence / FOMO** |
| V7 | Pourquoi 82% ETF World | Texte éducatif | 45s | CapCut | Autorité + algo |
| V8 | 3 métriques que t'as jamais calculées | Texte éducatif | 50s | CapCut | Valeur + hook |
| V9 | Le coût caché de ne pas suivre | Éducatif + chiffres | 40s | CapCut | Urgence cognitive |

---

## REMOTION — Setup

```bash
npx create-video@latest --yes --blank --no-tailwind fi-hub-videos
cd fi-hub-videos
npm install
```

Format commun dans `src/Root.tsx` :

```tsx
import { Composition } from "remotion";
import { PatrimoineCounter } from "./PatrimoineCounter";
import { BenchmarkChart } from "./BenchmarkChart";
import { DividendesChart } from "./DividendesChart";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="PatrimoineCounter"
        component={PatrimoineCounter}
        durationInFrames={600} // 20s à 30fps
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="BenchmarkChart"
        component={BenchmarkChart}
        durationInFrames={750} // 25s
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="DividendesChart"
        component={DividendesChart}
        durationInFrames={600} // 20s
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
```

---

## V1 — Le compteur de patrimoine (Remotion)

**Concept :** Les chiffres de chaque compte apparaissent un par un, s'additionnent, et le total final monte en counter animé jusqu'à 154 462 €. Pur wow effect.

**Voix-off :**
> "Un PEA... un Livret A... un LDDS... une crypto... et un Livret Jeune. Cinq comptes. Un seul chiffre."

**CTA final :** `Fi-Hub — Gratuit · Pas de CB · 2 min pour démarrer`

### `src/PatrimoineCounter.tsx`

```tsx
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

const ACCOUNTS = [
  { label: "PEA IBKR", type: "PEA", value: 107908, color: "#2D6A4F" },
  { label: "Livret A", type: "Livret A", value: 26710, color: "#40916C" },
  { label: "LDDS", type: "LDDS", value: 12207, color: "#52B788" },
  { label: "Binance", type: "Crypto", value: 6011, color: "#74C69D" },
  { label: "Livret Jeune", type: "Autre", value: 1624, color: "#95D5B2" },
];

const TOTAL = 154462;

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

const AccountRow: React.FC<{
  account: (typeof ACCOUNTS)[0];
  progress: number; // 0 → 1
}> = ({ account, progress }) => {
  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const translateX = interpolate(progress, [0, 0.5], [-60, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const displayValue = account.value * Math.min(progress * 2, 1);

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${translateX}px)`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "28px 48px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div>
        <div style={{ fontSize: 36, fontWeight: 700, color: "#fff" }}>
          {account.label}
        </div>
        <div
          style={{
            fontSize: 26,
            color: account.color,
            fontWeight: 500,
            marginTop: 6,
          }}
        >
          {account.type}
        </div>
      </div>
      <div style={{ fontSize: 40, fontWeight: 800, color: "#fff" }}>
        {formatEuro(displayValue)}
      </div>
    </div>
  );
};

const TotalCounter: React.FC<{ progress: number }> = ({ progress }) => {
  const value = interpolate(progress, [0, 1], [130000, TOTAL], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const scale = interpolate(progress, [0, 0.2, 1], [0.8, 1.05, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 48px",
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ fontSize: 32, color: "#95D5B2", marginBottom: 16, letterSpacing: 4 }}>
        PATRIMOINE TOTAL
      </div>
      <div
        style={{
          fontSize: 110,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1,
          letterSpacing: -2,
        }}
      >
        {formatEuro(value)}
      </div>
    </div>
  );
};

export const PatrimoineCounter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Chaque compte apparaît à 1s d'intervalle, à partir de 1s
  const accountStartFrames = ACCOUNTS.map((_, i) => fps * 1 + i * fps * 0.8);
  // Total apparaît après le dernier compte + 1s
  const totalStartFrame = accountStartFrames[ACCOUNTS.length - 1] + fps * 1.5;
  const ctaStartFrame = totalStartFrame + fps * 2;

  const ctaOpacity = interpolate(frame, [ctaStartFrame, ctaStartFrame + fps], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {/* Header */}
      <Sequence from={0} durationInFrames={fps * 1.5} layout="none">
        <div
          style={{
            textAlign: "center",
            padding: "80px 48px 40px",
            fontSize: 38,
            color: "rgba(255,255,255,0.6)",
            fontWeight: 500,
          }}
        >
          5 comptes. Un seul chiffre.
        </div>
      </Sequence>

      {/* Comptes */}
      {ACCOUNTS.map((account, i) => {
        const startFrame = accountStartFrames[i];
        const progress = interpolate(frame, [startFrame, startFrame + fps * 1.2], [0, 1], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
          easing: Easing.out(Easing.quad),
        });
        return (
          <Sequence key={account.label} from={startFrame} layout="none">
            <AccountRow account={account} progress={progress} />
          </Sequence>
        );
      })}

      {/* Total */}
      <Sequence from={totalStartFrame} layout="none">
        <TotalCounter
          progress={interpolate(frame, [totalStartFrame, totalStartFrame + fps * 1.5], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          })}
        />
      </Sequence>

      {/* CTA */}
      <Sequence from={ctaStartFrame} layout="none">
        <div
          style={{
            opacity: ctaOpacity,
            textAlign: "center",
            padding: "0 48px 80px",
          }}
        >
          <div
            style={{
              background: "#52B788",
              borderRadius: 20,
              padding: "28px 60px",
              display: "inline-block",
              fontSize: 34,
              fontWeight: 700,
              color: "#1a1a2e",
            }}
          >
            fi-hub.subleet.com
          </div>
          <div style={{ marginTop: 20, fontSize: 26, color: "rgba(255,255,255,0.5)" }}>
            Gratuit · Pas de CB · 2 min
          </div>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
```

---

## V2 — Benchmark animé 3 courbes (Remotion)

**Concept :** Trois courbes se dessinent de gauche à droite sur 20s. La verte (ton PEA) termine au-dessus du rouge (CAC 40). Le S&P 500 légèrement au-dessus du PEA — honnête.

**Voix-off :**
> "En 2026, le CAC 40 perd 2,83%. Le S&P 500 gagne 9,95%. Mon PEA : +7,32%. Je bats pas le marché américain. Mais pendant que le CAC coule, mon portefeuille tient."

**CTA :** `Tu veux suivre ta propre courbe ? Lien en bio`

### `src/BenchmarkChart.tsx`

```tsx
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

// Données simulées YTD 2026 (Jan → Mai), normalisées à base 100
const DATA_POINTS = 20; // nb de points sur l'axe X

const generateCurve = (finalReturn: number, volatility: number): number[] => {
  const points: number[] = [100];
  for (let i = 1; i < DATA_POINTS; i++) {
    const trend = (finalReturn / 100 / DATA_POINTS);
    const noise = (Math.random() - 0.5) * volatility;
    points.push(points[i - 1] * (1 + trend + noise));
  }
  // Forcer la valeur finale
  const scale = (100 + finalReturn) / points[DATA_POINTS - 1];
  return points.map(p => p * scale);
};

// Seed fixe pour reproductibilité
const PEA_CURVE =    [100,101.2,100.8,102.1,101.5,103.2,102.8,104.1,103.5,105.2,104.8,106.1,105.5,106.8,106.2,107.1,106.8,107.5,107.1,107.32];
const CAC_CURVE =    [100,99.1, 98.5, 99.2, 98.8, 98.1, 97.5, 98.2, 97.8, 97.1, 97.5, 97.8, 97.2, 97.5, 97.1, 97.8, 97.2, 97.5, 97.1, 97.17];
const SP500_CURVE =  [100,100.5,99.8, 101.2,100.5,101.8,101.2,102.5,101.8,102.5,103.2,103.8,103.2,104.1,103.5,104.8,104.2,105.1,104.5,109.95];

const CHART_W = 900;
const CHART_H = 520;
const PADDING = { top: 40, right: 40, bottom: 60, left: 80 };

function curveToPath(data: number[], progress: number): string {
  const visiblePoints = Math.max(2, Math.floor(data.length * progress));
  const minVal = 94;
  const maxVal = 112;

  const xScale = (i: number) =>
    PADDING.left + (i / (data.length - 1)) * (CHART_W - PADDING.left - PADDING.right);
  const yScale = (v: number) =>
    PADDING.top + ((maxVal - v) / (maxVal - minVal)) * (CHART_H - PADDING.top - PADDING.bottom);

  let d = `M ${xScale(0)} ${yScale(data[0])}`;
  for (let i = 1; i < visiblePoints; i++) {
    d += ` L ${xScale(i)} ${yScale(data[i])}`;
  }
  return d;
}

const CURVES = [
  { data: PEA_CURVE, color: "#52B788", label: "Mon PEA", value: "+7,32%", labelY: 0 },
  { data: CAC_CURVE, color: "#e63946", label: "CAC 40", value: "-2,83%", labelY: 1 },
  { data: SP500_CURVE, color: "#457b9d", label: "S&P 500", value: "+9,95%", labelY: 2 },
];

export const BenchmarkChart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drawDuration = fps * 14; // les courbes se dessinent sur 14s
  const drawStart = fps * 2;
  const labelStart = drawStart + drawDuration;

  const drawProgress = interpolate(frame, [drawStart, drawStart + drawDuration], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  const titleOpacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const labelOpacity = interpolate(frame, [labelStart, labelStart + fps], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#0d1117",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 40px",
      }}
    >
      {/* Titre */}
      <div style={{ opacity: titleOpacity, textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 36, color: "rgba(255,255,255,0.5)", letterSpacing: 4, marginBottom: 16 }}>
          DEPUIS JANVIER 2026
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, color: "#fff" }}>
          Qui performe le mieux ?
        </div>
      </div>

      {/* Chart SVG */}
      <svg
        width={CHART_W}
        height={CHART_H}
        style={{ overflow: "visible" }}
      >
        {/* Grille horizontale */}
        {[94, 97, 100, 103, 106, 109, 112].map((val) => {
          const y = PADDING.top + ((112 - val) / (112 - 94)) * (CHART_H - PADDING.top - PADDING.bottom);
          return (
            <g key={val}>
              <line
                x1={PADDING.left} y1={y}
                x2={CHART_W - PADDING.right} y2={y}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1}
              />
              <text x={PADDING.left - 10} y={y + 5} fill="rgba(255,255,255,0.3)" fontSize={20} textAnchor="end">
                {val}
              </text>
            </g>
          );
        })}

        {/* Ligne 100 (base) plus visible */}
        <line
          x1={PADDING.left} y1={PADDING.top + ((112 - 100) / 18) * (CHART_H - PADDING.top - PADDING.bottom)}
          x2={CHART_W - PADDING.right} y2={PADDING.top + ((112 - 100) / 18) * (CHART_H - PADDING.top - PADDING.bottom)}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1.5}
          strokeDasharray="8,6"
        />

        {/* Mois labels */}
        {["Jan", "Fév", "Mar", "Avr", "Mai"].map((m, i) => {
          const x = PADDING.left + (i / 4) * (CHART_W - PADDING.left - PADDING.right);
          return (
            <text key={m} x={x} y={CHART_H - 10} fill="rgba(255,255,255,0.3)" fontSize={22} textAnchor="middle">
              {m}
            </text>
          );
        })}

        {/* Courbes */}
        {CURVES.map((curve) => (
          <path
            key={curve.label}
            d={curveToPath(curve.data, drawProgress)}
            fill="none"
            stroke={curve.color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      {/* Légende avec valeurs finales */}
      <div
        style={{
          opacity: labelOpacity,
          display: "flex",
          gap: 60,
          marginTop: 60,
          justifyContent: "center",
        }}
      >
        {CURVES.map((curve) => (
          <div key={curve.label} style={{ textAlign: "center" }}>
            <div
              style={{
                width: 48,
                height: 6,
                background: curve.color,
                borderRadius: 3,
                margin: "0 auto 16px",
              }}
            />
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)" }}>{curve.label}</div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                color: curve.color,
                marginTop: 8,
              }}
            >
              {curve.value}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Sequence from={labelStart + fps * 2} layout="none">
        <div
          style={{
            opacity: interpolate(frame, [labelStart + fps * 2, labelStart + fps * 3], [0, 1], {
              extrapolateRight: "clamp", extrapolateLeft: "clamp",
            }),
            marginTop: 60,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>
            Tu veux suivre ta propre courbe ?
          </div>
          <div style={{
            background: "#52B788",
            borderRadius: 16,
            padding: "22px 56px",
            display: "inline-block",
            fontSize: 32,
            fontWeight: 700,
            color: "#0d1117",
          }}>
            fi-hub.subleet.com — Gratuit
          </div>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
```

---

## V3 — Dividendes par année (Remotion)

**Concept :** 4 barres qui grandissent de gauche à droite, année par année. La barre 2026 pousse encore en live avec une animation de compteur.

**Voix-off :**
> "2023, 12 euros. 2024, 55 euros. 2025, 348 euros. Et 2026... on est en mai, et c'est déjà 169 euros. C'est l'effet boule de neige. Chaque année, les dividendes grossissent."

**CTA :** `Suis tes dividendes gratuitement · fi-hub.subleet.com`

### `src/DividendesChart.tsx`

```tsx
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

const YEARS = [
  { year: "2023", value: 12.45, color: "#95D5B2" },
  { year: "2024", value: 55.44, color: "#74C69D" },
  { year: "2025", value: 348.0, color: "#52B788" },
  { year: "2026", value: 169.75, color: "#40916C", isCurrentYear: true },
];

const MAX_VALUE = 400;
const BAR_MAX_HEIGHT = 700;

function formatEuro(n: number): string {
  return `${Math.round(n)} €`;
}

const Bar: React.FC<{
  data: (typeof YEARS)[0];
  progress: number;
  showLabel: boolean;
}> = ({ data, progress, showLabel }) => {
  const barH = (data.value / MAX_VALUE) * BAR_MAX_HEIGHT * progress;
  const displayValue = data.value * progress;
  const labelOpacity = interpolate(progress, [0.6, 1], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        width: 180,
      }}
    >
      {/* Valeur */}
      <div
        style={{
          opacity: labelOpacity,
          fontSize: data.isCurrentYear ? 52 : 44,
          fontWeight: 900,
          color: data.color,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        {formatEuro(displayValue)}
        {data.isCurrentYear && (
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.4)", fontWeight: 400, marginTop: 4 }}>
            à mi-mai
          </div>
        )}
      </div>

      {/* Barre */}
      <div
        style={{
          width: "100%",
          height: barH,
          background: data.isCurrentYear
            ? `linear-gradient(to top, ${data.color}, #95D5B2)`
            : data.color,
          borderRadius: "12px 12px 0 0",
          minHeight: progress > 0 ? 4 : 0,
          boxShadow: data.isCurrentYear ? `0 0 40px ${data.color}60` : "none",
          transition: "none",
        }}
      />

      {/* Année */}
      <div
        style={{
          marginTop: 20,
          fontSize: 36,
          fontWeight: 700,
          color: data.isCurrentYear ? "#fff" : "rgba(255,255,255,0.5)",
        }}
      >
        {data.year}
      </div>
    </div>
  );
};

export const DividendesChart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, fps * 0.8], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  // Chaque barre apparaît avec 1s d'écart
  const barStarts = YEARS.map((_, i) => fps * 1.5 + i * fps * 1.2);
  const ctaStart = barStarts[YEARS.length - 1] + fps * 2;

  const ctaOpacity = interpolate(frame, [ctaStart, ctaStart + fps], [0, 1], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#0d1117",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 60px",
      }}
    >
      {/* Titre */}
      <div style={{ opacity: titleOpacity, textAlign: "center", marginBottom: 80 }}>
        <div style={{ fontSize: 34, color: "rgba(255,255,255,0.4)", letterSpacing: 4, marginBottom: 12 }}>
          MES DIVIDENDES
        </div>
        <div style={{ fontSize: 58, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
          L'effet boule de neige.
        </div>
      </div>

      {/* Barres */}
      <div
        style={{
          display: "flex",
          gap: 48,
          alignItems: "flex-end",
          height: BAR_MAX_HEIGHT + 120,
        }}
      >
        {YEARS.map((year, i) => {
          const startFrame = barStarts[i];
          const progress = interpolate(frame, [startFrame, startFrame + fps * 1.5], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <Bar
              key={year.year}
              data={year}
              progress={progress}
              showLabel={frame >= startFrame + fps * 0.8}
            />
          );
        })}
      </div>

      {/* Total */}
      <Sequence from={ctaStart - fps} layout="none">
        <div
          style={{
            opacity: interpolate(frame, [ctaStart - fps, ctaStart], [0, 1], {
              extrapolateRight: "clamp", extrapolateLeft: "clamp",
            }),
            marginTop: 40,
            textAlign: "center",
            fontSize: 36,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Total encaissé :{" "}
          <span style={{ color: "#52B788", fontWeight: 700 }}>585,64 €</span>
        </div>
      </Sequence>

      {/* CTA */}
      <Sequence from={ctaStart} layout="none">
        <div
          style={{
            opacity: ctaOpacity,
            marginTop: 48,
            textAlign: "center",
          }}
        >
          <div
            style={{
              background: "#40916C",
              borderRadius: 16,
              padding: "24px 56px",
              display: "inline-block",
              fontSize: 30,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            Suis tes dividendes · fi-hub.subleet.com
          </div>
          <div style={{ marginTop: 16, fontSize: 24, color: "rgba(255,255,255,0.3)" }}>
            Gratuit · Pas de CB
          </div>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
```

---

## V4 — Onboarding en 60s (Screen recording + CapCut)

> **C'est la vidéo la plus importante pour les conversions.** Elle répond à "qu'est-ce qui se passe si je clique ?". Montrer le chemin complet supprime la peur de l'inconnu.

**Structure :**

| Timing | Écran | Texte superposé |
|--------|-------|----------------|
| 0–3s | Écran d'accueil Fi-Hub | `POV : tu cliques sur le lien en bio` |
| 3–8s | Page d'inscription, remplissage email + password | `Email. Mot de passe. C'est tout.` |
| 8–12s | Dashboard vide "Bienvenue" | `Tu arrives ici.` |
| 12–20s | Ajout du premier compte (PEA) | `Tu ajoutes ton PEA. 30 secondes.` |
| 20–32s | Ajout d'une transaction (achat ETF) | `Ta première transaction. Nom, quantité, prix.` |
| 32–42s | Dashboard qui se remplit, graphique qui apparaît | `Et voilà ton dashboard.` |
| 42–50s | Zoom sur la courbe de performance | `Ta performance en temps réel.` |
| 50–60s | Vue des comptes, total affiché | `Tout ça. Gratuit. En 2 minutes.` |

**Voix-off (optionnel) :**
> "Inscription. Premier compte. Première transaction. Et ton dashboard est prêt. Deux minutes, pas de carte bancaire, et tu vois enfin où tu en es."

**CTA final :**
```
fi-hub.subleet.com
Gratuit · Pas de CB · EARLY100 pour -50% Pro
```

**Notes CapCut :**
- Vitesse x1.3 sur les séquences de frappe
- Zoom animé sur chaque chiffre clé
- Son : notification satisfaisante quand le dashboard apparaît

---

## V5 — Excel vs Fi-Hub chronométré (Screen recording + CapCut)

**Concept :** Timer visible à l'écran. Tu ouvres Excel, tu saisis des cours à la main, tu calcules. Ensuite tu ouvres Fi-Hub, tout est déjà là. La comparaison de temps est brutale.

**Structure :**

| Timing | Écran | Texte | Timer |
|--------|-------|-------|-------|
| 0–3s | Titre noir | `Mettre à jour un suivi Excel vs Fi-Hub` | — |
| 3–5s | Excel s'ouvre | `EXCEL` | ⏱ démarre |
| 5–20s | Tu cherches les cours, tu saisis manuellement, formules | `Chercher le cours... Copier... Coller...` | ⏱ +15s |
| 20–30s | Tu continues, des erreurs `#REF!` apparaissent | `Une formule casse...` | ⏱ +25s |
| 30–35s | COUPE BRUTALE — écran noir | `On a arrêté là.` | ⏱ figé |
| 35–38s | Fi-Hub s'ouvre | `FI-HUB` | ⏱ repart de 0 |
| 38–42s | Dashboard déjà à jour, cours en temps réel | `Déjà à jour.` | ⏱ 4s |
| 42–50s | Zoom sur la ligne de mise à jour "13/05/2026 20:14" | `Mis à jour automatiquement.` | — |
| 50–55s | Split screen : Excel (en cours) / Fi-Hub (4s) | — | — |

**Voix-off :**
> "Excel : on a arrêté à 30 secondes. Fi-Hub : 4 secondes. Tout est automatique."

**CTA :**
```
Arrête de perdre du temps.
fi-hub.subleet.com — Gratuit
```

---

## V6 — EARLY100 — il reste X places (texte animé CapCut)

> **Vidéo la plus courte. Objectif unique : créer de l'urgence. Poster quand il reste ~30-40 places.**

**Structure (15s) :**

| Timing | Texte | Style |
|--------|-------|-------|
| 0–2s | `Les 100 premiers Pro à -50% à vie.` | Blanc, 52px |
| 2–4s | `Pas -50% pendant 3 mois.` | Blanc, 44px |
| 4–6s | `À VIE.` | Vert #52B788, 90px, gras |
| 6–9s | `Il reste [X] places.` | Blanc, 56px, compteur |
| 9–11s | `Après ça : plein tarif.` | Rouge, 44px |
| 11–13s | `Code EARLY100` | Vert, 60px, box blanche |
| 13–15s | `fi-hub.subleet.com` | Vert clair, 44px |

**Son :** Tick d'horloge en fond, ou urgency sound effect.

**Note :** Refaire cette vidéo chaque semaine en mettant à jour le compteur de places restantes.

---

## V7 — Pourquoi 82% ETF World (texte éducatif CapCut)

**Concept :** Partager ta logique d'allocation. Pas de promo directe — 100% valeur. Les gens s'identifient, commentent, tu gagnes de l'autorité.

**Structure (45s) :**

| Timing | Texte | Voix-off |
|--------|-------|---------|
| 0–4s | `Pourquoi j'ai mis 82% de mon PEA en ETF World` | "Je vais t'expliquer ma logique." |
| 4–10s | `1/ Je suis pas analyste. Je peux pas battre les gérants pros.` | "Je suis développeur, pas gérant de fonds." |
| 10–18s | `2/ L'ETF World c'est 1 600 entreprises dans 23 pays. Diversification maximale.` | "Un seul ETF, toute la planète." |
| 18–26s | `3/ Frais : 0,12%/an. Mon ancienne AV : 2%/an. Ça fait une différence énorme sur 20 ans.` | "Les frais tuent la perf à long terme." |
| 26–35s | `4/ Je DCA chaque mois. Je touche pas pendant les baisses.` | "La régularité bat le market timing." |
| 35–42s | `Résultat 2026 : +7,32%  pendant que le CAC 40 perd -2,83%` | "Et voilà où j'en suis." |
| 42–45s | `Tu suis ton PEA comment toi ?` | "Dis-moi en commentaire." |

**Screen à insérer (frame 35–42s) :** Widget benchmark de Fi-Hub avec les 3 chiffres.

**Note :** Terminer sur une question → engagement maximal → algorithme. Pas de CTA direct dans cette vidéo — répondre "Fi-Hub" dans les commentaires.

---

## V8 — 3 métriques que t'as jamais calculées (éducatif CapCut)

**Concept :** Hook ultra-fort sur un manque de connaissance. Chacune des 3 métriques est un mini-pain point qui vend l'outil sans le mentionner jusqu'à la fin.

**Structure (50s) :**

| Timing | Texte | Voix-off |
|--------|-------|---------|
| 0–4s | `3 métriques de portefeuille que 90% des investisseurs ne calculent jamais` | "T'as probablement jamais calculé ça." |
| 4–14s | `1/ Le rendement sur coût (yield on cost)` · `Pas le rendement affiché. Ce que TU touches par rapport à CE QUE TU AS PAYÉ.` · `Exemple : BEN.PA, rendement affiché 4%. Mon yield on cost : 5,82%.` | "La différence change tout sur le long terme." |
| 14–26s | `2/ La performance hors apports (TWR)` · `Si tu verses 500€/mois, tu peux croire que ton portefeuille monte alors que ta perf réelle est nulle.` · `Le TWR isole la vraie performance de gestion.` | "Beaucoup de gens se font ce piège." |
| 26–38s | `3/ Le poids réel de chaque position` · `Tu sais que tu as 8 lignes. Tu sais pas que 82% de ton PEA c'est UNE seule.` · `La concentration tue la diversification sans qu'on s'en rende compte.` | "Et souvent on découvre ça trop tard." |
| 38–46s | `Ces 3 métriques sont calculées automatiquement dans Fi-Hub.` | "J'ai construit l'outil pour ne plus avoir à les calculer à la main." |
| 46–50s | `fi-hub.subleet.com · Gratuit · Pas de CB` | "Lien en bio." |

**Screen à insérer (frame 38–46s) :** Page Positions avec le tableau de performance par position.

---

## V9 — Le coût caché de ne pas suivre (éducatif + chiffres)

**Concept :** Démontrer par l'absurde que ne pas suivre son portefeuille a un coût financier réel. Transforme l'inaction en douleur.

**Structure (40s) :**

| Timing | Texte | Voix-off |
|--------|-------|---------|
| 0–5s | `Ne pas suivre son portefeuille, ça coûte combien ?` | "Je vais te donner un chiffre réel." |
| 5–14s | `Si tu avais su que LVMH sous-performait, tu aurais peut-être réalloué. LVMH en 2025 : -15%. 1 800€ investis = -270€.` | "Sans suivi, t'as pas vu venir le problème." |
| 14–24s | `Si tu avais su que ton ETF World était à 82% de ton portefeuille, tu aurais peut-être diversifié. Concentration = risque non voulu.` | "Ce que tu ne mesures pas, tu ne le contrôles pas." |
| 24–33s | `Et si t'avais su que ton CAC 40 perdait pendant que ton MSCI World tenait, t'aurais bougé plus tôt ?` | "L'information existe. Le dashboard aussi." |
| 33–38s | `Fi-Hub te donne la vue en temps réel. Gratuit.` | "Pour arrêter de piloter à l'aveugle." |
| 38–40s | `fi-hub.subleet.com` | "Lien en bio." |

---

## Récapitulatif production

### Ordre de publication recommandé

| Semaine | Vidéo | Pourquoi |
|---------|-------|---------|
| S1 | V4 (onboarding 60s) | Convertit directement — poste maintenant |
| S1 | V6 (EARLY100) | Urgence — poste maintenant pendant que c'est frais |
| S2 | V1 Remotion (compteur patrimoine) | Wow effect + partage |
| S2 | V8 (3 métriques) | Valeur éducative haute |
| S3 | V2 Remotion (benchmark courbes) | Crédibilité perf |
| S3 | V7 (82% ETF World) | Autorité + commentaires |
| S4 | V3 Remotion (dividendes) | Snowball effect |
| S4 | V9 (coût de ne pas suivre) | Urgence cognitive |
| S5 | V5 (Excel vs Fi-Hub) | Pain point fort |

### Checklist avant publication

- [ ] Lien fi-hub.subleet.com en bio Instagram ET TikTok
- [ ] Code EARLY100 visible en bio tant que l'offre est active
- [ ] Hashtags TikTok : `#investissement` `#patrimoine` `#PEA` `#bourse` `#financePersonnelle` `#argent` `#ETF`
- [ ] Hashtags Instagram : mêmes + `#épargne` `#finance`
- [ ] Premier commentaire épinglé : lien direct + code EARLY100
- [ ] Répondre à TOUS les commentaires dans les 30 minutes après publication (algorithme)

### Setup Remotion pour render final

```bash
# Preview
npx remotion studio

# Render vertical TikTok/Reels (1080x1920)
npx remotion render PatrimoineCounter --output=out/v1-patrimoine.mp4
npx remotion render BenchmarkChart --output=out/v2-benchmark.mp4
npx remotion render DividendesChart --output=out/v3-dividendes.mp4
```

### Voix-off avec ElevenLabs (optionnel)

Si tu veux une voix synthétique propre plutôt que de te filmer :
1. Colle le script voix-off sur [elevenlabs.io](https://elevenlabs.io)
2. Voix recommandée : "Adam" (FR) ou "Charlie" — neutre, pas trop IA
3. Exporte en MP3, glisse dans CapCut ou dans `public/` pour Remotion

---

*Fichier mis à jour le 13 mai 2026.*
