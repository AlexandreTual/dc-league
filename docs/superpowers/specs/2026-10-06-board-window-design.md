# Design — Plateau d'un adversaire dans une fenêtre à part (plusieurs écrans)

**Date :** 2026-10-06
**Statut :** Validé avec l'utilisateur (issue #82, commentaire du 6 octobre)
**Dépend de :** colonne joueur façon MTGO (#80, `2026-10-06-player-column-design.md`), que la fenêtre reprend.

---

## Décisions prises avec l'utilisateur

| Sujet | Décision |
|---|---|
| Où | partie en ligne, sur ordinateur (pointeur précis et au moins 1024 px de large) ; ni mode test, ni tablette, ni téléphone |
| Boutons | « Ouvrir dans une fenêtre » : icône dans la ligne portrait de chaque adversaire (bandeau ou plateau agrandi) et ligne dans sa bulle « ⋯ » |
| Adresse | `/tables/<id>/plateau/<joueurId>` |
| Contenu de la fenêtre | colonne de l'adversaire (vie, compteurs, cases, commandant, cimetière) et son champ de bataille en grand, aperçu de la carte survolée ; une barre avec le nom, le tour, le joueur actif, FR/EN et « Ramener sur la table » ; pas de journal ni de lignes d'activité |
| Données | la fenêtre ouvre sa propre connexion au serveur de jeu : même vue filtrée que la table, aucune carte cachée en plus |
| Gestes | menu de carte, appui long, double-clic comme sur la table ; le glisser-déposer ne passe pas d'une fenêtre à l'autre (les menus le remplacent) |
| Table principale | le plateau sorti disparaît, la table récupère la place ; un bandeau « Plateau de X dans une fenêtre à part » avec « Ramener » |
| 3 à 5 joueurs | une fenêtre par adversaire ; recliquer remet la fenêtre existante au premier plan (fenêtre nommée `plateau-<joueurId>`) |
| Fenêtre bloquée | bandeau « Le navigateur a bloqué la fenêtre. » avec le lien « Ouvrir le plateau de X » |

## Fonctionnement

- **Canal** : un `BroadcastChannel` nommé `dc-table-<id>`, partagé par les onglets du site.
- La fenêtre envoie `{ type: 'open', player }` au chargement puis toutes les **2 s**. Elle envoie `{ type: 'closed', player }` à `pagehide` et quand on clique sur « Ramener sur la table ».
- La table sort le plateau dès l'ouverture, puis le garde sorti tant qu'elle reçoit des signaux. Sans signal pendant **5 s** (onglet tué, page qui ne charge pas), le plateau revient.
- « Ramener » sur la table envoie `{ type: 'return', player }` : la fenêtre se ferme, ou revient à la table si le navigateur refuse de la fermer (fenêtre ouverte à la main).
- Une table (re)chargée envoie `{ type: 'hello' }` : les fenêtres ouvertes se signalent aussitôt.
- Adresse invalide (mon propre plateau, joueur absent de la partie) : message en français et lien vers la table. Partie pas encore commencée : retour à la table (salle d'attente).

## Hors périmètre

- Serveur de jeu : rien ne change. Il compte déjà les connexions par joueur (`workers/game/runtime.ts`) : fermer une fenêtre ne fait pas passer le joueur hors ligne. Aucun nouveau champ dans l'état de partie, donc compatible avec le serveur en production.
- Plusieurs adversaires dans une même fenêtre : issue à part si le besoin se confirme.
