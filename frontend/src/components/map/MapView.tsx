import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import L from 'leaflet'
import { useAppStore } from '@/store/appStore'
import { CrimeIncident, CrimeType, PatrolUnit, HotspotCluster, PredictionZone } from '@/types'
import { MapControls } from './MapControls'
import { HotspotPanel } from './HotspotPanel'
import { TimeScrubber } from './TimeScrubber'
import { format } from 'date-fns'

// ── Color palettes ─────────────────────────────────────────────────────────
export const CRIME_COLORS: Record<CrimeType, string> = {
  'Theft':        '#f59e0b',
  'Assault':      '#ef4444',
  'Robbery':      '#f97316',
  'Burglary':     '#8b5cf6',
  'Vandalism':    '#06b6d4',
  'Drug Offense': '#10b981',
  'Fraud':        '#3b82f6',
  'Other':        '#6b7280',
}

const PATROL_COLORS: Record<string, string> = {
  'Active':     '#10b981',
  'Responding': '#f59e0b',
  'Off Duty':   '#6b7280',
  'Standby':    '#3b82f6',
}

export const RISK_COLOR = (score: number): string => {
  if (score >= 75) return '#ef4444'
  if (score >= 55) return '#f97316'
  if (score >= 35) return '#f59e0b'
  return '#10b981'
}

// ── Icon factories ─────────────────────────────────────────────────────────
function crimeIcon(type: CrimeType, status: string) {
  const color = CRIME_COLORS[type]
  const opacity = status === 'Closed' ? 0.35 : 1
  return L.divIcon({
    className: '',
    html: `<div style="width:9px;height:9px;background:${color};opacity:${opacity};border-radius:50%;border:1.5px solid rgba(255,255,255,0.5);box-shadow:0 0 6px ${color}90;"></div>`,
    iconSize: [9, 9], iconAnchor: [4, 4],
  })
}

function patrolIcon(unit: PatrolUnit) {
  const color = PATROL_COLORS[unit.status]
  const ring = unit.isAIDeployed
    ? `box-shadow:0 0 0 3px ${color}40,0 0 12px ${color};`
    : `box-shadow:0 0 10px ${color}60;`
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:2.5px solid rgba(255,255,255,0.8);${ring}position:relative;">
      ${unit.isAIDeployed ? `<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:8px;color:#0ea5e9;white-space:nowrap;">AI</div>` : ''}
    </div>`,
    iconSize: [16, 16], iconAnchor: [8, 8],
  })
}

function hotspotIcon(hs: HotspotCluster) {
  const color = RISK_COLOR(hs.riskScore)
  const size = Math.max(22, Math.min(42, 22 + hs.incidentCount * 0.8))
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color}22;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;color:${color};box-shadow:0 0 16px ${color}50;">${hs.incidentCount}</div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2],
  })
}

function predictionIcon(zone: PredictionZone) {
  const color = zone.riskScore > 75 ? '#ef4444' : zone.riskScore > 55 ? '#f97316' : '#f59e0b'
  return L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:${color}18;border:1.5px dashed ${color};display:flex;align-items:center;justify-content:center;font-size:10px;color:${color};">⚡</div>`,
    iconSize: [20, 20], iconAnchor: [10, 10],
  })
}

