import { useState } from 'react'
import {
  Lightbulb, AlertTriangle, Clock, MapPin, TrendingUp, Users,
  ChevronRight, AlertCircle, Zap, Radio, Target, Shield,
  CheckCircle, ArrowRight
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { AIInsight, InsightSeverity, InsightType, PatrolRecommendation, HotspotCluster } from '@/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Config ─────────────────────────────────────────────────────────────────
const SEV: Record<InsightSeverity, { cls: string; dot: string; bar: string }> = {
  LOW:      { cls: 'severity-low',      dot: 'bg-emerald-400',              bar: 'bg-emerald-500' },
  MEDIUM:   { cls: 'severity-medium',   dot: 'bg-amber-400',                bar: 'bg-amber-500' },
  HIGH:     { cls: 'severity-high',     dot: 'bg-orange-400',               bar: 'bg-orange-500' },
  CRITICAL: { cls: 'severity-critical', dot: 'bg-red-400 animate-pulse',    bar: 'bg-red-500' },
}

const TYPE_ICON: Record<InsightType, React.ComponentType<any>> = {
  hotspot:    MapPin,
  temporal:   Clock,
  alert:      AlertTriangle,
  resource:   Users,
  prediction: Zap,
  patrol:     Radio,
}
const TYPE_BG: Record<InsightType, string> = {
  hotspot:    'bg-orange-500/10',
  temporal:   'bg-sky-500/10',
  alert:      'bg-red-500/10',
  resource:   'bg-purple-500/10',
  prediction: 'bg-amber-500/10',
  patrol:     'bg-emerald-500/10',
}
const TYPE_COLOR: Record<InsightType, string> = {
  hotspot:    'text-orange-400',
  temporal:   'text-sky-400',
  alert:      'text-red-400',
  resource:   'text-purple-400',
  prediction: 'text-amber-400',
  patrol:     'text-emerald-400',
}

const URGENCY_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH:     'text-orange-400',
  MEDIUM:   'text-amber-400',
  LOW:      'text-emerald-400',
}

