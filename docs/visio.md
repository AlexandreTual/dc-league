# Visio pendant les parties en ligne

En partie en ligne, le bouton **« Visio »** de la barre du haut ouvre une petite fenêtre en haut à droite de la table
avec la caméra des autres joueurs (spec : `superpowers/specs/2026-10-19-visio-design.md`).

**Rien à configurer pour que ça marche** : les navigateurs se relient directement entre eux, le serveur de jeu ne fait
que les présenter. Il faut seulement autoriser la caméra et le micro quand le navigateur le demande (le site est en
https).

## Si quelqu'un reste sur « Connexion… »

Certains réseaux (4G de certains opérateurs, Wi-Fi d'entreprise ou d'hôtel) bloquent les connexions directes. Il faut
alors un **relais TURN**. Le site sait utiliser celui de **Cloudflare** (la même société que l'hébergement) : gratuit
jusqu'à un volume large (1 000 Go par mois au moment d'écrire ces lignes, à vérifier sur la page des tarifs
Cloudflare Realtime), bien au-delà de quelques parties entre amis.

### Créer la clé TURN (une fois)

Le tableau de bord Cloudflare est en anglais :

1. [dash.cloudflare.com](https://dash.cloudflare.com) → menu de gauche **Realtime** (parfois sous **Media**) →
   **TURN Server** → **Create** (nom : `dc-league`).
2. Copie les deux valeurs affichées : **Turn Token ID** et **API Token** (l'API Token n'est montré qu'une fois).

### Les mettre dans Cloudflare Pages

1. **Workers & Pages** → projet **dc-league** → **Settings** → **Variables and Secrets** → **+ Add** :
   - `TURN_KEY_ID` (type **Secret**) : le Turn Token ID ;
   - `TURN_KEY_API_TOKEN` (type **Secret**) : l'API Token.
2. Fais-le pour **Production**, puis pour **Preview**.
3. Redéploie : **Deployments** → dernier déploiement → **⋯** → **Retry deployment**.

Le site demande alors à Cloudflare des identifiants de relais valables 6 heures à chaque entrée en visio. Si les clés
sont fausses ou si Cloudflare ne répond pas, la visio marche quand même, sans relais.

## Bon à savoir

- Le son et l'image ne passent jamais par le serveur de jeu (sauf par le relais TURN, chiffrés, quand il est utilisé).
- À 5 joueurs, chaque navigateur envoie sa vidéo 4 fois : sur une connexion faible, couper sa caméra soulage tout le
  monde (le micro reste).
- iPhone / iPad : Safari demande l'autorisation à chaque visite.
