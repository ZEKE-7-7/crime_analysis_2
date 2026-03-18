// src/App.tsx
import { Toaster } from 'sonner'
import { useAppStore } from '@/store/appStore'
import { useCrimesData } from '@/hooks/useCrimesData'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { MapView } from '@/components/map/MapView'
import { StatsView } from '@/components/stats/StatsView'
import { InsightsView } from '@/components/insights/InsightsView'
import { SettingsView } from '@/components/layout/SettingsView'
import { LoadingScreen } from '@/components/layout/LoadingScreen'

export default function App() {
  const { view, isAnalysing } = useAppStore()

  // Fetch data on mount — feeds Zustand automatically via useCrimesData
  const { isLoading, isError, error, refetch } = useCrimesData()

  // ── Full-screen loading on first fetch ──────────────────────────────────
  if (isLoading) {
    return <LoadingScreen />
  }

  // ── Full-screen error if fetch failed completely ─────────────────────────
  if (isError) {
    return (
      <LoadingScreen
        isError
        error={error as Error}
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#080c14]">
      <Sidebar />

      <main className="flex-1 overflow-hidden relative">
        {/* Analysis-running overlay (not full-screen — data is still visible) */}
        {isAnalysing && (
          <div className="absolute inset-0 z-50 bg-[#080c14]/70 backdrop-blur-sm
                          flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-3">
              <div className="relative w-10 h-10 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-sky-500/20 animate-ping" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent"
                  style={{ borderTopColor: '#0ea5e9', animation: 'spin 0.8s linear infinite' }} />
              </div>
              <div className="font-mono text-[11px] text-sky-400 tracking-widest uppercase">
                Analysing…
              </div>
            </div>
          </div>
        )}

        {view === 'dashboard' && <DashboardView />}
        {view === 'map'       && <MapView />}
        {view === 'stats'     && <StatsView />}
        {view === 'insights'  && <InsightsView />}
        {view === 'settings'  && <SettingsView />}
      </main>

      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background:  'rgba(15,23,42,0.97)',
            border:      '1px solid rgba(255,255,255,0.1)',
            color:       '#e2e8f0',
            fontFamily:  'DM Sans, sans-serif',
            fontSize:    '13px',
          },
        }}
      />
    </div>
  )
}
