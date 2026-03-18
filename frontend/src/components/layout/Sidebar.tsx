// src/components/layout/Sidebar.tsx
import { useState } from 'react'
import {
  Shield, Map, BarChart3, Lightbulb, Settings, LayoutDashboard,
  ChevronLeft, ChevronRight, Radio, Activity, Zap, AlertTriangle,
  RefreshCw, Wifi, WifiOff,
} from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useCrimesData } from '@/hooks/useCrimesData'
import { AppView } from '@/types'
import { cn } from '@/lib/utils'

const NAV_ITEMS: {
  id:    AppView
  label: string
  icon:  React.ComponentType<{ size?: number; className?: string }>
}[] = [
  { id: 'dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'map',       label: 'Spatial Map',  icon: Map },
  { id: 'stats',     label: 'Statistics',   icon: BarChart3 },
  { id: 'insights',  label: 'AI Insights',  icon: Lightbulb },
  { id: 'settings',  label: 'Settings',     icon: Settings },
]

export function Sidebar() {
  const {
    view, setView, stats, insights,
    dataSource, patrolRecommendations, predictions,
  } = useAppStore()

  const { isFetching, isError, refetch, dataUpdatedAt } = useCrimesData()

  const [collapsed, setCollapsed] = useState(false)

  const criticalCount = insights.filter(i => i.severity === 'CRITICAL').length
  const highCount     = insights.filter(i => i.severity === 'HIGH').length
  const alertCount    = criticalCount + highCount
  const gapCount      = patrolRecommendations.filter(r => r.unitsRequired > r.currentCoverage).length

  const now         = new Date()
  const upcomingPeak = predictions
    .filter(p => p.hour > now.getHours() && p.riskLevel === 'CRITICAL')
    .sort((a, b) => b.predictedCount - a.predictedCount)[0]

  const isLive = dataSource === 'api'

  return (
    <aside className={cn(
      'flex flex-col h-full border-r border-white/[0.06] bg-[#0a0f1e] transition-all duration-300 relative z-10 flex-shrink-0',
      collapsed ? 'w-[60px]' : 'w-[220px]',
    )}>
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div className={cn('px-4 py-5 border-b border-white/[0.06]', collapsed && 'px-3')}>
        <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
            <Shield size={15} className="text-sky-400" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-display text-sm font-bold text-white tracking-widest">CRIMEOPS</div>
              <div className="text-[9px] text-slate-600 font-mono tracking-widest">INTELLIGENCE v3</div>
            </div>
          )}
        </div>
      </div>

      {/* ── API connection status ─────────────────────────────────────────── */}
      {!collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg" style={{
          background: isError ? 'rgba(239,68,68,0.08)' : isLive ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
          border:     `1px solid ${isError ? 'rgba(239,68,68,0.2)' : isLive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}`,
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isError
                ? <WifiOff size={11} className="text-red-400" />
                : isFetching
                  ? <RefreshCw size={11} className="text-sky-400 animate-spin" />
                  : <Wifi size={11} className="text-emerald-400" />
              }
              <span className={cn(
                'text-[10px] font-mono tracking-wider uppercase',
                isError ? 'text-red-400' : isFetching ? 'text-sky-400' : 'text-emerald-400',
              )}>
                {isError ? 'API Error' : isFetching ? 'Fetching…' : 'API Live'}
              </span>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-30"
              title="Refresh data"
            >
              <RefreshCw size={10} className={cn(isFetching && 'animate-spin')} />
            </button>
          </div>
          {stats && !isError && (
            <div className="text-[11px] text-slate-400 mt-0.5">{stats.total} incidents loaded</div>
          )}
        </div>
      )}

      {/* ── Critical alert banner ─────────────────────────────────────────── */}
      {!collapsed && alertCount > 0 && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/20">
          <div className="flex items-center gap-2">
            <AlertTriangle size={11} className="text-red-400" />
            <span className="text-[10px] text-red-400 font-mono tracking-wider uppercase">
              {alertCount} Alert{alertCount > 1 ? 's' : ''} Active
            </span>
          </div>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = view === id
          const badge =
            id === 'insights' && alertCount > 0 ? alertCount :
            id === 'map'      && gapCount > 0   ? gapCount   : null

          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 nav-item',
                isActive
                  ? 'bg-sky-500/10 border-l-2 border-sky-400 text-sky-300 font-medium pl-[10px]'
                  : 'text-slate-500 hover:text-slate-300',
                collapsed && 'justify-center px-2',
              )}
            >
              <Icon size={15} className={isActive ? 'text-sky-400' : ''} />
              {!collapsed && <span className="flex-1 text-left">{label}</span>}
              {!collapsed && badge && (
                <span className="bg-red-500/20 text-red-400 text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-red-500/20">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Upcoming peak prediction ──────────────────────────────────────── */}
      {!collapsed && upcomingPeak && (
        <div className="mx-3 mb-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/15">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap size={11} className="text-amber-400" />
            <span className="text-[10px] font-mono text-amber-500 uppercase tracking-wider">AI Forecast</span>
          </div>
          <div className="text-xs text-slate-300">
            Peak at <span className="text-amber-400 font-mono">{upcomingPeak.hour}:00</span>
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">
            {upcomingPeak.predictedCount.toFixed(1)} inc/hr predicted
          </div>
        </div>
      )}

      {/* ── Live case stats ───────────────────────────────────────────────── */}
      {!collapsed && stats && (
        <div className="mx-3 mb-3 p-3 rounded-lg glass space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity size={11} className="text-sky-400" />
            <span className="text-[10px] font-mono text-slate-600 tracking-wider uppercase">Live</span>
          </div>
          <StatRow label="Open Cases" value={stats.open}                              color="text-red-400" />
          <StatRow label="Closed"     value={stats.closed}                            color="text-emerald-400" />
          <StatRow label="Resolved"   value={`${Math.round(stats.resolutionRate)}%`}  color="text-sky-400" />
        </div>
      )}

      {/* ── Patrol summary ────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 rounded-lg glass">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Radio size={11} className="text-sky-400" />
            <span className="text-[10px] font-mono text-slate-600 tracking-wider uppercase">Patrols</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Active',  color: 'text-emerald-400' },
              { label: 'Resp.',   color: 'text-amber-400' },
              { label: 'Standby', color: 'text-sky-400' },
            ].map(({ label, color }) => (
              <span key={label} className={cn('text-[10px]', color)}>● {label}</span>
            ))}
          </div>
          {gapCount > 0 && (
            <div className="mt-1.5 text-[10px] text-red-400 flex items-center gap-1">
              <AlertTriangle size={9} /> {gapCount} zone{gapCount > 1 ? 's' : ''} uncovered
            </div>
          )}
        </div>
      )}

      {/* ── Collapse toggle ───────────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#0a0f1e] border border-white/10 flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors z-20"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="text-[9px] text-slate-700 font-mono tracking-wider">v3.0.0 · CLASSIFIED</div>
        </div>
      )}
    </aside>
  )
}

function StatRow({
  label, value, color,
}: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-slate-600">{label}</span>
      <span className={cn('text-[11px] font-mono font-semibold', color)}>{value}</span>
    </div>
  )
}