// ── Main component ─────────────────────────────────────────────────────────
export function MapView() {
  const {
    displayIncidents, patrolUnits, hotspots, predictionZones,
    mapMode, activeHotspot, setActiveHotspot,
  } = useAppStore()

  const mapRef       = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Track each layer by key — always replace, never accumulate
  const layersRef    = useRef<Record<string, L.Layer | null>>({
    heatmap: null, clusters: null, hotspotLayer: null, patrolLayer: null, predictionLayer: null,
  })
  // Track previous patrol positions for animated route lines
  const prevPatrolPosRef = useRef<Record<string, [number, number]>>({})

  const [filterType, setFilterType]       = useState<CrimeType | 'All'>('All')
  const [showPatrols, setShowPatrols]     = useState(true)
  const [timeSliceHour, setTimeSliceHour] = useState<number | null>(null)

  // Derive filtered incidents (type filter + optional hour slice)
  const filtered = useMemo(() => {
    let base = filterType === 'All' ? displayIncidents : displayIncidents.filter(i => i.type === filterType)
    if (timeSliceHour !== null) {
      base = base.filter(i => Math.abs(i.dateTime.getHours() - timeSliceHour) <= 2)
    }
    return base
  }, [displayIncidents, filterType, timeSliceHour])

  // ── Remove a named layer safely ────────────────────────────────────────
  const removeLayer = useCallback((key: string) => {
    const map = mapRef.current
    const layer = layersRef.current[key]
    if (layer && map) {
      try { map.removeLayer(layer) } catch { /* already removed */ }
    }
    layersRef.current[key] = null
  }, [])

  // ── Initialise Leaflet map ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [51.505, -0.09], zoom: 11,
      zoomControl: false, attributionControl: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── Re-render data layers when mode / filter / data changes ───────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear all data layers (not patrol — handled separately)
    ;['heatmap', 'clusters', 'hotspotLayer', 'predictionLayer'].forEach(removeLayer)

    if (displayIncidents.length === 0 && hotspots.length === 0 && predictionZones.length === 0) return

    // ── HEATMAP mode ────────────────────────────────────────────────────
    if (mapMode === 'heatmap') {
      if (typeof (L as any).heatLayer === 'function') {
        const heatData = filtered.map(i => [i.lat, i.lng, i.severity / 10] as [number, number, number])
        const heat = (L as any).heatLayer(heatData, {
          radius: 28, blur: 22, maxZoom: 17, max: 1.0, minOpacity: 0.2,
          gradient: {
            0.00: '#0c1a3d',
            0.20: '#22c55e',
            0.45: '#f59e0b',
            0.65: '#f97316',
            0.85: '#ef4444',
            1.00: '#7f1d1d',
          },
        })
        heat.addTo(map)
        layersRef.current.heatmap = heat
      }

      if (filtered.length > 0) {
        const bounds = L.latLngBounds(filtered.map(i => [i.lat, i.lng]))
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
      }
    }

    // ── INCIDENTS mode (clustered markers) ──────────────────────────────
    if (mapMode === 'incidents') {
      let clusterGroup: L.FeatureGroup
      if (typeof (L as any).markerClusterGroup === 'function') {
        clusterGroup = (L as any).markerClusterGroup({
          maxClusterRadius: 45,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          iconCreateFunction: (cluster: any) => {
            const count = cluster.getChildCount()
            const border = count > 20 ? '#ef4444' : count > 10 ? '#f97316' : '#f59e0b'
            return L.divIcon({
              html: `<div style="width:34px;height:34px;border-radius:50%;background:${border}20;border:1.5px solid ${border};display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${border};">${count}</div>`,
              className: '', iconSize: [34, 34], iconAnchor: [17, 17],
            })
          },
        })
      } else {
        clusterGroup = L.featureGroup()
      }

      filtered.forEach(inc => {
        const m = L.marker([inc.lat, inc.lng], { icon: crimeIcon(inc.type, inc.status) })
        m.bindPopup(incidentPopupHTML(inc), { className: 'dark-popup', maxWidth: 260 })
        clusterGroup.addLayer(m)
      })
      clusterGroup.addTo(map)
      layersRef.current.clusters = clusterGroup

      if (filtered.length > 0) {
        const bounds = L.latLngBounds(filtered.map(i => [i.lat, i.lng]))
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
      }
    }

    // ── HOTSPOTS mode ────────────────────────────────────────────────────
    if (mapMode === 'hotspots') {
      const group = L.layerGroup()

      hotspots.forEach(hs => {
        const color = RISK_COLOR(hs.riskScore)

        // Outer pulse ring for critical hotspots
        if (hs.riskScore >= 75) {
          const pulse = L.circle([hs.centroidLat, hs.centroidLng], {
            radius: hs.radius * 1.5,
            fillOpacity: 0, color: '#ef4444',
            weight: 1, dashArray: '5,8', opacity: 0.35,
          })
          group.addLayer(pulse)
        }

        // Risk zone fill circle
        const circle = L.circle([hs.centroidLat, hs.centroidLng], {
          radius: hs.radius,
          fillColor: color, fillOpacity: 0.1,
          color, weight: 1.5,
          dashArray: hs.riskScore < 50 ? '6,4' : undefined,
        })
        circle.bindPopup(hotspotPopupHTML(hs), { className: 'dark-popup', maxWidth: 280 })
        group.addLayer(circle)

        // Centroid icon marker
        const m = L.marker([hs.centroidLat, hs.centroidLng], { icon: hotspotIcon(hs) })
        m.bindPopup(hotspotPopupHTML(hs), { className: 'dark-popup', maxWidth: 280 })
        m.on('click', () => setActiveHotspot(hs.id === activeHotspot ? null : hs.id))
        group.addLayer(m)
      })

      group.addTo(map)
      layersRef.current.hotspotLayer = group

      if (hotspots.length > 0) {
        const bounds = L.latLngBounds(hotspots.map(h => [h.centroidLat, h.centroidLng]))
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 13 })
      }
    }

    // ── PREDICTION mode ──────────────────────────────────────────────────
    if (mapMode === 'prediction') {
      const group = L.layerGroup()

      predictionZones.forEach(zone => {
        const color = zone.riskScore > 75 ? '#ef4444' : zone.riskScore > 55 ? '#f97316' : '#f59e0b'

        const circle = L.circle([zone.lat, zone.lng], {
          radius: 750,
          fillColor: color, fillOpacity: 0.07,
          color, weight: 1, dashArray: '6,4',
        })
        group.addLayer(circle)

        const m = L.marker([zone.lat, zone.lng], { icon: predictionIcon(zone) })
        m.bindPopup(predictionPopupHTML(zone), { className: 'dark-popup', maxWidth: 260 })
        group.addLayer(m)
      })

      group.addTo(map)
      layersRef.current.predictionLayer = group

      if (predictionZones.length > 0) {
        const bounds = L.latLngBounds(predictionZones.map(z => [z.lat, z.lng]))
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 13 })
      }
    }

    // ── PATROL mode — show heatmap + all patrol detail ───────────────────
    if (mapMode === 'patrol') {
      if (typeof (L as any).heatLayer === 'function' && filtered.length > 0) {
        const heatData = filtered.map(i => [i.lat, i.lng, i.severity / 10] as [number, number, number])
        const heat = (L as any).heatLayer(heatData, {
          radius: 24, blur: 18, maxZoom: 17, max: 1.0, minOpacity: 0.1,
          gradient: { 0.2: '#22c55e', 0.5: '#f59e0b', 0.8: '#ef4444', 1.0: '#7f1d1d' },
        })
        heat.addTo(map)
        layersRef.current.heatmap = heat
      }
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayIncidents, filtered, hotspots, predictionZones, mapMode, removeLayer])

  // ── Patrol layer — independent, re-renders when patrolUnits changes ───
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    removeLayer('patrolLayer')

    const group = L.layerGroup()
    const showAll = mapMode === 'patrol'

    patrolUnits.forEach(unit => {
      if (unit.status === 'Off Duty' && !showAll) return

      // Animated route polyline for AI-deployed units that moved
      const prev = prevPatrolPosRef.current[unit.id]
      if (unit.isAIDeployed && prev) {
        const [pLat, pLng] = prev
        if (pLat !== unit.lat || pLng !== unit.lng) {
          const route = L.polyline([[pLat, pLng], [unit.lat, unit.lng]], {
            color: '#0ea5e9', weight: 2, dashArray: '6,3', opacity: 0.6,
          })
          group.addLayer(route)
          // Fade route after 6s
          setTimeout(() => {
            try { if (map.hasLayer(group)) group.removeLayer(route) } catch { /* ok */ }
          }, 6000)
        }
      }

      // Store current position for next diff
      prevPatrolPosRef.current[unit.id] = [unit.lat, unit.lng]

      if (!showPatrols) return

      const m = L.marker([unit.lat, unit.lng], { icon: patrolIcon(unit) })
      m.bindPopup(patrolPopupHTML(unit), { className: 'dark-popup', maxWidth: 240 })
      group.addLayer(m)
    })

    group.addTo(map)
    layersRef.current.patrolLayer = group

  }, [patrolUnits, showPatrols, mapMode, removeLayer])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <style>{MAP_STYLES}</style>
      <div ref={containerRef} className="absolute inset-0 z-0" />

      <MapControls
        filterType={filterType}
        showPatrols={showPatrols}
        onFilterType={setFilterType}
        onTogglePatrols={() => setShowPatrols(v => !v)}
        incidentCount={filtered.length}
      />

      {/* Hotspot drill-down panel */}
      {activeHotspot && <HotspotPanel />}

      {/* Time-of-day scrubber — only in heatmap mode */}
      {mapMode === 'heatmap' && (
        <TimeScrubber onHourChange={setTimeSliceHour} />
      )}
    </div>
  )
}

