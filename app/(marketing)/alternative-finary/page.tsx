import { permanentRedirect } from 'next/navigation';

export default function LegacyAlternativeFinaryPage() {
  permanentRedirect('/alternatives/finary');
}
