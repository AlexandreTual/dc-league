# Design — Assistant IA pour les cartes (interactions et explications)

**Date :** 2026-10-13
**Statut :** Choix validés avec l'utilisateur en conversation (où, fournisseur, quota) ; spec à relire avant le plan.
**Dépend de :** fenêtre « Oracle et règles » (issue #70 : `lib/cards/oracle.ts`, `lib/cards/rulings.ts`, `components/OracleModal.tsx`).

---

## But

Poser une question à une IA sur une carte (« comment marche cette carte ? ») ou sur l'interaction entre plusieurs cartes (« si je joue X avec Y en jeu, que se passe-t-il ? »), puis continuer la discussion dans un petit chat.
L'IA ne cherche rien sur Internet : le serveur lui envoie le **texte Oracle** et les **règles officielles** de chaque carte, qui font foi. Le lien Gatherer reste affiché à côté de la réponse pour vérifier.

## Décisions prises avec l'utilisateur

| Sujet | Décision |
|---|---|
| Où | partout où l'on voit une carte : liste d'un deck, mode test, partie en ligne (table et fenêtre du plateau d'un adversaire) |
| Fournisseur | Google Gemini, offre gratuite (clé Google AI Studio) |
| Quota | **20 questions par joueur et par jour** ; chaque message envoyé dans le chat compte pour une question |
| Ce qu'on envoie à l'IA | texte Oracle anglais, texte imprimé français s'il existe, type, règles officielles de chaque carte ; pas le lien Gatherer (l'IA ne le lirait pas de façon fiable) |

## Décisions proposées dans cette spec (à confirmer à la relecture)

| Sujet | Proposition |
|---|---|
| Qui | joueurs connectés seulement (le quota est par compte) ; un visiteur ne voit pas le bouton |
| Jour du quota | jour civil de Paris (`Europe/Paris`), remis à zéro à minuit |
| Cartes par question | 1 à 10 cartes, uniquement des cartes déjà importées sur le site (comme la route des règles) |
| Longueur | question : 1 000 caractères au plus ; historique renvoyé : les 10 derniers messages au plus |
| Conversation | gardée dans la page (pas en base) ; fermer le panneau la garde jusqu'au rechargement ; bouton « Nouvelle question » pour repartir de zéro |
| Modèle | un modèle Gemini « Flash » de l'offre gratuite, nom dans `GEMINI_MODEL` (valeur par défaut choisie au moment du plan, les noms et quotas de Google changent) |
| Sans clé | si `GEMINI_API_KEY` est absent, la fonction est désactivée : aucun bouton affiché, la route répond 503 « Assistant IA indisponible » |

## Interface

### Ouvrir l'assistant et choisir les cartes

- **Fenêtre « Oracle et règles »** : nouveau bouton « Demander à l'IA ». Il ouvre le panneau de l'assistant avec cette carte déjà choisie.
- **Menu d'une carte visible** (mode test, partie en ligne, fenêtre de plateau) : nouvelle entrée « Ajouter à la question IA », juste sous « Oracle et règles ». Elle ajoute la carte au panneau (et l'ouvre).
- **Liste d'un deck** : même entrée dans la fiche d'une carte, et bouton « Assistant IA » en haut de la liste pour ouvrir le panneau vide.
- On peut donc mélanger ses cartes et celles d'un adversaire **visibles** à la table, pour demander une interaction.

### Panneau de l'assistant

- Panneau à droite sur ordinateur et tablette (au-dessus de la table, sans la recouvrir entièrement), plein écran sur téléphone ; bouton « Fermer ».
- En haut : les cartes choisies en pastilles (nom français si connu, sinon anglais), chacune avec une croix pour la retirer.
- Raccourcis de question selon le nombre de cartes : une carte → « Explique cette carte » ; plusieurs → « Comment ces cartes interagissent-elles ? ». On peut aussi écrire sa propre question.
- Les réponses s'affichent en bulles (texte simple, listes autorisées ; pas de HTML interprété), suivies des liens Gatherer des cartes citées.
- Ligne fixe sous la zone de saisie : « Réponse générée par une IA : elle peut se tromper. Le texte Oracle et les règles font foi. »
- Compteur : « 17 questions restantes aujourd'hui ». À 0 : saisie désactivée, message « Plus de questions pour aujourd'hui, à demain ! ».
- Pendant l'attente : « L'IA réfléchit… » ; bouton d'envoi désactivé (pas de double envoi).

## Serveur

### Route `POST /api/ai/ask`

Corps : `{ oracleIds: string[], messages: { role: 'user' | 'assistant', text: string }[] }` (le dernier message est la nouvelle question).