// ── Popup HTML builders ────────────────────────────────────────────────────
function incidentPopupHTML(inc: CrimeIncident) {
  const color = CRIME_COLORS[inc.type]
  const sColor = inc.status === 'Open' ? '#f87171' : inc.status === 'Closed' ? '#34d399' : '#fbbf24'
  return `<div style="font-family:'DM Sans',sans-serif;min-width:220px;color:#e2e8f0;background:#0f172a;">
    <div style="background:${color}18;border-bottom:1px solid ${color}30;padding:10px 12px;">
      <div style="color:${color};font-weight:700;font-size:13px;">${inc.type}</div>
      <div style="color:#94a3b8;font-size:10px;font-family:'JetBrains Mono',monospace;">${inc.id}</div>
    </div>
    <div style="padding:10px 12px;font-size:12px;">
      <div style="margin-bottom:5px;color:#cbd5e1;">${inc.description}</div>
      <div style="color:#64748b;font-size:11px;">📍 ${inc.location}</div>
      <div style="color:#64748b;font-size:11px;margin-top:3px;">🕐 ${format(inc.dateTime, 'dd MMM yyyy, HH:mm')}</div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:6px;">
        <span style="font-size:10px;padding:2px 9px;border-radius:10px;background:${sColor}20;color:${sColor};border:1px solid ${sColor}35;">${inc.status}</span>
        <span style="font-size:10px;color:#475569;">Severity ${inc.severity}/10</span>
      </div>
    </div>
  </div>`
}

