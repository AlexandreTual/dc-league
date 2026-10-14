# Assistant IA (Gemini) : clé, réglages et confidentialité

L'assistant IA explique une carte ou l'interaction entre plusieurs cartes, dans un petit chat. On l'ouvre depuis :

- la fiche « Oracle et règles » d'une carte (bouton « Demander à l'IA ») ;
- la page d'un deck (bouton « Assistant IA ») ;
- le menu d'une carte visible à la table (« Ajouter à la question IA ») : mode test, partie en ligne, fenêtre du plateau d'un adversaire.

Il utilise **Google Gemini, en offre gratuite**. Le site envoie à Gemini le texte Oracle, le texte français et les règles officielles des cartes choisies : l'IA ne cherche rien sur Internet.

Limites : joueurs connectés seulement, **20 questions par joueur et par jour** (remis à zéro à minuit, heure de Paris), 10 cartes au plus par question.

---

## 1. Créer la clé Gemini (une fois)

Depuis le navigateur du téléphone :

1. Ouvre [aistudio.google.com](https://aistudio.google.com) et connecte-toi avec un compte Google.
2. Accepte les conditions d'utilisation si elles s'affichent.
3. Menu (☰) → **Get API key** → **Create API key**. Si on te demande un projet Google Cloud, choisis celui proposé par défaut ou crée-en un.
4. **Copie la clé** (une longue suite de caractères qui commence en général par `AIza`).

Pas de carte bancaire : sans facturation activée, le projet reste dans l'offre gratuite.

## 2. Mettre la clé dans Cloudflare Pages

Le tableau de bord Cloudflare est en anglais :

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → projet **dc-league** → **Settings** → **Variables and Secrets**.
2. **+ Add** :
   - **Type** : **Secret** ;
   - **Variable name** : `GEMINI_API_KEY` ;
   - **Value** : la clé copiée.
3. Fais-le pour **Production**, puis recommence pour **Preview** : sans clé en *Preview*, l'aperçu d'une pull request n'affiche pas l'assistant.
4. Facultatif : `GEMINI_MODEL` (type *Text*) pour choisir un autre modèle que celui par défaut (voir § 4).
5. Redéploie pour que la clé soit prise en compte : onglet **Deployments** → dernier déploiement → **⋯** → **Retry deployment** (ou fusionne n'importe quelle pull request).

## 3. Vérifier

1. Connecte-toi, ouvre un de tes decks : le bouton **Assistant IA** apparaît en haut.
2. Clic droit (ou appui long) sur une carte → **Demander à l'IA** → **Explique cette carte**.
3. La réponse arrive en quelques secondes, en français, avec le lien Gatherer de la carte ; le compteur passe à « 19 questions restantes aujourd'hui ».
4. Administration → section **Assistant IA** : l'état est « Activé » et l'utilisation du jour compte ta question.

Si le bouton n'apparaît pas : la clé manque (l'administration affiche « Clé Gemini absente »), le site n'a pas été redéployé, ou l'interrupteur est sur « Désactivé ».

## 4. Modèle et quotas gratuits de Google

- Par défaut, le site utilise `gemini-flash-latest` : l'alias de Google vers son modèle Flash du moment, rapide et compris dans l'offre gratuite. Il suit les nouvelles versions sans changer le code.
- Google fixe un nombre de requêtes par minute et par jour **pour chaque modèle**, et le change de temps en temps. La page **Rate limit** d'AI Studio (menu ☰ → *Usage* / *Rate limit*) donne les chiffres de ton projet.
- Quand le quota de Google est atteint, les joueurs voient « L'assistant IA ne répond pas, réessaie dans un moment » et **la question ne leur est pas décomptée**. Ça repart tout seul (à la minute suivante, ou le lendemain pour le quota du jour).
- Si le quota du modèle par défaut est trop bas : ajoute `GEMINI_MODEL` dans Cloudflare avec le nom d'un autre modèle Flash ou Flash-Lite listé dans AI Studio (par exemple un modèle « flash-lite »), puis redéploie.

## 5. Confidentialité

- Avec l'offre gratuite, **Google peut utiliser les questions et les réponses pour améliorer ses produits** (des personnes peuvent les relire). Ne mets rien de personnel dans une question.
- Ce qui part chez Google : la question, l'historique du chat en cours et les textes des cartes choisies. **Rien d'autre** : ni nom de joueur, ni compte, ni adresse mail.
- Le site ne garde ni les questions ni les réponses : seulement le nombre de questions par joueur et par jour (pour le quota de 20).
- La clé reste sur le serveur : elle n'est jamais envoyée au navigateur.

## 6. Couper l'assistant

- **Pour un moment** : Administration → **Assistant IA** → **Désactiver**. Effet immédiat (les boutons disparaissent au prochain chargement de page) ; **Activer** pour le remettre.
- **Définitivement** : supprime `GEMINI_API_KEY` dans Cloudflare (Production et Preview) et redéploie. Tu peux aussi supprimer la clé dans AI Studio (**Get API key** → icône de corbeille).
