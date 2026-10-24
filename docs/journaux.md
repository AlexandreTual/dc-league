# Journaux et erreurs de production

Quand un joueur voit « Une erreur est survenue », ou qu'un nettoyage de nuit échoue, il en reste maintenant une trace, consultable depuis un téléphone.

## 1. Le journal des erreurs de l'administration (le plus simple)

Page **Administration** du site → section **Journal des erreurs**, tout en bas. On y trouve, la plus récente en haut :

- **Navigateur** : une page qui a planté chez un joueur, avec l'adresse de la page, le compte (s'il était connecté) et le **code** affiché sur son écran ;
- **Serveur** : une route du site qui a renvoyé « Erreur interne, réessaie plus tard », avec la route (`POST /api/…`) et le message brut de la base ;
- **Nettoyage de nuit** : une ligne par nuit où le nettoyage des parties a eu au moins un échec, avec la liste des échecs.

Le journal garde les 200 dernières erreurs (les plus anciennes s'effacent seules) ; la page en montre 50. Le bouton **Vider le journal** efface tout, une fois les problèmes réglés.

### Quand un ami signale une erreur

L'écran d'erreur affiche, quand l'erreur vient du serveur, une ligne **« Code à transmettre : 1234567890 »**. Demande-lui ce code (une capture d'écran suffit) et cherche-le dans le journal : la ligne qui porte le même code est la sienne. Sans code (erreur dans le navigateur), cherche par l'heure et par la page.

Un message côté navigateur peut être générique (« An error occurred in the Server Components render… ») : Next.js cache le détail des erreurs du serveur au navigateur. Le détail est alors dans les journaux Cloudflare du site (point 3), au même moment.

## 2. Les journaux du serveur de jeu (Workers Logs)

Le Worker de jeu (`dc-league-game`) garde ses journaux grâce à `[observability]` dans `workers/game/wrangler.toml` (offre gratuite de Cloudflare : jusqu'à 200 000 lignes par jour, gardées 3 jours). Rien à configurer : c'est actif dès le déploiement qui suit la fusion sur `main`.

Pour les lire, depuis le téléphone :

1. Ouvrir **dash.cloudflare.com** et se connecter.
2. **Workers & Pages** → **dc-league-game**.
3. Onglet **Observabilité** (*Observability*) → **Journaux** (*Logs*). Filtrer sur le niveau **error** pour ne voir que les erreurs, ou chercher `Nettoyage` pour le nettoyage de nuit (chaque nuit vers 3 h 17, heure UTC).

## 3. Les journaux du site (Cloudflare Pages)

Cloudflare Pages ne garde pas les journaux du site : ils ne se lisent qu'en direct. Les erreurs importantes sont donc recopiées dans le journal de l'administration (point 1). Pour regarder en direct, pendant qu'on reproduit un problème :

1. **Workers & Pages** → **dc-league** → **Déploiements** (*Deployments*).
2. Ouvrir le déploiement de production → **Fonctions** (*Functions*) → **Journaux en temps réel** (*Real-time logs*) → **Commencer** (*Begin log stream*).
3. Reproduire l'erreur : les lignes `[api]` et `[erreurs]` apparaissent.

Depuis un ordinateur, `npx wrangler pages deployment tail --project-name dc-league` fait la même chose.
