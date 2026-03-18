import { useState } from 'react'
import { Flame, Radio, Filter, Layers, Map, Zap, Target, ChevronDown, Clock } from 'lucide-react'
import { CrimeType, MapMode } from '@/types'
import { CRIME_COLORS } from './MapView'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'

const CRIME_TYPES: (CrimeType | 'All')[] = ['All', 'Theft', 'Assault', 'Robbery', 'Burglary', 'Vandalism', 'Drug Offense', 'Fraud', 'Other']

const MAP_MODES: { id: MapMode; label: string; icon: React.ComponentType<any>; desc: string; color: string }[] = [
  { id: 'heatmap',    label: 'Heatmap',     icon: Flame,   desc: 'Severity-weighted heat', color: 'text-orange-400' },
  { id: 'incidents',  label: 'Incidents',   icon: Map,     desc: 'Clustered markers',      color: 'text-sky-400' },
  { id: 'hotspots',   label: 'Hotspots',    icon: Target,  desc: 'DBSCAN clusters',        color: 'text-red-400' },
  { id: 'prediction', label: 'Prediction',  icon: Zap,     desc: 'AI forecast zones',      color: 'text-amber-400' },
  { id: 'patrol',     label: 'Patrol',      icon: Radio,   desc: 'Unit deployment',        color: 'text-emerald-400' },
]

const TIME_RANGES = ['24h', '7d', '30d', 'all'] as const

interface MapControlsProps {
  filterType: CrimeType | 'All'
  showPatrols: boolean
  onFilterType: (type: CrimeType | 'All') => void
  onTogglePatrols: () => void
  incidentCount: number
}

export function MapControls({ filterType, showPatrols, onFilterType, onTogglePatrols, incidentCount }: MapControlsProps) {
  const { stats, hotspots, mapMode, setMapMode, selectedTimeRange, setTimeRange, patrolUnits, patrolRecommendations } = useAppStore()
  const [filterOpen, setFilterOpen] = useState(false)

  const activePatrols = patrolUnits.filter(p => p.status === 'Active' || p.status === 'Responding').length
  const gapCount = patrolRecommendations.filter(r => r.unitsRequired > r.currentCoverage).length

  return (
    <>
      {/* ── Map mode selector (top centre) ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="glass rounded-xl p-1 flex gap-1">
          {MAP_MODES.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setMapMode(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                mapMode === id
                  ? 'bg-white/10 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              )}
            >
              <Icon size={12} className={mapMode === id ? color : ''} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Left panel ── */}
      <div className="absolute top-16 left-4 z-[1000] space-y-2 w-44">
        {/* Time range */}
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock size={11} className="text-sky-400" />
            <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Time Range</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={cn(
                  'text-[10px] px-1 py-1 rounded-md font-mono transition-all',
                  selectedTimeRange === r ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Layer toggles */}
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={11} className="text-sky-400" />
            <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Layers</span>
          </div>
          <ToggleRow label="Patrols" active={showPatrols} color="text-emerald-400" onClick={onTogglePatrols} />
        </div>

        {/* Crime filter */}
        <div className="glass rounded-xl p-3">
          <button
            onClick={() => setFilterOpen(v => !v)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-1.5">
              <Filter size={11} className="text-sky-400" />
              <span className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">Filter</span>
            </div>
            <ChevronDown size={10} className={cn('text-slate-600 transition-transform', filterOpen && 'rotate-180')} />
          </button>

          {filterOpen && (
            <div className="mt-2 space-y-0.5 max-h-52 overflow-y-auto">
              {CRIME_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => { onFilterType(type); setFilterOpen(false) }}
                  className={cn(
                    'w-full text-left text-xs px-2 py-1.5 rounded-md transition-all flex items-center gap-2',
                    filterType === type ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: type === 'All' ? '#94a3b8' : CRIME_COLORS[type as CrimeType] }}
                  />
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="absolute top-16 right-4 z-[1000] space-y-2 w-40">
        {/* Incident count */}
        <div className="glass rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-display font-bold text-white">{incidentCount}</div>
          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
            {filterType === 'All' ? 'Incidents' : filterType}
          </div>
        </div>

        {/* Hotspot summary */}
        {hotspots.length > 0 && (
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Hotspots</div>
            <div className="text-xl font-display font-bold text-red-400">{hotspots.length}</div>
            <div className="text-[10px] text-slate-500 mt-1">Top risk: {hotspots[0]?.riskScore}/100</div>
          </div>
        )}

        {/* Patrol status */}
        <div className="glass rounded-xl p-3">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Patrols</div>
          <div className="space-y-1">
            <StatusRow color="#10b981" label="Active" count={patrolUnits.filter(p => p.status === 'Active').length} />
            <StatusRow color="#f59e0b" label="Responding" count={patrolUnits.filter(p => p.status === 'Responding').length} />
            <StatusRow color="#3b82f6" label="Standby" count={patrolUnits.filter(p => p.status === 'Standby').length} />
            <StatusRow color="#6b7280" label="Off Duty" count={patrolUnits.filter(p => p.status === 'Off Duty').length} />
          </div>
          {gapCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {gapCount} gap{gapCount > 1 ? 's' : ''} detected
            </div>
          )}
        </div>

        {/* Stats quick */}
        {stats && (
          <div className="glass rounded-xl p-3 space-y-1.5">
            <StatusRow color="#ef4444" label="Open" count={stats.open} />
            <StatusRow color="#10b981" label="Closed" count={stats.closed} />
            <StatusRow color="#f59e0b" label="Invest." count={stats.underInvestigation} />
          </div>
        )}
      </div>

      {/* ── Bottom legend ── */}
      {(mapMode === 'incidents' || mapMode === 'heatmap') && (
        <div className="absolute bottom-10 left-4 z-[1000]">
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Crime Types</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(CRIME_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[10px] text-slate-400">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mapMode === 'hotspots' && (
        <div className="absolute bottom-10 left-4 z-[1000]">
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Risk Score</div>
            <div className="space-y-1">
              {[['≥75 Critical','#ef4444'],['55–74 High','#f97316'],['35–54 Medium','#f59e0b'],['<35 Low','#10b981']].map(([l,c]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                  <span className="text-[10px] text-slate-400">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ToggleRow({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between">
      <span className={cn('text-xs', active ? color : 'text-slate-500')}>{label}</span>
      <div className={cn('w-8 h-4 rounded-full relative transition-all', active ? 'bg-sky-500/30' : 'bg-white/10')}>
        <div className={cn('absolute top-0.5 w-3 h-3 rounded-full transition-all', active ? 'left-4 bg-sky-400' : 'left-0.5 bg-slate-500')} />
      </div>
    </button>
  )
}

function StatusRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        <span className="text-[11px] text-slate-400">{label}</span>
      </div>
      <span className="text-[11px] font-mono text-slate-300">{count}</span>
    </div>
  )
}