1. Joueur connecté obligatoire (`apiRoute`), sinon 401.
2. Validation : 1 à 10 `oracleIds` valides (`isOracleId`), dernier message `user`, longueurs ci-dessus ; sinon 400 avec message français.
3. Quota : incrément atomique du compteur du jour **avant** l'appel à Gemini ; au-delà de 20 → 429 « Plus de questions pour aujourd'hui ». Une erreur de Gemini rend la question (décrément), pour ne pas pénaliser le joueur.
4. Cartes : lecture en D1 (anglais + français) et règles via `loadRulings` (cache, Scryfall si besoin, ignorées si indisponibles). Carte inconnue du site → 404 « Carte introuvable ».
5. Appel Gemini (`generateContent`, clé dans l'en-tête `x-goog-api-key`, jamais dans l'adresse), délai max 30 s.
6. Réponse : `{ answer: string, remaining: number }`. Erreurs Gemini (quota Google atteint, délai, refus) → 503 « L'assistant IA ne répond pas, réessaie dans un moment » ; rien de la réponse brute de Google n'est renvoyé au navigateur.

`GET /api/ai/quota` renvoie `{ enabled: boolean, remaining: number }`, pour afficher le compteur et masquer les boutons si la fonction est désactivée.

### Consigne envoyée à l'IA (instruction système)

- Tu es un arbitre de Magic: The Gathering, format Commander. Réponds en français, simplement, en citant les noms français des cartes quand ils sont fournis.
- Appuie-toi d'abord sur le texte Oracle et les règles fournis ; s'ils ne suffisent pas, dis-le et indique la règle générale probable sans l'inventer.
- Reste sur Magic : refuse poliment les autres sujets.

Les cartes sont jointes en bloc structuré (nom anglais, nom français, type, coût, texte Oracle, texte français, règles), une fois par question, avant l'historique.

### Code

- `lib/ai/prompt.ts` : construction de la consigne et du bloc des cartes (pur, testé).
- `lib/ai/gemini.ts` : client Gemini (fetch injecté, pour les tests), traduction des erreurs.
- `lib/ai/quota.ts` + requêtes dans `lib/db-ai.ts` : compteur du jour, incrément / décrément.
- `app/api/ai/ask/route.ts`, `app/api/ai/quota/route.ts` (runtime edge).
- `components/ai/AiPanel.tsx` : panneau ; un état partagé (contexte React) pour que l'Oracle, les menus et la page du deck y ajoutent des cartes.
- `lib/game/menus.ts` : commande `{ kind: 'askAi'; owner; ref }` à côté de `oracle`.

### Base de données

Migration `0015_ai_usage.sql` (ajoutée à `MIGRATIONS` dans `test/d1.ts`) :

```sql
CREATE TABLE ai_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,          -- AAAA-MM-JJ, jour de Paris
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
```

Seul le nombre de questions est gardé : ni questions ni réponses en base. Juste après la fusion, si la table n'existe pas encore (site déployé avant la migration), la route répond 503 propre.

## Règles du projet

- **Informations cachées** : le menu « Ajouter à la question IA » n'existe que sur les cartes visibles (comme « Oracle et règles »), et le panneau est propre à chaque joueur : rien n'est envoyé aux autres joueurs ni au serveur de jeu.
- **Serveur de jeu plus ancien** : aucun nouveau champ dans l'état de partie ; la nouvelle commande de menu reste côté navigateur.
- **Nouveau secret** : `GEMINI_API_KEY` (secret) et `GEMINI_MODEL` (facultatif) dans Cloudflare Pages, ajoutés à `cloudflare-env.d.ts` en facultatifs. Document `docs/assistant-ia.md` pour l'utilisateur : créer la clé sur aistudio.google.com depuis le téléphone, l'ajouter dans Cloudflare Pages (Settings → Variables and Secrets, production et aperçu), redéployer.
- **Confidentialité** : avec l'offre gratuite, Google peut utiliser les questions et réponses pour améliorer ses produits. Seuls les textes des cartes et la question partent chez Google (aucun nom de joueur, aucune donnée de compte). À rappeler dans `docs/assistant-ia.md`.

## Vérifications

- Vitest : consigne et bloc des cartes (carte simple, recto verso, sans texte français, sans règles) ; validation du corps ; quota (20e question acceptée, 21e refusée, jour suivant remis à zéro, décrément si Gemini échoue) ; client Gemini (réponse normale, 429 de Google, délai dépassé, clé jamais dans l'URL) ; route sans clé → 503 ; menus : « Ajouter à la question IA » seulement sur une carte visible.
- Navigateur : `scripts/ai-check.mjs` avec un faux serveur Gemini local (variable `GEMINI_BASE_URL`, réservée au test) : ouvrir depuis l'Oracle d'un deck, ajouter une carte adverse visible en partie en ligne, envoyer, compteur qui baisse, message à 0, affichage téléphone.
- Par l'utilisateur après déploiement : créer la clé, poser une vraie question d'interaction (ex. Teferi, Time Raveler + un contre-sort), vérifier la qualité en français.

## Hors périmètre

- Recherche d'une carte par son nom dans le panneau (seulement les cartes vues sur le site) : issue à part si le besoin se confirme.
- Analyse de deck par IA (déjà dans « Idées pour plus tard »).
- Historique des conversations en base, partage d'une réponse aux autres joueurs de la table.
- Autres fournisseurs (Workers AI, Groq…) : le client est isolé dans `lib/ai/gemini.ts` pour pouvoir en changer plus tard.
