import { notFound } from 'next/navigation';

// Adresse inconnue sous cette rubrique : 404 affichée dans la navigation de l'app.
export default function MissingPage() {
  notFound();
}