function hotspotPopupHTML(hs: HotspotCluster) {
  const color = RISK_COLOR(hs.riskScore)
  return `<div style="font-family:'DM Sans',sans-serif;min-width:240px;color:#e2e8f0;background:#0f172a;">
    <div style="background:${color}18;border-bottom:1px solid ${color}30;padding:10px 12px;">
      <div style="color:${color};font-weight:700;font-size:13px;">🔥 ${hs.label} Hotspot</div>
      <div style="color:#94a3b8;font-size:10px;font-family:'JetBrains Mono',monospace;">${hs.id}</div>
    </div>
    <div style="padding:10px 12px;font-size:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:9px;">
        <div><div style="color:#64748b;font-size:10px;text-transform:uppercase;">Risk Score</div><div style="color:${color};font-size:20px;font-weight:700;">${hs.riskScore}</div></div>
        <div><div style="color:#64748b;font-size:10px;text-transform:uppercase;">Incidents</div><div style="color:#e2e8f0;font-size:20px;font-weight:700;">${hs.incidentCount}</div></div>
      </div>
      <div style="color:#64748b;font-size:11px;">Dominant: <span style="color:#e2e8f0;">${hs.dominantType}</span></div>
      <div style="color:#64748b;font-size:11px;margin-top:3px;">Patrols needed: <span style="color:#f59e0b;">${hs.recommendedPatrols}</span></div>
      <div style="color:#475569;font-size:11px;margin-top:3px;">Radius: ${Math.round(hs.radius)}m</div>
      <div style="margin-top:8px;font-size:10px;color:#0ea5e9;">Click marker to open detail panel →</div>
    </div>
  </div>`
}

