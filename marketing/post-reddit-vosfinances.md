# Brouillon — post r/vosfinances

Statut : brouillon à relire et à publier par toi. Le brief de lancement classait Reddit en priorité 1 et le notait « pas encore fait ».

## Avant de publier

- **Relis les règles du sous-forum sur l'auto-promotion** (barre latérale et message épinglé). Beaucoup de communautés finance exigent une participation préalable ou l'accord des modérateurs : demande-le par message aux modérateurs plutôt que de risquer la suppression.
- **Publie avec ton compte personnel**, pas un compte créé pour l'occasion, et réponds aux commentaires dans les heures qui suivent.
- **Ne mets pas de code promo dans le post** : il transforme un retour d'expérience en publicité.
- **Un seul lien**, vers le calculateur gratuit. Il se teste sans compte, ce qui lève l'objection « encore un outil qui veut mon e-mail ».

## Titre

J'ai fait un calculateur de PRU gratuit (achats, ventes, frais) parce que celui de mon courtier ne compte pas les frais

## Texte

Bonjour,

Mon courtier affiche un PRU hors frais, et dès que je renforce une ligne plusieurs fois je ne sais plus où est mon vrai seuil de rentabilité. J'ai fini par écrire un petit calculateur : on saisit ses achats et ses ventes, il donne le PRU frais inclus, la plus-value latente au cours du jour et la plus-value réalisée sur les ventes.

Il est gratuit, sans inscription, et tout se calcule dans le navigateur : https://fi-hub.subleet.com/outils/calcul-pru

Deux choses que j'ai apprises en le faisant, si ça sert à quelqu'un :

- Une vente ne change pas le PRU (méthode du coût moyen pondéré). Elle réduit la quantité et dégage une plus-value par rapport au PRU du moment. Seul un achat le fait bouger.
- L'écart avec le PRU du courtier vient presque toujours des frais, d'un transfert de titres ou d'une opération sur titres (division, attribution gratuite).

Le calculateur fait partie d'un outil de suivi que je développe seul (PEA, CTO, livrets, performance hors apports comparée à un indice). Je ne détaille pas ici, ce n'est pas l'objet du post.

Ce qui m'intéresse : est-ce que le calcul correspond à ce que vous voyez chez votre courtier ? Et quels cas manquent (PEA-PME, dividendes réinvestis, titres en devise) ?

## Réponses à préparer

- **« C'est quoi le modèle économique ? »** Le suivi est gratuit jusqu'à 3 comptes ; une offre payante existe pour l'import de relevés illimité et les dividendes. Le calculateur restera gratuit.
- **« Vous avez accès à mes comptes ? »** Non : aucune connexion bancaire, tout est saisi ou importé par l'utilisateur.
- **« Pourquoi pas un tableur ? »** Un tableur fait très bien ce calcul. L'outil sert quand on veut les cours à jour et la performance hors apports sans maintenir les formules.

## Mesurer le résultat

Dans Vercel Analytics, regarde les visites de `/outils/calcul-pru` dans les 48 heures, puis l'événement `signup_completed`. Si le post est supprimé, ne le republie pas : écris aux modérateurs.
