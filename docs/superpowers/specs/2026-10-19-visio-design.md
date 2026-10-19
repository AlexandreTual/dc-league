# Visio entre joueurs — conception

Date : 2026-10-19
Statut : réalisée (demande du propriétaire en conversation, choix par défaut ci-dessous à valider à l'usage)

## But

Voir et entendre les adversaires pendant une partie en ligne, dans une petite fenêtre en haut à droite de la table,
dont on change la taille en tirant sur un coin.

## Table

- Bouton **« Visio »** dans la barre du haut, en partie en ligne seulement (ni mode test, ni spectateur, ni fenêtre
  à part du plateau d'un adversaire), aussi après la fin de la partie. Une pastille compte les joueurs déjà en visio
  (leurs noms dans l'infobulle).
- Cliquer demande caméra et micro au navigateur, puis ouvre la fenêtre. À défaut de caméra, micro seul ; à défaut de
  tout (refus, aucun appareil), on entre quand même : on voit et on entend les autres sans être vu (message en rouge
  dans la fenêtre).
- **Fenêtre** : accrochée en haut à droite de la zone de jeu (sous la barre et les bandeaux), 240 px de large par
  défaut. Une vignette 4:3 par joueur en visio, avec son nom (une colonne pour un adversaire, deux au-delà) ; ma
  propre image en incrustation (miroir) en bas à droite ; seule elle tant que personne d'autre n'est là (« En attente
  des autres joueurs… »).
- **Taille** : tirer le **coin bas gauche** (souris ou doigt) ; de 160 à 720 px de large (jamais plus que la place
  disponible), la hauteur suit. Largeur retenue par le navigateur.
- Barre de la fenêtre : couper / rallumer le **micro**, la **caméra**, **réduire** (seule la barre reste, le son
  continue), **quitter** (caméra relâchée). Caméra coupée : l'initiale du joueur à la place de l'image ; micro coupé :
  icône à côté du nom. « Connexion… » tant qu'une vignette n'est pas reliée.
- Tablette : boutons de 44 px, coin à tirer plus grand.

## Technique

- **WebRTC en maillage** : une connexion directe entre chaque paire de joueurs en visio (5 joueurs au plus : 4
  connexions chacun). Vidéo demandée en 640 × 480, 24 images/s.
- **Signalisation par le serveur de jeu** : message `{ type: 'rtc', to?, data }` relayé tel quel aux sockets du
  destinataire (ou de tous les autres joueurs assis), avec `from` posé par le serveur ; rien n'est enregistré, la
  partie n'est pas touchée, spectateurs exclus, mêmes limites de taille et de débit que les autres messages.
- Un seul pair ouvre chaque connexion (le plus petit identifiant de page) : pas d'offres croisées. Voies audio et
  vidéo créées d'emblée : couper la caméra ou le micro ne renégocie rien. Descriptions envoyées une fois les candidats
  réunis (3 s au plus), donc peu de messages. Connexion perdue : celui qui l'a ouverte relance la recherche de chemin.
- Rechargement de la page : nouveau pair, l'ancienne vignette est remplacée. Reconnexion au serveur : on se
  réannonce ; les connexions encore vivantes sont gardées. Joueur déconnecté de la partie : sa vignette disparaît.
- **Serveurs ICE** : STUN publics (Cloudflare, Google) ; relais **TURN de Cloudflare** facultatif, pour les réseaux
  qui bloquent les connexions directes (`/api/visio/ice`, secrets `TURN_KEY_ID` et `TURN_KEY_API_TOKEN`, voir
  `docs/visio.md`).
- **Serveur de jeu plus ancien** : la vue porte `visio: true` ; sans ce champ, pas de bouton.

## Hors périmètre

- Pas de déplacement libre de la fenêtre (toujours en haut à droite), pas d'enregistrement, pas de visio en mode test.
- Pas de serveur de diffusion (SFU) : inutile à 5 joueurs au plus.

Vérifié par `scripts/visio-check.mjs` (caméras simulées par Chromium, 3 joueurs dont un sur tablette).
