# Site en anglais (interface et cartes) — conception

Date : 2026-10-19
Statut : à valider

## But

Aujourd'hui, le petit bouton FR/EN de la table et de la page d'un deck ne change que la langue des **cartes** (nom,
type, texte, image). Tout le reste (boutons de jeu, menus, fenêtres, pages du site) reste en français. Le site doit être
utilisable par des joueurs qui ne parlent pas français : l'**interface entière** doit pouvoir passer en anglais.

Demande du propriétaire (19 octobre) : pouvoir choisir **séparément** la langue de l'interface et celle des cartes
(par exemple interface en anglais et cartes en français, ou l'inverse).

## Deux réglages indépendants

| Réglage | Valeurs | Ce qu'il change | Où il est retenu |
|---|---|---|---|
| **Langue de l'interface** | Français, English | boutons, menus, fenêtres, pages, journal de partie, messages d'erreur, dates, mails demandés depuis le site, réponses de l'assistant IA | cookie `dc_lang` (1 an), lu par le serveur |
| **Langue des cartes** | Français, English | nom, type, texte et image des cartes (comme aujourd'hui) | `localStorage` `dc-card-lang` (clé actuelle, inchangée) |

- **Première visite** (aucun cookie) : langue de l'interface déduite du navigateur (`Accept-Language`) : français si le
  premier choix français/anglais du navigateur est le français, anglais sinon (un navigateur allemand voit l'anglais).
  Sans en-tête : français.
- **Langue des cartes jamais choisie** : elle suit la langue de l'interface (un visiteur anglophone voit les cartes en
  anglais). Dès qu'elle est choisie une fois, elle est retenue et ne suit plus l'interface.
- Les deux réglages sont **par appareil** (pas enregistrés sur le compte) : pas de migration. Un joueur qui change
  d'appareil choisit de nouveau, ou retrouve la langue de son navigateur.
- Les adresses des pages ne changent pas (`/ligues`, `/salon`, `/profil/decks`…).

## Le sélecteur de langue

Un seul composant, `LanguageMenu`, posé à trois endroits :

1. **Barre du site**, à gauche du compte : bouton compact avec une icône globe et la langue de l'interface (`FR` / `EN`).
2. **Barre de la table** (mode test et en ligne) et **barre de la fenêtre d'un plateau** : remplace l'actuel bouton
   `FR/EN` (la table couvre la barre du site).
3. **Page d'un deck** : remplace l'actuel bouton `FR/EN` des cartes.

Il ouvre une petite bulle :

```
Language / Langue
Interface   [ Français ] [ English ]
Cartes      [ Français ] [ English ]      (« Cards » en anglais)
```

- Le titre est bilingue (« Language / Langue ») pour qu'on le reconnaisse quelle que soit la langue affichée ; chaque
  langue est écrite dans sa propre langue (« Français », « English »).
- Changer l'interface : cookie écrit, la page se met à jour sans rechargement complet (`router.refresh()` pour les
  composants serveur ; les composants client changent tout de suite). À la table, la partie en cours n'est pas
  interrompue (pas de reconnexion au serveur de jeu).
- Changer les cartes : effet immédiat, comme aujourd'hui.
- Tablette : boutons de 44 px, bulle qui s'ouvre du côté où elle tient (comme la bulle « ⋯ » du portrait).
- Le titre du bouton (`aria-label`) : « Langue / Language ».

## Ce qui est traduit

Tout le texte écrit par le site, à l'exception du contenu saisi par les joueurs :

- barre du site, menu du compte, accueil, ligues (liste, création, rejoindre, classement, calendrier, playoffs,
  statistiques, historique, gestion), règles de la ligue, connexion, mot de passe oublié, invitation, profil, mes decks,
  page d'un deck, import, fenêtre « Oracle et règles », assistant IA (panneau), administration, pages d'erreur et 404 ;
- table de jeu (mode test et en ligne) : barre, colonne et portraits, menus des cartes et des piles, fenêtres (dés,
  jetons, piles, ordre, capacités, raccourcis, réglages, force/endurance, loyauté), aperçu, mana, marqueurs, salle
  d'attente, salon, tirage du premier joueur, visio, fin de partie ;
- **journal de partie** : chaque joueur le lit dans sa langue d'interface, avec les noms des cartes dans sa langue des
  cartes (en ligne, un joueur en français et un joueur en anglais lisent chacun le leur) ;
- **messages d'erreur** : des routes du site, du moteur et du serveur de jeu ;
- **dates et nombres** : format de la langue (`fr-FR` / `en-GB`), fuseau inchangé ;
- **mails** : « Mot de passe oublié » dans la langue de l'interface de celui qui le demande ; invitation dans la langue
  choisie par l'admin dans le formulaire d'invitation (par défaut, la langue de son interface) ;
- **assistant IA** : répond dans la langue de l'interface (la consigne change de langue ; le texte Oracle anglais fait
  toujours foi, les noms français ne sont donnés que si l'interface ou les cartes sont en français).

Ne sont **pas** traduits : noms des joueurs, des ligues, des decks, des marqueurs libres créés par les joueurs, textes
saisis (questions à l'IA), contenu des cartes (géré par la langue des cartes), noms des formats « Commander » et
« Duel Commander ».

## Vocabulaire anglais

Termes officiels de Magic (règles complètes en anglais), pour que les joueurs anglophones s'y retrouvent :

| Français | English |
|---|---|
| Champ de bataille / Main / Cimetière / Exil | Battlefield / Hand / Graveyard / Exile |
| Bibliothèque / Zone de commandement | Library / Command zone |
| Engager / Dégager | Tap / Untap |
| Passer hors phase / Revenir en phase | Phase out / Phase in |
| Fin de tour / Piocher / Mélanger | End turn / Draw / Shuffle |
| Jeton / Jeton copie | Token / Token copy |
| Marqueur +1/+1 | +1/+1 counter |
| Force / Endurance / Loyauté | Power / Toughness / Loyalty |
| Taxe de commandant / Blessures de commandant | Commander tax / Commander damage |
| Poison / Monarque / Initiative | Poison / Monarch / Initiative |
| Mulligan / Garder sa main | Mulligan / Keep hand |
| Face cachée / Retourner (transformer) | Face down / Transform |
| Donner le contrôle / Prendre le contrôle | Give control / Gain control |
| Capacités (Vol, Piétinement…) | Keywords (Flying, Trample…) — noms anglais officiels |
| Journal | Game log |
| Mode test | Playtest |
| Salon / Salle d'attente | Lobby / Waiting room |
| Ligue / Classement / Calendrier | League / Standings / Schedule |

Le ton anglais reste familier et court, comme le français (le français tutoie ; l'anglais utilise « you »).

## Architecture

### Dictionnaires typés, sans bibliothèque

- `lib/i18n/` : `Lang = 'fr' | 'en'`, dictionnaires `fr` et `en` découpés par domaine (`common`, `nav`, `table`,
  `menus`, `log`, `leagues`, `decks`, `auth`, `admin`, `ai`, `errors`, `mail`…).
- Le dictionnaire français est la référence : `export type Messages = typeof fr` ; `en: Messages` oblige TypeScript à
  refuser une clé manquante ou en trop. Les textes avec des valeurs sont des fonctions :
  `turn: (n: number) => \`Tour ${n}\`` / `` `Turn ${n}` ``, les pluriels se règlent dans la fonction.
- Pas de bibliothèque (`next-intl`, `i18next`) : le site est petit, en runtime edge, et des objets typés suffisent ;
  pas de nouvelle dépendance à épingler sous `@cloudflare/next-on-pages`.

### Côté serveur

- `getLang()` (`lib/i18n/server.ts`) : cookie `dc_lang`, sinon `Accept-Language`, sinon `fr` ; utilisée par le layout
  (`<html lang>`, titre et description), les pages serveur et les routes API (messages d'erreur, mails).
- Fonction pure `pickLang(cookie, acceptLanguage)` testée à part.
- `messages(lang)` renvoie le dictionnaire.

### Côté navigateur

- `I18nProvider` (client), posé dans le layout autour de toute la page avec la langue lue par le serveur : fournit
  `lang`, `t` (dictionnaire), `setLang`, `cardLang`, `setCardLang`.
- `useT()` pour les composants ; `useCardLang()` remplace `readLang` / `saveLang` dans la table et la page d'un deck.
- Les fonctions pures de `lib/` qui produisent du texte (menus des cartes, barre du site, capacités, marqueurs,
  badges, résumés de joueur, format des ligues…) reçoivent le dictionnaire en paramètre (`t: Messages`) au lieu
  d'écrire le français en dur ; leurs tests passent `fr` et gardent leurs attentes actuelles, plus quelques cas `en`.

### Journal de partie structuré

Aujourd'hui le moteur écrit une phrase française (`LogEntry.text`). Il écrira en plus une ligne structurée :

```ts
type LogEntry = {
  turn: number; actor: string | null; text: string; visibleTo: string[] | 'all'; roll?: true
  /** Ligne à traduire côté navigateur ; absente des lignes écrites par un serveur de jeu plus ancien. */
  msg?: LogMessage
}
type LogMessage = { key: LogKey; params?: Record<string, LogParam> }
type LogParam = string | number | { card: { owner: string; ref: number | null; token?: string } } | { player: string } | { zone: ZoneLabelKey }
```

- Le navigateur affiche `formatLog(msg, t, cardLang, view)` quand `msg` est là, sinon `text` (lignes anciennes ou
  serveur de jeu plus ancien) : jamais de plantage, au pire une ligne en français.
- `text` reste écrit en français : un navigateur plus ancien (juste après une fusion) lit toujours le journal.
- Les noms des cartes sont résolus côté navigateur avec la langue des cartes du lecteur.
- **Informations cachées** : un paramètre `card` n'est mis que là où `text` contient déjà le nom de la carte, avec la
  même visibilité (`visibleTo`) ; une carte face cachée reste « une carte face cachée » (paramètre absent). Le
  catalogue qui permet de lire `ref` est déjà envoyé aux joueurs : la ligne n'apprend rien de plus que la phrase.
- Les tests existants du moteur sur `text` restent ; de nouveaux tests vérifient `msg` et `formatLog` en `fr` (même
  phrase que `text`) et en `en`.

### Messages d'erreur

- Routes du site : elles répondent dans la langue de la requête (`getLang()` d'après le cookie, envoyé avec chaque
  requête du site). Les messages sont déplacés dans le dictionnaire `errors`.
- Moteur (`validate.ts`, `canApply`) et serveur de jeu : ils continuent d'envoyer le message français (le serveur de
  jeu ne voit pas le cookie du site, et un serveur plus ancien enverra toujours du français). Le navigateur le traduit
  avec une table de correspondance français → anglais (`errors.game`) ; un message inconnu s'affiche tel quel.

### Compatibilité

- Serveur de jeu plus ancien (aperçu d'une PR, quelques minutes après une fusion) : `msg` absent → `text` affiché ;
  erreurs françaises traduites par la table de correspondance.
- Aucun nouveau champ obligatoire dans `PlayerView` ; aucune migration ; aucun nouveau secret.

## Vérification

- Vitest : `pickLang`, parité des dictionnaires (TypeScript, plus un test qui vérifie qu'aucune valeur anglaise n'est
  restée identique au français par erreur, hors liste blanche : « Commander », « Mulligan », « Initiative »…),
  `formatLog`, menus en anglais, consigne IA en anglais, mails en anglais.
- Navigateur : nouveau `scripts/i18n-check.mjs` : passe chaque page (visiteur, joueur, admin, mode test, partie en
  ligne à deux joueurs dont un en français et un en anglais) en anglais et échoue s'il trouve du texte français
  visible (mots-outils français et lettres accentuées), hors contenu des joueurs (noms des comptes de test, decks,
  ligues) et hors cartes ; vérifie aussi les deux réglages séparés (interface anglaise + cartes françaises et
  l'inverse) et la langue déduite du navigateur. Les scripts existants tournent en français (cookie `dc_lang=fr`
  posé par les scripts) et restent verts.

## Hors champ

- Autres langues que le français et l'anglais (la structure le permettra plus tard : un dictionnaire de plus).
- Langue retenue sur le compte.
- Traduction du contenu des cartes (déjà géré par la langue des cartes, via Scryfall).
- Adresses de pages en anglais.

## Points à valider

1. Langue d'un nouveau visiteur déduite du navigateur (proposé) plutôt que toujours le français.
2. Journal traduit pour chaque joueur (proposé) : c'est l'étape la plus lourde (le moteur change) ; elle peut être
   repoussée en fin de chantier, le journal restant en français en attendant.
3. Mails et assistant IA dans la langue de l'interface (proposé).
4. Langue des cartes qui suit l'interface tant qu'elle n'a jamais été choisie (proposé).
