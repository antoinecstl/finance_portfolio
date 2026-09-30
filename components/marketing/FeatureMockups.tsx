import { FIGURES, ProductFigure } from '@/components/marketing/ProductFigure';
import { ImportSteps } from '@/components/marketing/ImportSteps';

// One product figure per feature page. Captures come from a fictional
// portfolio (see ProductFigure); the import flow is described as steps.
export function FeatureMockup({ slug }: { slug: string }) {
  if (slug === 'positions-pru') {
    return <ProductFigure figure={FIGURES.positions} caption="Détail par position, regroupé par compte." />;
  }
  if (slug === 'dividendes') {
    return (
      <ProductFigure
        figure={FIGURES.dividends}
        caption="Module dividendes : totaux, évolution par année et rendement sur coût."
      />
    );
  }
  if (slug === 'benchmark') {
    return (
      <ProductFigure
        figure={FIGURES.benchmark}
        caption="Performance hors apports comparée au CAC 40 depuis le 1er janvier."
      />
    );
  }
  if (slug === 'import-transactions') {
    return <ImportSteps headingLevel={2} />;
  }
  return null;
}
