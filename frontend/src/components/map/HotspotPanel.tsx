import { useMemo } from 'react'
import { X, Radio, Clock, AlertTriangle, CheckCircle, TrendingUp, Users } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import { RISK_COLOR, CRIME_COLORS } from './MapView'
import { format } from 'date-fns'
import { CrimeStatus } from '@/types'

const STATUS_COLOR: Record<CrimeStatus, string> = {
  'Open':               '#f87171',
  'Closed':             '#34d399',
  'Under Investigation': '#fbbf24',
}

export function HotspotPanel() {
  const {
    activeHotspot, setActiveHotspot,
    hotspots, displayIncidents, deployPatrolUnit,
    patrolUnits, patrolRecommendations,
  } = useAppStore()

  const hs = hotspots.find(h => h.id === activeHotspot)
  if (!hs) return null

  const color = RISK_COLOR(hs.riskScore)
  const riskLabel = hs.riskScore >= 75 ? 'CRITICAL' : hs.riskScore >= 55 ? 'HIGH' : hs.riskScore >= 35 ? 'MEDIUM' : 'LOW'

  // Filter incidents belonging to this hotspot
  const hsIncidents = useMemo(
    () => displayIncidents.filter(i => hs.incidents.includes(i.id)),
    [displayIncidents, hs.incidents]
  )

  // Hourly breakdown for this hotspot
  const hourData = useMemo(() =>
    Array.from({ length: 24 }, (_, h) => ({
      hour: String(h).padStart(2, '0'),
      count: hsIncidents.filter(i => i.dateTime.getHours() === h).length,
    })),
    [hsIncidents]
  )

  // Patrol coverage
  const nearbyPatrols = useMemo(() =>
    patrolUnits.filter(p => {
      const dlat = p.lat - hs.centroidLat
      const dlng = p.lng - hs.centroidLng
      return Math.sqrt(dlat * dlat + dlng * dlng) * 111_000 < 1500 && p.status !== 'Off Duty'
    }),
    [patrolUnits, hs]
  )

  const rec = patrolRecommendations.find(r => r.hotspotId === hs.id)
  const coverageGap = Math.max(0, hs.recommendedPatrols - nearbyPatrols.length)
  const coveragePct = Math.min(100, Math.round((nearbyPatrols.length / Math.max(hs.recommendedPatrols, 1)) * 100))

  // Type breakdown
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    hsIncidents.forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [hsIncidents])

  return (
    <div className="absolute top-16 right-4 z-[2000] w-72 rounded-xl overflow-hidden shadow-2xl animate-fade-up"
      style={{ background: '#0b1221', border: `1px solid ${color}30` }}>

      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-white/[0.06]"
        style={{ background: `${color}12` }}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-display font-bold text-white">{hs.label}</span>
            <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded-full',
              riskLabel === 'CRITICAL' ? 'severity-critical' :
              riskLabel === 'HIGH' ? 'severity-high' :
              riskLabel === 'MEDIUM' ? 'severity-medium' : 'severity-low'
            )}>{riskLabel}</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500">{hs.id} · Risk {hs.riskScore}/100 · r={Math.round(hs.radius)}m</div>
        </div>
        <button
          onClick={() => setActiveHotspot(null)}
          className="text-slate-500 hover:text-white transition-colors mt-0.5 p-1 rounded-lg hover:bg-white/10"
          aria-label="Close panel"
        >
          <X size={13} />
        </button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 p-3">
          {[
            { label: 'Incidents', value: hs.incidentCount, color },
            { label: 'Open', value: hsIncidents.filter(i => i.status === 'Open').length, color: '#ef4444' },
            { label: 'Severity', value: hsIncidents.length > 0 ? (hsIncidents.reduce((s, i) => s + i.severity, 0) / hsIncidents.length).toFixed(1) : '—', color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-base font-display font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Hourly chart */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock size={11} className="text-sky-400" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Hourly activity</span>
          </div>
          <ResponsiveContainer width="100%" height={72}>
            <AreaChart data={hourData} margin={{ top: 2, right: 0, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id={`grad-${hs.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fontSize: 8, fill: '#475569' }} interval={5} />
              <YAxis tick={{ fontSize: 8, fill: '#475569' }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: 10, color: '#e2e8f0' }}
                cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Area type="monotone" dataKey="count" stroke={color} strokeWidth={1.5} fill={`url(#grad-${hs.id})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Crime type breakdown */}
        {typeCounts.length > 0 && (
          <div className="px-3 pb-3 border-t border-white/[0.05] pt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={11} className="text-sky-400" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Crime breakdown</span>
            </div>
            <div className="space-y-1.5">
              {typeCounts.map(([type, count]) => {
                const pct = Math.round((count / hsIncidents.length) * 100)
                const tc = CRIME_COLORS[type as keyof typeof CRIME_COLORS] ?? '#6b7280'
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tc }} />
                    <span className="text-xs text-slate-400 flex-1">{type}</span>
                    <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tc }} />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 w-4 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Patrol coverage gauge */}
        <div className="px-3 pb-3 border-t border-white/[0.05] pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Users size={11} className="text-sky-400" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Patrol coverage</span>
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">{nearbyPatrols.length} of {hs.recommendedPatrols} units</span>
            <span className={cn('text-xs font-mono', coverageGap > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {coveragePct}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${coveragePct}%`,
                background: coveragePct >= 100 ? '#10b981' : coveragePct >= 60 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>

          {nearbyPatrols.length > 0 && (
            <div className="space-y-1 mb-3">
              {nearbyPatrols.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: p.status === 'Active' ? '#10b981' : p.status === 'Responding' ? '#f59e0b' : '#3b82f6' }} />
                  <span className="text-slate-400 flex-1">{p.name}</span>
                  <span className="text-slate-600">{p.status}</span>
                  {p.isAIDeployed && <span className="text-sky-500 text-[9px]">AI</span>}
                </div>
              ))}
            </div>
          )}

          {/* AI deploy button */}
          {coverageGap > 0 ? (
            <button
              onClick={() => { deployPatrolUnit(hs.id); setActiveHotspot(null) }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', color: '#38bdf8' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.18)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,165,233,0.1)' }}
            >
              <Radio size={12} />
              Deploy AI Unit · {coverageGap} needed
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
              <CheckCircle size={12} />
              Coverage adequate
            </div>
          )}
        </div>

        {/* Recent incidents list */}
        <div className="px-3 pb-4 border-t border-white/[0.05] pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={11} className="text-sky-400" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Recent incidents</span>
            <span className="ml-auto text-[10px] text-slate-600">{hsIncidents.length} total</span>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {hsIncidents.slice(0, 8).map(inc => (
              <div key={inc.id} className="flex items-start gap-2 py-1.5 px-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                  style={{ background: CRIME_COLORS[inc.type] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-slate-300 truncate">{inc.description}</div>
                  <div className="text-[10px] text-slate-600">{format(inc.dateTime, 'dd MMM, HH:mm')}</div>
                </div>
                <span className="text-[9px] px-1 py-0.5 rounded flex-shrink-0"
                  style={{ background: STATUS_COLOR[inc.status] + '18', color: STATUS_COLOR[inc.status] }}>
                  {inc.status === 'Under Investigation' ? 'Invest.' : inc.status}
                </span>
              </div>
            ))}
            {hsIncidents.length > 8 && (
              <div className="text-center text-[10px] text-slate-600 py-1">
                +{hsIncidents.length - 8} more — see Statistics → Incidents table
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
