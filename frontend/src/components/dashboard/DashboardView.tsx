// src/components/dashboard/DashboardView.tsx
// Default landing page — shows live overview cards + map + quick insights.
// Replaces the old UploadView as the entry point.

import { useMemo } from 'react'
import {
  Target, AlertCircle, Shield, TrendingUp, TrendingDown,
  MapPin, Clock, Radio, RefreshCw, Zap,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useCrimesData } from '@/hooks/useCrimesData'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export function DashboardView() {
  const { stats, insights, hotspots, patrolUnits, setView } = useAppStore()
  const { isFetching, isError, error, refetch, dataUpdatedAt } = useCrimesData()

  const alertCount    = insights.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').length
  const activePatrols = patrolUnits.filter(p => p.status === 'Active' || p.status === 'Responding').length
  const topHotspot    = hotspots[0]

  const recentWeek = useMemo(() => {
    if (!stats) return 0
    return stats.byDay.slice(-7).reduce((a, b) => a + b.count, 0)
  }, [stats])

  const prevWeek = useMemo(() => {
    if (!stats) return 0
    return stats.byDay.slice(-14, -7).reduce((a, b) => a + b.count, 0)
  }, [stats])

  const weekChange = prevWeek > 0
    ? Math.round(((recentWeek - prevWeek) / prevWeek) * 100)
    : 0

  const lastUpdated = dataUpdatedAt
    ? format(new Date(dataUpdatedAt), 'HH:mm:ss')
    : null

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-5xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">
              Intelligence Overview
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-slate-500">
                Live crime analysis dashboard
              </p>
              {lastUpdated && (
                <span className="text-[10px] font-mono text-slate-600">
                  Updated {lastUpdated}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              'bg-sky-500/10 border border-sky-500/20 text-sky-400',
              'hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title="Re-fetch data from API"
          >
            <RefreshCw
              size={14}
              className={cn(isFetching && 'animate-spin')}
            />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {isError && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-red-300">Failed to fetch data</div>
              <div className="text-xs text-red-400/70 mt-0.5">
                {(error as Error)?.message ?? 'Unknown error'}
              </div>
            </div>
          </div>
        )}

        {/* ── KPI cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            label="Total Incidents"
            value={stats?.total ?? '—'}
            icon={<Target size={15} />}
            color="text-sky-400"
            bg="bg-sky-500/10"
            onClick={() => setView('stats')}
          />
          <KpiCard
            label="Open Cases"
            value={stats?.open ?? '—'}
            icon={<AlertCircle size={15} />}
            color="text-red-400"
            bg="bg-red-500/10"
            sub={stats ? `${Math.round((stats.open / stats.total) * 100)}% open rate` : undefined}
            onClick={() => setView('stats')}
          />
          <KpiCard
            label="Resolution Rate"
            value={stats ? `${Math.round(stats.resolutionRate)}%` : '—'}
            icon={<Shield size={15} />}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
            sub={stats ? `${stats.closed} closed` : undefined}
            onClick={() => setView('stats')}
          />
          <KpiCard
            label="7-Day Trend"
            value={stats ? `${weekChange > 0 ? '+' : ''}${weekChange}%` : '—'}
            icon={weekChange > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            color={weekChange > 5 ? 'text-red-400' : weekChange < -5 ? 'text-emerald-400' : 'text-amber-400'}
            bg={weekChange > 5 ? 'bg-red-500/10' : weekChange < -5 ? 'bg-emerald-500/10' : 'bg-amber-500/10'}
            sub="vs previous week"
            onClick={() => setView('stats')}
          />
        </div>

        {/* ── Quick-nav tiles ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {/* Spatial Map tile */}
          <QuickTile
            title="Spatial Map"
            description="Heatmap, hotspot clusters, patrol deployment"
            icon={<MapPin size={18} className="text-sky-400" />}
            accent="#0ea5e9"
            badge={hotspots.length > 0 ? `${hotspots.length} hotspots` : undefined}
            onClick={() => setView('map')}
          />

          {/* AI Insights tile */}
          <QuickTile
            title="AI Insights"
            description="Pattern detection, patrol recommendations"
            icon={<Zap size={18} className="text-amber-400" />}
            accent="#f59e0b"
            badge={alertCount > 0 ? `${alertCount} alerts` : undefined}
            badgeColor="text-red-400"
            onClick={() => setView('insights')}
          />

          {/* Statistics tile */}
          <QuickTile
            title="Statistics"
            description="Charts, trends, incident table"
            icon={<TrendingUp size={18} className="text-purple-400" />}
            accent="#8b5cf6"
            onClick={() => setView('stats')}
          />
        </div>

        {/* ── Status row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {/* Top hotspot */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={13} className="text-red-400" />
              <span className="text-xs font-display font-semibold text-slate-300">Top Hotspot</span>
            </div>
            {topHotspot ? (
              <>
                <div className="text-base font-bold text-white">{topHotspot.label}</div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="text-center">
                    <div className="text-xl font-display font-bold"
                      style={{ color: topHotspot.riskScore >= 75 ? '#ef4444' : topHotspot.riskScore >= 55 ? '#f97316' : '#f59e0b' }}>
                      {topHotspot.riskScore}
                    </div>
                    <div className="text-[10px] text-slate-600">risk</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-display font-bold text-white">{topHotspot.incidentCount}</div>
                    <div className="text-[10px] text-slate-600">incidents</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-slate-400">{topHotspot.dominantType}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">dominant type</div>
                  </div>
                </div>
                <button
                  onClick={() => setView('map')}
                  className="mt-3 text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
                >
                  View on map →
                </button>
              </>
            ) : (
              <div className="text-sm text-slate-600">No data available</div>
            )}
          </div>

          {/* Patrol status */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Radio size={13} className="text-emerald-400" />
              <span className="text-xs font-display font-semibold text-slate-300">Patrol Units</span>
            </div>
            <div className="text-2xl font-display font-bold text-white mb-2">
              {activePatrols}
              <span className="text-slate-600 text-lg ml-1">/ {patrolUnits.length}</span>
            </div>
            <div className="space-y-1.5">
              {[
                { status: 'Active',     color: '#10b981' },
                { status: 'Responding', color: '#f59e0b' },
                { status: 'Standby',    color: '#3b82f6' },
                { status: 'Off Duty',   color: '#6b7280' },
              ].map(({ status, color }) => {
                const count = patrolUnits.filter(p => p.status === status).length
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      <span className="text-[11px] text-slate-400">{status}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-300">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Peak time */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={13} className="text-amber-400" />
              <span className="text-xs font-display font-semibold text-slate-300">Activity Pattern</span>
            </div>
            {stats ? (
              <>
                <div className="text-[10px] font-mono text-slate-600 uppercase mb-1">Peak hour</div>
                <div className="text-2xl font-display font-bold text-amber-400 mb-2">
                  {String(stats.byHour.indexOf(Math.max(...stats.byHour))).padStart(2, '0')}:00
                </div>
                <div className="text-[10px] font-mono text-slate-600 uppercase mb-1">Avg severity</div>
                <div className="text-xl font-display font-bold text-white">
                  {stats.averageSeverity.toFixed(1)}
                  <span className="text-slate-600 text-sm">/10</span>
                </div>
                <div className="w-full h-1 rounded-full bg-white/5 mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                    style={{ width: `${(stats.averageSeverity / 10) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-600">No data available</div>
            )}
          </div>
        </div>

        {/* ── Critical insights preview ─────────────────────────────────────── */}
        {insights.length > 0 && (
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={13} className="text-amber-400" />
                <span className="text-sm font-display font-semibold text-slate-200">
                  Critical & High Alerts
                </span>
              </div>
              <button
                onClick={() => setView('insights')}
                className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
              >
                View all {insights.length} →
              </button>
            </div>
            <div className="space-y-2">
              {insights
                .filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')
                .slice(0, 3)
                .map(insight => {
                  const isCritical = insight.severity === 'CRITICAL'
                  return (
                    <div
                      key={insight.id}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
                      style={{
                        background: isCritical ? 'rgba(239,68,68,0.06)' : 'rgba(249,115,22,0.06)',
                        border: `1px solid ${isCritical ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.12)'}`,
                      }}
                    >
                      <span className={cn(
                        'text-[9px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5',
                        isCritical ? 'severity-critical' : 'severity-high',
                      )}>
                        {insight.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-200 truncate">
                          {insight.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {insight.description}
                        </div>
                      </div>
                    </div>
                  )
                })}
              {insights.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').length === 0 && (
                <div className="text-sm text-slate-600 py-2">
                  No critical or high alerts at this time.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon, color, bg, sub, onClick,
}: {
  label: string; value: string | number; icon: React.ReactNode
  color: string; bg: string; sub?: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="glass rounded-xl p-4 stat-card text-left w-full hover:bg-white/[0.04] transition-colors group"
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bg)}>
        <span className={color}>{icon}</span>
      </div>
      <div className={cn('text-2xl font-display font-bold', color)}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </button>
  )
}

function QuickTile({
  title, description, icon, accent, badge, badgeColor = 'text-amber-400', onClick,
}: {
  title: string; description: string; icon: React.ReactNode
  accent: string; badge?: string; badgeColor?: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="glass rounded-xl p-5 text-left w-full transition-all hover:bg-white/[0.04] group"
      style={{ borderTop: `1px solid ${accent}25` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
          {icon}
        </div>
        {badge && (
          <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full', badgeColor)}
            style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
            {badge}
          </span>
        )}
      </div>
      <div className="text-sm font-display font-semibold text-white group-hover:text-sky-300 transition-colors">
        {title}
      </div>
      <div className="text-xs text-slate-500 mt-1">{description}</div>
    </button>
  )
}