// ── Main view ──────────────────────────────────────────────────────────────
export function InsightsView() {
  const { insights, patrolRecommendations, hotspots, deployPatrolUnit } = useAppStore()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'insights' | 'patrol' | 'hotspots'>('insights')

  if (insights.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="mx-auto text-slate-600" />
          <p className="text-slate-500">Load data and run analysis to generate insights.</p>
        </div>
      </div>
    )
  }

  const bySev = {
    CRITICAL: insights.filter(i => i.severity === 'CRITICAL').length,
    HIGH:     insights.filter(i => i.severity === 'HIGH').length,
    MEDIUM:   insights.filter(i => i.severity === 'MEDIUM').length,
    LOW:      insights.filter(i => i.severity === 'LOW').length,
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-display font-bold text-white">AI Intelligence Engine</h2>
            <p className="text-sm text-slate-500 mt-0.5">{insights.length} insights · {hotspots.length} hotspots · {patrolRecommendations.length} patrol zones</p>
          </div>
          <div className="flex gap-2">
            {bySev.CRITICAL > 0 && <SevBadge count={bySev.CRITICAL} severity="CRITICAL" />}
            {bySev.HIGH > 0 && <SevBadge count={bySev.HIGH} severity="HIGH" />}
          </div>
        </div>

        {/* Severity summary */}
        <div className="glass rounded-xl p-3 grid grid-cols-4 divide-x divide-white/5 mb-4">
          {(['CRITICAL','HIGH','MEDIUM','LOW'] as InsightSeverity[]).map(s => (
            <div key={s} className="flex flex-col items-center py-1">
              <span className={cn('text-xl font-display font-bold', s === 'CRITICAL' ? 'text-red-400' : s === 'HIGH' ? 'text-orange-400' : s === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400')}>
                {bySev[s]}
              </span>
              <span className="text-[10px] text-slate-600">{s}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 glass rounded-xl p-1">
          {[
            { id: 'insights', label: 'AI Insights', count: insights.length },
            { id: 'patrol', label: 'Patrol AI', count: patrolRecommendations.length },
            { id: 'hotspots', label: 'Hotspots', count: hotspots.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex-1 text-xs py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5',
                activeTab === tab.id ? 'bg-white/10 text-white font-medium' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {tab.label}
              <span className="text-[10px] font-mono bg-white/5 px-1.5 py-0.5 rounded-full">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {activeTab === 'insights' && insights.map(insight => (
          <InsightCard
            key={insight.id}
            insight={insight}
            isExpanded={expanded === insight.id}
            onToggle={() => setExpanded(expanded === insight.id ? null : insight.id)}
          />
        ))}

        {activeTab === 'patrol' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500/8 border border-sky-500/15">
              <Shield size={13} className="text-sky-400" />
              <p className="text-xs text-sky-300">AI analyses crime density and patrol positions to recommend optimal unit deployment.</p>
            </div>
            {patrolRecommendations.map(rec => (
              <PatrolCard key={rec.hotspotId} rec={rec} onDeploy={deployPatrolUnit} />
            ))}
          </div>
        )}

        {activeTab === 'hotspots' && (
          <div className="space-y-3">
            {hotspots.map((hs, i) => (
              <HotspotCard key={hs.id} hs={hs} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function InsightCard({ insight, isExpanded, onToggle }: { insight: AIInsight; isExpanded: boolean; onToggle: () => void }) {
  const sev = SEV[insight.severity]
  const Icon = TYPE_ICON[insight.type]

  return (
    <div className={cn('glass rounded-xl overflow-hidden transition-all',
      insight.severity === 'CRITICAL' && 'border border-red-500/20',
      insight.severity === 'HIGH' && 'border border-orange-500/15',
    )}>
      <button onClick={onToggle} className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', TYPE_BG[insight.type])}>
          <Icon size={15} className={TYPE_COLOR[insight.type]} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full', sev.cls)}>{insight.severity}</span>
            <span className="text-[10px] text-slate-500 capitalize">{insight.type}</span>
            {insight.affectedArea && <span className="text-[10px] text-slate-600">· {insight.affectedArea}</span>}
          </div>
          <div className="text-sm font-medium text-slate-200 leading-tight">{insight.title}</div>
          <div className="text-xs text-slate-500 mt-1 line-clamp-2">{insight.description}</div>
          {insight.metrics && (
            <div className="flex gap-3 mt-2">
              {Object.entries(insight.metrics).slice(0, 3).map(([k, v]) => (
                <div key={k} className="text-[10px]">
                  <span className="text-slate-600">{k}: </span>
                  <span className="text-slate-400 font-mono">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <ChevronRight size={14} className={cn('text-slate-600 flex-shrink-0 mt-1 transition-transform', isExpanded && 'rotate-90')} />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 space-y-3 animate-fade-up">
          <p className="text-sm text-slate-400 leading-relaxed">{insight.description}</p>
          <div className="rounded-lg bg-sky-500/5 border border-sky-500/15 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ArrowRight size={11} className="text-sky-400" />
              <span className="text-[10px] font-mono text-sky-500 uppercase tracking-wider">Recommendation</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{insight.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function PatrolCard({ rec, onDeploy }: { rec: PatrolRecommendation; onDeploy: (id: string) => void }) {
  const gap = rec.unitsRequired - rec.currentCoverage
  const covered = gap <= 0
  const color = URGENCY_COLOR[rec.urgency]

  return (
    <div className={cn('glass rounded-xl p-4', !covered && rec.urgency === 'CRITICAL' && 'border border-red-500/20')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full',
              rec.urgency === 'CRITICAL' ? 'severity-critical' : rec.urgency === 'HIGH' ? 'severity-high' : rec.urgency === 'MEDIUM' ? 'severity-medium' : 'severity-low'
            )}>{rec.urgency}</span>
            <span className="text-xs font-semibold text-slate-200">{rec.location}</span>
            <span className="text-[10px] text-slate-600 font-mono">{rec.hotspotId}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{rec.reason}</p>

          <div className="flex items-center gap-4 mt-3">
            <div className="text-center">
              <div className="text-base font-display font-bold text-white">{rec.currentCoverage}</div>
              <div className="text-[10px] text-slate-600">current</div>
            </div>
            <ArrowRight size={12} className="text-slate-600" />
            <div className="text-center">
              <div className={cn('text-base font-display font-bold', color)}>{rec.unitsRequired}</div>
              <div className="text-[10px] text-slate-600">required</div>
            </div>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', covered ? 'bg-emerald-500' : rec.urgency === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500')}
                style={{ width: `${Math.min(100, (rec.currentCoverage / rec.unitsRequired) * 100)}%` }}
              />
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500">Peak</div>
              <div className="text-xs text-slate-300 font-mono">{rec.timeWindow}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            {rec.crimeTypes.slice(0, 3).map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500">{t}</span>
            ))}
          </div>
        </div>

        {!covered && (
          <button
            onClick={() => onDeploy(rec.hotspotId)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors"
          >
            <Radio size={12} />
            Deploy
          </button>
        )}
        {covered && (
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            <CheckCircle size={12} />
            Covered
          </div>
        )}
      </div>
    </div>
  )
}

function HotspotCard({ hs, rank }: { hs: HotspotCluster; rank: number }) {
  const color = hs.riskScore >= 75 ? '#ef4444' : hs.riskScore >= 55 ? '#f97316' : hs.riskScore >= 35 ? '#f59e0b' : '#10b981'
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: color + '18', border: `1px solid ${color}30` }}>
          <span className="text-xs font-display font-bold" style={{ color }}>#{rank}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-slate-200">{hs.label}</span>
            <span className="text-xs font-mono" style={{ color }}>{hs.riskScore}<span className="text-slate-600">/100</span></span>
          </div>
          <div className="w-full h-1 rounded-full bg-white/5 mb-2 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${hs.riskScore}%`, background: color }} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div><span className="text-slate-600">Incidents</span><div className="text-slate-300 font-mono">{hs.incidentCount}</div></div>
            <div><span className="text-slate-600">Dominant</span><div className="text-slate-300">{hs.dominantType}</div></div>
            <div><span className="text-slate-600">Patrols req.</span><div style={{ color }} className="font-mono">{hs.recommendedPatrols}</div></div>
          </div>
          <div className="text-[10px] text-slate-600 mt-1">ID: {hs.id} · Radius: {Math.round(hs.radius)}m</div>
        </div>
      </div>
    </div>
  )
}

function SevBadge({ count, severity }: { count: number; severity: InsightSeverity }) {
  const s = SEV[severity]
  return (
    <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono', s.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {count} {severity}
    </span>
  )
}