function patrolPopupHTML(unit: PatrolUnit) {
  const color = PATROL_COLORS[unit.status]
  return `<div style="font-family:'DM Sans',sans-serif;min-width:200px;color:#e2e8f0;background:#0f172a;">
    <div style="background:${color}18;border-bottom:1px solid ${color}30;padding:10px 12px;">
      <div style="color:${color};font-weight:700;font-size:13px;">🚔 ${unit.name}</div>
      ${unit.isAIDeployed ? `<div style="color:#0ea5e9;font-size:10px;margin-top:2px;">★ AI Deployed</div>` : ''}
    </div>
    <div style="padding:10px 12px;font-size:12px;">
      <div style="color:#64748b;font-size:11px;">Status: <span style="color:${color};">${unit.status}</span></div>
      ${unit.assignedZone ? `<div style="color:#64748b;font-size:11px;margin-top:3px;">Zone: <span style="color:#e2e8f0;">${unit.assignedZone}</span></div>` : ''}
      <div style="color:#64748b;font-size:11px;margin-top:3px;">Officers: ${unit.officerCount}</div>
    </div>
  </div>`
}

function predictionPopupHTML(zone: PredictionZone) {
  const color = zone.riskScore > 75 ? '#ef4444' : zone.riskScore > 55 ? '#f97316' : '#f59e0b'
  return `<div style="font-family:'DM Sans',sans-serif;min-width:220px;color:#e2e8f0;background:#0f172a;">
    <div style="background:${color}18;border-bottom:1px solid ${color}30;padding:10px 12px;">
      <div style="color:${color};font-weight:700;font-size:13px;">⚡ Forecast: ${zone.location}</div>
    </div>
    <div style="padding:10px 12px;font-size:12px;">
      <div style="color:#64748b;font-size:11px;">Next peak: <span style="color:#e2e8f0;">${zone.nextPeakHour}:00</span></div>
      <div style="color:#64748b;font-size:11px;margin-top:3px;">Predicted: <span style="color:#f59e0b;">${zone.predictedIncidents} incidents/day</span></div>
      <div style="color:#64748b;font-size:11px;margin-top:3px;">Risk score: <span style="color:${color};">${zone.riskScore}/100</span></div>
    </div>
  </div>`
}

// ── Leaflet dark theme overrides ───────────────────────────────────────────
const MAP_STYLES = `
  .dark-popup .leaflet-popup-content-wrapper {
    background:#0f172a;border:1px solid rgba(255,255,255,0.08);border-radius:10px;
    padding:0;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.7);
  }
  .dark-popup .leaflet-popup-tip { background:#0f172a; }
  .dark-popup .leaflet-popup-content { margin:0;color:#e2e8f0; }
  .dark-popup .leaflet-popup-close-button {
    color:#64748b!important;top:7px!important;right:8px!important;font-size:16px!important;
  }
  .leaflet-control-zoom { border:none!important; }
  .leaflet-control-zoom a {
    background:rgba(15,23,42,0.92)!important;color:#94a3b8!important;
    border:1px solid rgba(255,255,255,0.1)!important;margin-bottom:2px!important;
    border-radius:6px!important;width:28px!important;height:28px!important;
    line-height:28px!important;
  }
  .leaflet-control-zoom a:hover {
    background:rgba(30,41,59,0.95)!important;color:#e2e8f0!important;
  }
`
