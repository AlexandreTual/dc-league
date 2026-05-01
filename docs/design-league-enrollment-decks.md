# Design : Inscription par league & système de decks

## Résumé

Séparation de la gestion globale des joueurs et de leur participation par league.
Introduction d'une entité `deck` réutilisable permettant de tracer quel deck un joueur joue dans chaque league, et de préparer les statistiques futures par deck.

## Contexte

**Problèmes résolus :**
- L'historique d'une saison disparaissait quand un joueur était supprimé
- Impossible de démarrer une nouvelle league sans inclure tous les joueurs
- Les liens Moxfield / images commandant étaient globaux au joueur, pas par deck joué

## Compréhension

- **Players** : entités globales persistantes, jamais supprimées si elles ont un historique de league
- **Decks** : entités appartenant à un joueur, réutilisables entre leagues — nom libre + `commander_image_url` optionnel + `moxfield_url` optionnel
- **League enrollment** : un joueur est inscrit dans une league avec un deck optionnel
- **Admin flow** : section participants inline — cocher joueurs existants + sélectionner/créer leur deck + ajouter de nouveaux joueurs
- **Future** : section joueur avec stats de victoire (taux de victoire par deck, etc.)

## Hypothèses

- Le deck est optionnel lors de l'inscription (un joueur peut être inscrit sans deck défini)
- Un deck utilisé dans une league ne peut pas être supprimé
- Un joueur sans historique peut être supprimé (erreur de saisie)
- Les anciennes `league_players` avec `moxfield_url` / `commander_image_url` directs sont conservées telles quelles pour l'historique existant

---

## Design

### 1. Schéma DB

**Nouvelle table `decks` :**

```sql
CREATE TABLE decks (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  name TEXT NOT NULL,
  commander_image_url TEXT,
  moxfield_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Modification `league_players` :**
- Supprimer `moxfield_url` et `commander_image_url`
- Ajouter `deck_id TEXT REFERENCES decks(id)` (nullable)

**`players` :** `moxfield_url` existant conservé, plus utilisé dans les nouveaux flux.

---

### 2. APIs

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/players/[id]/decks` | Lister les decks d'un joueur |
| `POST` | `/api/players/[id]/decks` | Créer un deck |
| `PATCH` | `/api/leagues/[id]/players/[playerId]` | Assigner un `deck_id` |
| `POST` | `/api/leagues/[id]/players` | Inscrire un joueur existant |
| `DELETE` | `/api/leagues/[id]/players/[playerId]` | Désinscrire (avant génération matchs) |
| `DELETE` | `/api/players/[id]` | Bloqué si `league_players` existe |

---

### 3. UI Admin

**Section "Participants" (remplace "Ajouter un joueur") :**

**Zone A — Joueurs existants**
- Case à cocher par joueur (inscrit / non inscrit)
- Si coché → dropdown avec ses decks + option "+ Créer un deck"
- "+ Créer un deck" → champs inline : nom (obligatoire), image URL (optionnel), Moxfield URL (optionnel)

**Zone B — Nouveau joueur**
- Formulaire : nom + création de son premier deck (optionnel)
- Crée le joueur et l'inscrit automatiquement dans la league

**Validation "Générer les matchs" :** au moins 2 joueurs inscrits

**Suppression joueur :** bouton désactivé avec tooltip si historique league existant

---

### 4. Cas limites

| Cas | Comportement |
|---|---|
| Joueur inscrit sans deck | Autorisé, `deck_id` nullable |
| Deck utilisé dans league_players | Non supprimable |
| Joueur sans historique | Supprimable (erreur de saisie) |
| Désinscription de joueur | Autorisée uniquement avant génération des matchs |
| Deck réutilisé dans plusieurs leagues | Autorisé, supporte les stats futures |
| Anciennes league_players avec moxfield_url | Conservées, affichées telles quelles dans l'historique |

---

## Journal de décisions

| Décision | Alternatives | Raison |
|---|---|---|
| Enrollment inline (Option A) | Wizard, Modal | Moins invasif, cohérent avec l'UX actuelle |
| Deck comme entité séparée | URL directe sur league_players | Réutilisabilité + stats futures par deck |
| deck_id nullable dans league_players | Obligatoire | Ne pas forcer la saisie du deck à l'inscription |
| Blocage suppression joueur avec historique | Soft delete | Simplicité, pas de gestion d'état supplémentaire |
| Blocage suppression deck utilisé | Cascade delete | Intégrité de l'historique |
| players.moxfield_url conservé sans usage | Migration / suppression | Éviter une migration des données existantes |
