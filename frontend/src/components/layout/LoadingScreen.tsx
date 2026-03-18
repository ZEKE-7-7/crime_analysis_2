// src/components/layout/LoadingScreen.tsx
// Full-screen loading state shown during the initial API fetch.
// Replaced the old upload view as the app entry point before data arrives.

import { AlertCircle, RefreshCw, Wifi } from 'lucide-react'

interface Props {
  isError?:  boolean
  error?:    Error | null
  onRetry?:  () => void
}

export function LoadingScreen({ isError, error, onRetry }: Props) {
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#080c14] gap-6">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(239,68,68,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.8) 1px,transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 text-center space-y-5 max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto">
            <Wifi size={28} className="text-red-400" />
          </div>

          <div>
            <h2 className="text-xl font-display font-bold text-white">Cannot reach API</h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              The crime data API is unavailable. Make sure the backend server is running
              and accessible at the configured endpoint.
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20 text-left">
              <div className="text-[10px] font-mono text-red-500 uppercase tracking-wider mb-1">Error details</div>
              <div className="text-xs text-red-400 font-mono break-all">{error.message}</div>
            </div>
          )}

          <div className="space-y-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-400 font-medium text-sm hover:bg-sky-500/20 transition-all"
              >
                <RefreshCw size={15} />
                Retry Connection
              </button>
            )}

            <div className="text-[11px] text-slate-600 font-mono">
              Default endpoint: {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'}/crimes
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#080c14] gap-8">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(14,165,233,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,0.8) 1px,transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Animated rings */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-sky-500/15 animate-ping" />
          <div className="absolute inset-2 rounded-full border-2 border-sky-400/25 animate-ping"
            style={{ animationDelay: '0.2s' }} />
          <div className="absolute inset-0 rounded-full border-2 border-transparent"
            style={{ borderTopColor: '#0ea5e9', animation: 'spin 1s linear infinite' }} />
          <div className="absolute inset-3 rounded-full bg-sky-500/10 flex items-center justify-center">
            <AlertCircle size={16} className="text-sky-400" />
          </div>
        </div>

        <div className="text-center space-y-1">
          <div className="font-display font-bold text-white text-lg tracking-wide">
            CrimeOps
          </div>
          <div className="font-mono text-xs text-sky-400 tracking-widest uppercase animate-pulse">
            Connecting to API…
          </div>
        </div>

        {/* Loading steps */}
        <div className="space-y-2">
          {[
            'Fetching crime incidents',
            'Running DBSCAN hotspot detection',
            'Generating AI insights',
          ].map((step, i) => (
            <div key={step}
              className="flex items-center gap-2 text-xs text-slate-500 font-mono"
              style={{ animationDelay: `${i * 0.3}s` }}>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500/50 animate-pulse"
                style={{ animationDelay: `${i * 0.4}s` }} />
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
