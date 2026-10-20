import { BookOpen, Shield, Clock, Users, ExternalLink, CheckCircle } from 'lucide-react'
import { getMessages } from '@/lib/i18n/server'

export const runtime = 'edge'

const sections = [
  { key: 'format', icon: Users },
  { key: 'matches', icon: Clock },
  { key: 'proxies', icon: Shield },
  { key: 'decklist', icon: BookOpen },
] as const

export default async function RulesPage() {
  const r = (await getMessages()).site.rules
  const rules = sections.map(({ key, icon }) => ({ key, icon, ...r.sections[key] }))
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
          {r.title}
        </h1>
        <p className="text-dc-muted text-sm max-w-md mx-auto">{r.intro}</p>
      </div>

      {/* Scoring explainer */}
      <div className="bg-dc-surface border border-dc-gold/20 rounded-2xl p-6 shadow-gold">
        <h2 className="font-fantasy font-bold text-dc-gold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {r.scoring}
        </h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-dc-green/30 border border-dc-green-light/20 rounded-xl p-4">
            <div className="font-fantasy font-bold text-3xl text-dc-green-light">3</div>
            <div className="text-dc-muted text-sm mt-1">{r.win}</div>
            <div className="text-dc-green-light/60 text-xs mt-0.5">{r.winScores}</div>
          </div>
          <div className="bg-dc-surface border border-dc-border rounded-xl p-4">
            <div className="font-fantasy font-bold text-3xl text-dc-text">1</div>
            <div className="text-dc-muted text-sm mt-1">{r.draw}</div>
            <div className="text-dc-muted/60 text-xs mt-0.5">1-1</div>
          </div>
          <div className="bg-dc-red/30 border border-dc-red-light/20 rounded-xl p-4">
            <div className="font-fantasy font-bold text-3xl text-dc-red-light">0</div>
            <div className="text-dc-muted text-sm mt-1">{r.loss}</div>
            <div className="text-dc-red-light/60 text-xs mt-0.5">{r.lossScores}</div>
          </div>
        </div>
        <p className="text-dc-muted text-xs text-center mt-4">
          {r.tiebreak}
        </p>
      </div>

      {/* Rule sections */}
      <div className="grid gap-4 md:grid-cols-2">
        {rules.map(({ key, icon: Icon, title, items }) => (
          <div
            key={key}
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
          {r.banlist}
        </h2>
        <p className="text-dc-text/80 text-sm">{r.banlistText}</p>
        <a
          href="https://www.mtgdc.info/banned-restricted"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-dc-gold/10 hover:bg-dc-gold/20 border border-dc-gold/30 text-dc-gold rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          {r.banlistLink}
        </a>
      </div>

      {/* Format footer */}
      <div className="text-center text-dc-muted text-xs space-y-1 pb-4">
        <p>{r.unofficial}</p>
        <p>{r.trademark}</p>
      </div>
    </div>
  )
}
