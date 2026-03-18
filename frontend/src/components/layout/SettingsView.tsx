// src/components/layout/SettingsView.tsx
import { useState } from 'react'
import { Database, Map, Shield, Activity, Download, RefreshCw, FileText, Server, Wifi } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useCrimesData } from '@/hooks/useCrimesData'
import { API_BASE_URL } from '@/services/api'
import { toast } from 'sonner'
import { format } from 'date-fns'

export function SettingsView() {
  const { stats, incidents, hotspots, insights, runAnalysis } = useAppStore()
  const { isFetching, isError, dataUpdatedAt, invalidate } = useCrimesData()
  const [confirmReanalyse, setConfirmReanalyse] = useState(false)

  const exportIncidentsCSV = () => {
    if (incidents.length === 0) { toast.error('No data to export'); return }
    const rows = ['ID,Type,Lat,Lng,DateTime,Status,Severity,Location,Description']
    incidents.forEach(i => {
      rows.push([
        i.id, i.type, i.lat, i.lng,
        i.dateTime.toISOString(), i.status, i.severity,
        `"${i.location}"`, `"${i.description}"`,
      ].join(','))
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
    a.download = `crimeops_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
    a.click()
    toast.success('Incidents exported to CSV')
  }

  const exportInsightsJSON = () => {
    if (insights.length === 0) { toast.error('No insights to export'); return }
    const data = JSON.stringify({ generated: new Date(), hotspots, insights }, null, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    a.download = `crimeops_insights_${format(new Date(), 'yyyyMMdd_HHmm')}.json`
    a.click()
    toast.success('Insights exported to JSON')
  }

  const handleReanalyse = () => {
    if (!confirmReanalyse) {
      setConfirmReanalyse(true)
      setTimeout(() => setConfirmReanalyse(false), 4000)
      return
    }
    runAnalysis()
    setConfirmReanalyse(false)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5 max-w-2xl">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Settings</h2>
          <p className="text-sm text-slate-500 mt-1">System configuration and data management</p>
        </div>

        {/* API Connection */}
        <Section icon={<Server size={14} />} title="API Connection">
          <Row label="Endpoint"       value={`${API_BASE_URL}/crimes`} />
          <Row label="Status"         value={isError ? 'Error — cannot reach API' : isFetching ? 'Fetching…' : 'Connected'} />
          <Row label="Last Updated"   value={dataUpdatedAt ? format(new Date(dataUpdatedAt), 'dd MMM yyyy, HH:mm:ss') : '—'} />
          <Row label="Records Loaded" value={incidents.length > 0 ? `${incidents.length} incidents` : '—'} />

          <div className="pt-2">
            <button
              onClick={() => { invalidate(); toast.info('Refreshing data from API…') }}
              disabled={isFetching}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm hover:bg-sky-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              {isFetching ? 'Refreshing…' : 'Refresh Data'}
            </button>
          </div>
        </Section>

        {/* Data summary */}
        <Section icon={<Database size={14} />} title="Current Data">
          <Row label="Source"          value="Backend API" />
          {stats && <>
            <Row label="Open Rate"       value={`${Math.round((stats.open / stats.total) * 100)}%`} />
            <Row label="Resolution Rate" value={`${Math.round(stats.resolutionRate)}%`} />
            <Row label="Avg Severity"    value={`${stats.averageSeverity.toFixed(1)}/10`} />
          </>}
        </Section>

        {/* Analysis */}
        <Section icon={<Activity size={14} />} title="Analysis Results">
          <Row label="Hotspots"          value={hotspots.length > 0 ? `${hotspots.length} clusters` : '—'} />
          <Row label="AI Insights"       value={insights.length > 0 ? `${insights.length} (${insights.filter(i => i.severity === 'CRITICAL').length} critical)` : '—'} />
          <Row label="Hotspot Algorithm" value="DBSCAN (ε=600m, minPts=4)" />
          <Row label="Prediction Model"  value="Exponential Smoothing α=0.3" />
        </Section>

        {/* Map */}
        <Section icon={<Map size={14} />} title="Map Configuration">
          <Row label="Basemap"           value="CartoDB Dark Matter" />
          <Row label="Heatmap Gradient"  value="Navy → Green → Amber → Red" />
          <Row label="Cluster Radius"    value="45px" />
          <Row label="DBSCAN Radius"     value="600m" />
        </Section>

        {/* System */}
        <Section icon={<Shield size={14} />} title="System">
          <Row label="Version"    value="3.0.0" />
          <Row label="Data Flow"  value="API → React Query → Zustand → Components" />
          <Row label="Map"        value="Leaflet 1.9.4 + CartoDB Dark" />
          <Row label="Charts"     value="Recharts 2.x" />
        </Section>

        {/* Export */}
        <Section icon={<Download size={14} />} title="Export">
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={exportIncidentsCSV}
              disabled={incidents.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm hover:bg-sky-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileText size={13} /> Export Incidents CSV
            </button>
            <button
              onClick={exportInsightsJSON}
              disabled={insights.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={13} /> Export Insights JSON
            </button>
          </div>
        </Section>

        {/* Re-analyse */}
        <Section icon={<RefreshCw size={14} />} title="Actions">
          <p className="text-xs text-slate-500 mb-2">
            Re-run the AI analysis pipeline on the currently loaded data without re-fetching from the API.
          </p>
          <button
            onClick={handleReanalyse}
            disabled={incidents.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              confirmReanalyse
                ? 'bg-amber-500/25 border border-amber-500/50 text-amber-300 animate-pulse'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            <RefreshCw size={13} />
            {confirmReanalyse ? 'Click again to confirm' : 'Re-run Analysis'}
          </button>
        </Section>
      </div>
    </div>
  )
}

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/[0.05]">
        <span className="text-sky-400">{icon}</span>
        <h3 className="text-sm font-display font-semibold text-slate-200">{title}</h3>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-300 font-mono text-right max-w-xs truncate">{value}</span>
    </div>
  )
}
