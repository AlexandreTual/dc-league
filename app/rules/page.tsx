import { BookOpen, Shield, Clock, Users, ExternalLink, CheckCircle } from 'lucide-react'

const rules = [
  {
    icon: Users,
    title: 'Format',
    items: [
      'Duel Commander — 20 points de vie',
      'Decks de 100 cartes (1 commandant + 99 cartes)',
      '1 exemplaire maximum de chaque carte (sauf terrains de base)',
      'Commandant en zone de commandement',
    ],
  },
  {
    icon: Clock,
    title: 'Déroulement des matchs',
    items: [
      'Best of 3 (BO3) — premier à 2 victoires de manches',
      'Temps limite : 60 minutes par match',
      'À l\'expiration du temps : 5 tours additionnels',
      'Si toujours à égalité après les 5 tours : match nul (1 point chacun)',
    ],
  },
  {
    icon: Shield,
    title: 'Proxys',
    items: [
      '100% autorisés — on joue le pilote, pas le portefeuille',
      'Les impressions doivent être de bonne qualité et parfaitement lisibles',
      'Sleeves opaques ou protège-cartes identiques pour tout le deck',
      'Pas de carte marquée intentionnellement',
    ],
  },
  {
    icon: BookOpen,
    title: 'Decklist & Enregistrement',
    items: [
      'Inscription obligatoire du deck via un lien Moxfield',
      'Le deck est "locké" pour toute la durée de la ligue',
      'Aucun changement de deck autorisé entre les matchs de ligue',
      'En cas de problème : contacter l\'admin avant le match',
    ],
  },
]

export default function RulesPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <BookOpen className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl md:text-4xl font-bold text-dc-gold">
          Règles de la Ligue
        </h1>
        <p className="text-dc-muted text-sm max-w-md mx-auto">
          La ligue se joue en phase de Round Robin (tout le monde affronte tout le monde),
          suivie d&apos;un Top 4 entre les quatre meilleurs joueurs.
        </p>
      </div>

      {/* Scoring explainer */}
      <div className="bg-dc-surface border border-dc-gold/20 rounded-2xl p-6 shadow-gold">
        <h2 className="font-fantasy font-bold text-dc-gold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Système de points
        </h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-dc-green/30 border border-dc-green-light/20 rounded-xl p-4">
            <div className="font-fantasy font-bold text-3xl text-dc-green-light">3</div>
            <div className="text-dc-muted text-sm mt-1">Victoire</div>
            <div className="text-dc-green-light/60 text-xs mt-0.5">2-0 ou 2-1</div>
          </div>
          <div className="bg-dc-surface border border-dc-border rounded-xl p-4">
            <div className="font-fantasy font-bold text-3xl text-dc-text">1</div>
            <div className="text-dc-muted text-sm mt-1">Nul</div>
            <div className="text-dc-muted/60 text-xs mt-0.5">1-1</div>
          </div>
          <div className="bg-dc-red/30 border border-dc-red-light/20 rounded-xl p-4">
            <div className="font-fantasy font-bold text-3xl text-dc-red-light">0</div>
            <div className="text-dc-muted text-sm mt-1">Défaite</div>
            <div className="text-dc-red-light/60 text-xs mt-0.5">1-2 ou 0-2</div>
          </div>
        </div>
        <p className="text-dc-muted text-xs text-center mt-4">
          En cas d&apos;égalité au classement : la différence de manches (GW−GL) est utilisée comme critère de départage.
        </p>
      </div>

      {/* Rule sections */}
      <div className="grid gap-4 md:grid-cols-2">
        {rules.map(({ icon: Icon, title, items }) => (
          <div
            key={title}
            className="bg-dc-surface border border-dc-border rounded-2xl p-5 space-y-3"
          >
            <h2 className="font-fantasy font-bold text-dc-gold flex items-center gap-2 text-lg">
              <Icon className="w-5 h-5 shrink-0" />
              {title}
            </h2>
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-dc-text/80">
                  <span className="text-dc-gold/50 mt-0.5 shrink-0">›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Banlist */}
      <div className="bg-dc-surface border border-dc-border rounded-2xl p-5 space-y-3">
        <h2 className="font-fantasy font-bold text-dc-gold flex items-center gap-2 text-lg">
          <Shield className="w-5 h-5 shrink-0" />
          Banlist officielle
        </h2>
        <p className="text-dc-text/80 text-sm">
          La ligue utilise la banlist officielle du format Duel Commander, maintenue par le comité mtgdc.info.
        </p>
        <a
          href="https://www.mtgdc.info/banned-restricted"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-dc-gold/10 hover:bg-dc-gold/20 border border-dc-gold/30 text-dc-gold rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          Consulter la banlist sur mtgdc.info
        </a>
      </div>

      {/* Format footer */}
      <div className="text-center text-dc-muted text-xs space-y-1 pb-4">
        <p>Format non-officiel pour usage privé entre amis.</p>
        <p>Magic: The Gathering est une marque de Wizards of the Coast.</p>
      </div>
    </div>
  )
}
