import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'

interface Props {
  onHourChange: (hour: number | null) => void
}

const RISK_COLORS = ['#10b981','#10b981','#10b981','#f59e0b','#10b981','#10b981','#10b981','#10b981',
  '#10b981','#10b981','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#f59e0b','#f59e0b',
  '#f59e0b','#f97316','#f97316','#ef4444','#ef4444','#ef4444','#f97316','#f97316']

export function TimeScrubber({ onHourChange }: Props) {
  const { stats } = useAppStore()
  const [hour, setHour]         = useState<number | null>(null)
  const [playing, setPlaying]   = useState(false)
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null)

  const maxCount = stats ? Math.max(...stats.byHour, 1) : 1

  const setHourAndNotify = useCallback((h: number | null) => {
    setHour(h)
    onHourChange(h)
  }, [onHourChange])

  // Playback loop
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setHour(prev => {
          const next = prev === null ? 0 : (prev + 1) % 24
          onHourChange(next)
          if (next === 23) setPlaying(false)
          return next
        })
      }, 380)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, onHourChange])

  const reset = () => { setPlaying(false); setHourAndNotify(null) }

  const hourLabel = hour !== null ? `${String(hour).padStart(2, '0')}:00` : 'All hours'
  const barColor  = hour !== null ? RISK_COLORS[hour] : '#0ea5e9'

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000]"
      style={{ width: 'min(460px, calc(100vw - 200px))' }}>
      <div className="glass rounded-xl px-4 py-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock size={11} className="text-sky-400" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Time Filter</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold" style={{ color: barColor, minWidth: 48 }}>
              {hourLabel}
            </span>
            {stats && hour !== null && (
              <span className="text-[10px] text-slate-500">
                {stats.byHour[hour]} incidents ±2h
              </span>
            )}
          </div>
        </div>

        {/* Mini bar chart preview */}
        {stats && (
          <div className="flex items-end gap-0.5 h-6 mb-2">
            {stats.byHour.map((count, h) => {
              const heightPct = (count / maxCount) * 100
              const isActive = hour === null || Math.abs(h - (hour ?? 0)) <= 2
              return (
                <div
                  key={h}
                  className="flex-1 rounded-sm cursor-pointer transition-all duration-100"
                  style={{
                    height: `${Math.max(8, heightPct)}%`,
                    background: h === hour ? RISK_COLORS[h] : isActive && hour !== null ? `${RISK_COLORS[h]}60` : 'rgba(255,255,255,0.1)',
                  }}
                  onClick={() => setHourAndNotify(h === hour ? null : h)}
                  title={`${String(h).padStart(2, '0')}:00 — ${count} incidents`}
                />
              )
            })}
          </div>
        )}

        {/* Slider + controls */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0} max={23} step={1}
            value={hour ?? 12}
            onChange={e => setHourAndNotify(parseInt(e.target.value))}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: barColor }}
            aria-label="Hour filter"
          />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPlaying(p => !p)}
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                playing
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                  : 'bg-sky-500/15 border border-sky-500/25 text-sky-400 hover:bg-sky-500/25'
              )}
              aria-label={playing ? 'Pause' : 'Play animation'}
            >
              {playing ? <Pause size={11} /> : <Play size={11} />}
            </button>

            {hour !== null && (
              <button
                onClick={reset}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-all"
                aria-label="Reset time filter"
              >
                <RotateCcw size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Hour labels */}
        <div className="flex justify-between mt-1">
          {['00','06','12','18','23'].map(h => (
            <span key={h} className="text-[9px] font-mono text-slate-600">{h}:00</span>
          ))}
        </div>
      </div>
    </div>
  )
}
