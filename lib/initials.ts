// Initiales affichées dans le menu et le profil : celles du nom, sinon la
// première lettre de l'e-mail.
export function initialsOf(name?: string | null, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  }
  return (email ?? '').trim().slice(0, 1).toUpperCase() || '?';
}
