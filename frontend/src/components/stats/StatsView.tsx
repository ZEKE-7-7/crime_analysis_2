import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts'
import { useAppStore } from '@/store/appStore'
import { TrendingUp, TrendingDown, AlertCircle, Target, Clock, MapPin, Zap, Shield, Table } from 'lucide-react'
import { CRIME_COLORS } from '../map/MapView'
import { CrimeType } from '@/types'
import { cn } from '@/lib/utils'
import { IncidentTable } from './IncidentTable'

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#e2e8f0', fontSize: 11,
    fontFamily: 'DM Sans, sans-serif',
  },
  cursor: { fill: 'rgba(255,255,255,0.03)' },
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type StatsTab = 'overview' | 'temporal' | 'incidents'

export function StatsView() {
  const { stats, predictions, hotspots, displayIncidents } = useAppStore()
  const [activeTab, setActiveTab] = useState<StatsTab>('overview')

  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle size={40} className="mx-auto text-slate-600" />
          <p className="text-slate-500">No data loaded. The API connection may be unavailable.</p>
        </div>
      </div>
    )
  }

  const typeData = Object.entries(stats.byType)
    .map(([type, count]) => ({ type, count, color: CRIME_COLORS[type as CrimeType] || '#6b7280' }))
    .sort((a, b) => b.count - a.count)

  // Hourly chart with prediction + confidence band
  const hourData = stats.byHour.map((count, hour) => ({
    hour: String(hour).padStart(2, '0'),
    count,
    predicted: predictions[hour]?.predictedCount ?? 0,
    lower:     predictions[hour]?.lower ?? 0,
    upper:     predictions[hour]?.upper ?? 0,
  }))

  const dowData = stats.byDayOfWeek.map((count, i) => ({ day: DAY_NAMES[i], count }))

  // Radar — build from actual data keys so it works with any API response
  const radarData = typeData.slice(0, 6).map(d => ({
    subject: d.type.length > 8 ? d.type.slice(0, 8) : d.type,
    value: d.count,
  }))

  const recentWeek = stats.byDay.slice(-7).reduce((a, b) => a + b.count, 0)
  const prevWeek   = stats.byDay.slice(-14, -7).reduce((a, b) => a + b.count, 0)
  const weekChange = prevWeek > 0 ? Math.round(((recentWeek - prevWeek) / prevWeek) * 100) : 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex-shrink-0 px-6 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-display font-bold text-white">Statistics</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {stats.total} incidents · {hotspots.length} hotspot clusters
            </p>
          </div>
        </div>

        <div className="flex gap-1 mb-4" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
          {([
            { id: 'overview',  label: 'Overview',  icon: Target },
            { id: 'temporal',  label: 'Temporal',  icon: Clock },
            { id: 'incidents', label: 'Incidents', icon: Table },
          ] as { id: StatsTab; label: string; icon: React.ComponentType<any> }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all',
                activeTab === id ? 'bg-white/10 text-white font-medium' : 'text-slate-500 hover:text-slate-300',
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className={cn('flex-1 overflow-y-auto px-6 pb-6', activeTab === 'incidents' && 'overflow-hidden flex flex-col')}>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3">
              <KpiCard label="Total" value={stats.total} icon={<Target size={15} />} color="text-sky-400" bg="bg-sky-500/10" />
              <KpiCard label="Open" value={stats.open} icon={<AlertCircle size={15} />} color="text-red-400" bg="bg-red-500/10"
                sub={`${Math.round((stats.open / stats.total) * 100)}% rate`} />
              <KpiCard label="Resolution" value={`${Math.round(stats.resolutionRate)}%`} icon={<Shield size={15} />}
                color="text-emerald-400" bg="bg-emerald-500/10" sub={`${stats.closed} closed`} />
              <KpiCard
                label="7-Day Trend"
                value={`${weekChange > 0 ? '+' : ''}${weekChange}%`}
                icon={weekChange > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                color={weekChange > 5 ? 'text-red-400' : weekChange < -5 ? 'text-emerald-400' : 'text-amber-400'}
                bg={weekChange > 5 ? 'bg-red-500/10' : weekChange < -5 ? 'bg-emerald-500/10' : 'bg-amber-500/10'}
                sub="vs prev week"
              />
            </div>

            {/* Severity gauge + status pie + risk hours */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={13} className="text-sky-400" />
                  <span className="text-xs font-display font-semibold text-slate-200">Avg Severity</span>
                </div>
                <div className="text-4xl font-display font-bold text-white">
                  {stats.averageSeverity.toFixed(1)}
                  <span className="text-slate-600 text-xl">/10</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/5 mt-3 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
                    style={{ width: `${(stats.averageSeverity / 10) * 100}%` }} />
                </div>
                <div className="text-[10px] text-slate-600 mt-2">
                  Violent crime: {Math.round(stats.violentCrimePct)}%
                  {stats.violentCrimePct > 15 && <span className="text-red-500 ml-1">⚠ above threshold</span>}
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={13} className="text-sky-400" />
                  <span className="text-xs font-display font-semibold text-slate-200">Case Status</span>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <PieChart>
                    <Pie data={[
                      { name: 'Open', value: stats.open, fill: '#ef4444' },
                      { name: 'Closed', value: stats.closed, fill: '#10b981' },
                      { name: 'Invest.', value: stats.underInvestigation, fill: '#f59e0b' },
                    ]} cx="50%" cy="50%" innerRadius={28} outerRadius={42} paddingAngle={3} dataKey="value">
                      {['#ef4444','#10b981','#f59e0b'].map((fill, i) => <Cell key={i} fill={fill} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-around text-[10px] mt-1">
                  <span className="text-red-400">Open {stats.open}</span>
                  <span className="text-emerald-400">Closed {stats.closed}</span>
                  <span className="text-amber-400">Inv. {stats.underInvestigation}</span>
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={13} className="text-amber-400" />
                  <span className="text-xs font-display font-semibold text-slate-200">Predicted Risk</span>
                </div>
                {predictions.length > 0 ? (
                  <div className="space-y-2">
                    {(['CRITICAL','HIGH','MEDIUM','LOW'] as const).map(level => {
                      const count = predictions.filter(p => p.riskLevel === level).length
                      const colors = { CRITICAL:'#ef4444', HIGH:'#f97316', MEDIUM:'#f59e0b', LOW:'#10b981' }
                      return (
                        <div key={level} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: colors[level] }} />
                          <span className="text-xs text-slate-400 flex-1">{level}</span>
                          <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(count/24)*100}%`, background: colors[level] }} />
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 w-4 text-right">{count}h</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600">No predictions available</div>
                )}
              </div>
            </div>

            {/* Crime type bar + radar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Target size={13} className="text-sky-400" />
                  <h3 className="text-sm font-display font-semibold text-slate-200">Incidents by Type</h3>
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={typeData} barSize={22}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="type" tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" height={45} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {typeData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={13} className="text-sky-400" />
                  <h3 className="text-sm font-display font-semibold text-slate-200">Crime Radar</h3>
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.06)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#64748b' }} />
                    <Radar dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.14} strokeWidth={1.5} />
                    <Tooltip {...TOOLTIP_STYLE} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top locations */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={13} className="text-sky-400" />
                <h3 className="text-sm font-display font-semibold text-slate-200">Top Crime Locations</h3>
              </div>
              <div className="space-y-2">
                {stats.topLocations.map(({ location, count }, i) => {
                  const pct = Math.round((count / stats.total) * 100)
                  const isHotspot = hotspots.some(h => h.label === location)
                  return (
                    <div key={location} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-600 w-4">{i + 1}</span>
                      <span className="text-sm text-slate-300 flex-1">{location}</span>
                      {isHotspot && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                          HS
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 w-6 text-right">{count}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TEMPORAL TAB ── */}
        {activeTab === 'temporal' && (
          <div className="space-y-4">
            {/* Hourly with prediction + confidence band */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={13} className="text-sky-400" />
                <h3 className="text-sm font-display font-semibold text-slate-200">24h Pattern + AI Forecast</h3>
              </div>
              <div className="flex items-center gap-4 text-[10px] mb-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-6 h-0.5 bg-sky-400 rounded inline-block" />
                  Historical
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-6 h-0.5 bg-amber-400 rounded inline-block" style={{ borderTop: '2px dashed #f59e0b', height: 0 }} />
                  Predicted
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-3 bg-amber-400/15 rounded inline-block" />
                  ±1σ confidence
                </span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={hourData}>
                  <defs>
                    <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748b' }} interval={2} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  {/* Confidence band — upper fills, then lower overwrites with bg */}
                  {predictions.length > 0 && (
                    <>
                      <Area type="monotone" dataKey="upper" stroke="none" fill="#f59e0b" fillOpacity={0.12} legendType="none" name="Upper" />
                      <Area type="monotone" dataKey="lower" stroke="none" fill="#0b1221"  fillOpacity={1}    legendType="none" name="Lower" />
                      <Area type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={1.5}
                        strokeDasharray="5 3" fill="none" name="Predicted" />
                    </>
                  )}
                  <Area type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2}
                    fill="url(#histGrad)" name="Historical" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Day of week + 30-day trend */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={13} className="text-sky-400" />
                  <h3 className="text-sm font-display font-semibold text-slate-200">Day of Week</h3>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={dowData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {dowData.map((_, i) => <Cell key={i} fill={i === 0 || i === 6 ? '#8b5cf6' : '#0ea5e9'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-3 mt-2 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-purple-500" /> Weekend</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-sky-500" /> Weekday</span>
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={13} className="text-sky-400" />
                  <h3 className="text-sm font-display font-semibold text-slate-200">30-Day Trend</h3>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={stats.byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} interval={6} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak time insight cards */}
            <div className="grid grid-cols-2 gap-3">
              {(() => {
                const peakHour  = stats.byHour.indexOf(Math.max(...stats.byHour))
                const peakCount = stats.byHour[peakHour]
                const peakDow   = stats.byDayOfWeek.indexOf(Math.max(...stats.byDayOfWeek))
                return (
                  <>
                    <div className="glass rounded-xl p-4">
                      <div className="text-[10px] font-mono text-slate-600 uppercase mb-1">Peak hour</div>
                      <div className="text-2xl font-display font-bold text-amber-400">{String(peakHour).padStart(2,'0')}:00</div>
                      <div className="text-xs text-slate-500 mt-1">{peakCount} incidents historically · {Math.round(peakCount / stats.total * 100)}% of total</div>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-[10px] font-mono text-slate-600 uppercase mb-1">Peak day</div>
                      <div className="text-2xl font-display font-bold text-purple-400">{DAY_NAMES[peakDow]}</div>
                      <div className="text-xs text-slate-500 mt-1">{stats.byDayOfWeek[peakDow]} incidents · {Math.round(stats.byDayOfWeek[peakDow] / stats.total * 100)}% of total</div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* ── INCIDENTS TABLE TAB ── */}
        {activeTab === 'incidents' && (
          <div className="flex-1 overflow-hidden flex flex-col" style={{ minHeight: 0 }}>
            <IncidentTable />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared KPI card ────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, color, bg, sub }: {
  label: string; value: string | number; icon: React.ReactNode
  color: string; bg: string; sub?: string
}) {
  return (
    <div className="glass rounded-xl p-4 stat-card">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', bg)}>
        <span className={color}>{icon}</span>
      </div>
      <div className={cn('text-2xl font-display font-bold', color)}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  )
}
