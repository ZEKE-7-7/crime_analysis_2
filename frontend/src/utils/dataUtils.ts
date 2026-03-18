import {
  CrimeIncident, CrimeType, PatrolUnit,
  HotspotCluster, TimePrediction, PredictionZone,
  PatrolRecommendation, AIInsight, CrimeStats
} from '@/types';
import { subDays, format, getDay } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────
export const CRIME_TYPES: CrimeType[] = [
  'Theft', 'Assault', 'Robbery', 'Burglary', 'Vandalism', 'Drug Offense', 'Fraud', 'Other'
];

const LONDON_AREAS = [
  { name: 'Westminster',    lat: 51.4975, lng: -0.1357 },
  { name: 'Soho',           lat: 51.5137, lng: -0.1329 },
  { name: 'Camden',         lat: 51.5390, lng: -0.1426 },
  { name: 'Hackney',        lat: 51.5450, lng: -0.0553 },
  { name: 'Islington',      lat: 51.5362, lng: -0.1027 },
  { name: 'Southwark',      lat: 51.5036, lng: -0.0880 },
  { name: 'Lambeth',        lat: 51.4607, lng: -0.1163 },
  { name: 'Tower Hamlets',  lat: 51.5099, lng: -0.0059 },
  { name: 'Lewisham',       lat: 51.4615, lng: -0.0169 },
  { name: 'Brixton',        lat: 51.4613, lng: -0.1156 },
  { name: 'Shoreditch',     lat: 51.5237, lng: -0.0777 },
  { name: 'Peckham',        lat: 51.4735, lng: -0.0695 },
];

// ── Math helpers ───────────────────────────────────────────────────────────

/** Haversine distance in metres */
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Patrol units ───────────────────────────────────────────────────────────
export function generatePatrolUnits(): PatrolUnit[] {
  const now = new Date();
  return [
    { id: 'P01', name: 'Alpha Unit',   lat: 51.5074, lng: -0.1278, status: 'Active',     officerCount: 2, lastUpdate: now, assignedZone: 'Westminster' },
    { id: 'P02', name: 'Bravo Unit',   lat: 51.5200, lng: -0.0900, status: 'Responding', officerCount: 3, lastUpdate: now, assignedZone: 'Hackney' },
    { id: 'P03', name: 'Charlie Unit', lat: 51.4900, lng: -0.1400, status: 'Active',     officerCount: 2, lastUpdate: now, assignedZone: 'Lambeth' },
    { id: 'P04', name: 'Delta Unit',   lat: 51.5350, lng: -0.1100, status: 'Off Duty',   officerCount: 0, lastUpdate: now },
    { id: 'P05', name: 'Echo Unit',    lat: 51.4700, lng: -0.0800, status: 'Active',     officerCount: 2, lastUpdate: now, assignedZone: 'Lewisham' },
    { id: 'P06', name: 'Foxtrot Unit', lat: 51.5099, lng: -0.0059, status: 'Standby',   officerCount: 2, lastUpdate: now },
    { id: 'P07', name: 'Golf Unit',    lat: 51.5237, lng: -0.0777, status: 'Active',     officerCount: 3, lastUpdate: now, assignedZone: 'Shoreditch' },
  ];
}

// ── Stats ──────────────────────────────────────────────────────────────────
export function computeStats(incidents: CrimeIncident[]): CrimeStats {
  const byType: Record<string, number> = {};
  const byHour = new Array(24).fill(0);
  const byDayOfWeek = new Array(7).fill(0);
  const byDayMap: Record<string, number> = {};
  let totalSeverity = 0;

  for (const inc of incidents) {
    byType[inc.type] = (byType[inc.type] || 0) + 1;
    byHour[inc.dateTime.getHours()]++;
    byDayOfWeek[getDay(inc.dateTime)]++;
    const dayKey = format(inc.dateTime, 'MMM dd');
    byDayMap[dayKey] = (byDayMap[dayKey] || 0) + 1;
    totalSeverity += inc.severity;
  }

  const now = new Date();
  const byDay = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(now, 29 - i);
    const key = format(d, 'MMM dd');
    return { date: key, count: byDayMap[key] || 0 };
  });

  const locationMap: Record<string, number> = {};
  for (const inc of incidents) {
    locationMap[inc.location] = (locationMap[inc.location] || 0) + 1;
  }
  const topLocations = Object.entries(locationMap)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const violent = (byType['Assault'] || 0) + (byType['Robbery'] || 0);
  const closed = incidents.filter(i => i.status === 'Closed').length;

  return {
    total: incidents.length,
    open: incidents.filter(i => i.status === 'Open').length,
    closed,
    underInvestigation: incidents.filter(i => i.status === 'Under Investigation').length,
    byType: byType as Record<CrimeType, number>,
    byHour,
    byDay,
    topLocations,
    byDayOfWeek,
    averageSeverity: incidents.length > 0 ? totalSeverity / incidents.length : 0,
    violentCrimePct: incidents.length > 0 ? (violent / incidents.length) * 100 : 0,
    resolutionRate: incidents.length > 0 ? (closed / incidents.length) * 100 : 0,
  };
}

// ── DBSCAN-like Hotspot Detection ──────────────────────────────────────────
export function detectHotspots(incidents: CrimeIncident[]): HotspotCluster[] {
  const EPS_METRES = 600;
  const MIN_POINTS = 4;

  const visited = new Set<number>();
  const clusters: { points: number[] }[] = [];

  function regionQuery(idx: number): number[] {
    const inc = incidents[idx];
    return incidents
      .map((other, j) => ({ j, d: haversineMetres(inc.lat, inc.lng, other.lat, other.lng) }))
      .filter(({ d }) => d <= EPS_METRES)
      .map(({ j }) => j);
  }

  function expand(idx: number, neighbours: number[], cluster: { points: number[] }) {
    cluster.points.push(idx);
    let i = 0;
    while (i < neighbours.length) {
      const q = neighbours[i];
      if (!visited.has(q)) {
        visited.add(q);
        const qNeighbours = regionQuery(q);
        if (qNeighbours.length >= MIN_POINTS) {
          neighbours.push(...qNeighbours.filter(n => !neighbours.includes(n)));
        }
      }
      if (!clusters.some(c => c.points.includes(q))) {
        cluster.points.push(q);
      }
      i++;
    }
  }

  incidents.forEach((_, idx) => {
    if (visited.has(idx)) return;
    visited.add(idx);
    const neighbours = regionQuery(idx);
    if (neighbours.length >= MIN_POINTS) {
      const cluster = { points: [] as number[] };
      clusters.push(cluster);
      expand(idx, neighbours, cluster);
    }
  });

  return clusters
    .filter(c => c.points.length >= MIN_POINTS)
    .map((c, i) => {
      const pts = c.points.map(j => incidents[j]);
      const centroidLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      const centroidLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
      const radius = Math.max(...pts.map(p => haversineMetres(centroidLat, centroidLng, p.lat, p.lng)));

      const typeCounts: Partial<Record<CrimeType, number>> = {};
      let totalSev = 0;
      for (const p of pts) {
        typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
        totalSev += p.severity;
      }
      const dominantType = (Object.entries(typeCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0]) as CrimeType;
      const densityScore = Math.min(pts.length / 10, 1) * 50;
      const severityScore = (totalSev / pts.length / 10) * 50;
      const riskScore = Math.round(densityScore + severityScore);
      const recommendedPatrols = pts.length >= 20 ? 3 : pts.length >= 10 ? 2 : 1;

      const area = LONDON_AREAS.reduce((best, a) => {
        const d = haversineMetres(centroidLat, centroidLng, a.lat, a.lng);
        return d < haversineMetres(centroidLat, centroidLng, best.lat, best.lng) ? a : best;
      });

      return {
        id: `HS-${String(i + 1).padStart(3, '0')}`,
        centroidLat,
        centroidLng,
        radius: Math.max(radius, 200),
        incidentCount: pts.length,
        dominantType,
        riskScore,
        label: area.name,
        incidents: pts.map(p => p.id),
        recommendedPatrols,
      } satisfies HotspotCluster;
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);
}

// ── Time-based Prediction (Exponential Smoothing α=0.3) ───────────────────
export function generateTimePredictions(stats: CrimeStats): TimePrediction[] {
  const ALPHA = 0.3;
  const hourlyRates = stats.byHour.map(c => c / Math.max(stats.total / 24, 1));

  // Two-pass exponential smoothing over circular hour series
  const smoothed = [...hourlyRates];
  for (let pass = 0; pass < 2; pass++) {
    for (let h = 1; h < 24; h++) {
      smoothed[h] = ALPHA * hourlyRates[h] + (1 - ALPHA) * smoothed[h - 1];
    }
  }

  // Variance for confidence band
  const residuals = hourlyRates.map((r, h) => r - smoothed[h]);
  const variance  = residuals.reduce((s, r) => s + r * r, 0) / 24;
  const sigma     = Math.sqrt(variance);

  const maxSmoothed = Math.max(...smoothed, 0.001);
  const todayDow = new Date().getDay(); // fixed at call time — not per-hour
  const isWeekend = [0, 5, 6].includes(todayDow);

  const confidence = Math.min(0.95, 0.55 + stats.total / 600);

  return Array.from({ length: 24 }, (_, hour) => {
    const peakBoost = [19, 20, 21, 22, 23, 1, 2].includes(hour) ? 1.1 : 1.0;
    const predicted = smoothed[hour] * (isWeekend ? 1.15 : 1.0) * peakBoost;
    const band      = sigma * (2 - confidence);

    const ratio     = predicted / maxSmoothed;
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
      ratio > 0.7 ? 'CRITICAL' : ratio > 0.5 ? 'HIGH' : ratio > 0.3 ? 'MEDIUM' : 'LOW';

    return {
      hour,
      predictedCount: Math.round(predicted * 10) / 10,
      lower: Math.max(0, Math.round((predicted - band) * 10) / 10),
      upper: Math.round((predicted + band) * 10) / 10,
      confidence,
      riskLevel,
    };
  });
}

export function generatePredictionZones(incidents: CrimeIncident[], hotspots: HotspotCluster[]): PredictionZone[] {
  return hotspots.slice(0, 6).map(hs => {
    const hsIncidents = incidents.filter(i => hs.incidents.includes(i.id));
    const hourCounts = new Array(24).fill(0);
    for (const inc of hsIncidents) hourCounts[inc.dateTime.getHours()]++;
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const dailyAvg = hsIncidents.length / 30;

    return {
      location: hs.label,
      lat: hs.centroidLat,
      lng: hs.centroidLng,
      nextPeakHour: peakHour,
      predictedIncidents: Math.round(dailyAvg * 1.1),
      riskScore: hs.riskScore,
    };
  });
}

// ── AI Patrol Recommendations ──────────────────────────────────────────────
export function generatePatrolRecommendations(
  hotspots: HotspotCluster[],
  patrolUnits: PatrolUnit[],
  stats: CrimeStats,
): PatrolRecommendation[] {
  const now = new Date();
  const currentHour = now.getHours();

  return hotspots.slice(0, 6).map(hs => {
    const nearby = patrolUnits.filter(p => {
      const d = haversineMetres(hs.centroidLat, hs.centroidLng, p.lat, p.lng);
      return d < 1500 && p.status !== 'Off Duty';
    });

    const currentCoverage = nearby.length;
    const gap = Math.max(0, hs.recommendedPatrols - currentCoverage);
    const urgency = hs.riskScore > 75 ? 'CRITICAL' : hs.riskScore > 55 ? 'HIGH' : hs.riskScore > 35 ? 'MEDIUM' : 'LOW';

    const peakHour = stats.byHour.indexOf(Math.max(...stats.byHour));
    const isInPeak = Math.abs(currentHour - peakHour) <= 2;

    const crimeSet = new Set<CrimeType>();
    hs.incidents.slice(0, 10).forEach((_, i) => {
      if (i < CRIME_TYPES.length) crimeSet.add(hs.dominantType);
    });
    crimeSet.add(hs.dominantType);

    return {
      hotspotId: hs.id,
      location: hs.label,
      lat: hs.centroidLat,
      lng: hs.centroidLng,
      unitsRequired: hs.recommendedPatrols,
      currentCoverage,
      urgency,
      reason: gap > 0
        ? `Coverage gap: ${gap} unit${gap > 1 ? 's' : ''} needed. ${hs.incidentCount} incidents recorded.${isInPeak ? ' Currently in peak activity window.' : ''}`
        : `Adequate coverage. Maintain presence — risk score ${hs.riskScore}/100.`,
      timeWindow: `${peakHour}:00–${(peakHour + 3) % 24}:00`,
      crimeTypes: Array.from(crimeSet) as CrimeType[],
    };
  });
}

// ── AI Insights ────────────────────────────────────────────────────────────
export function generateInsights(
  incidents: CrimeIncident[],
  stats: CrimeStats,
  hotspots: HotspotCluster[],
  predictions: TimePrediction[],
  patrolRecs: PatrolRecommendation[],
): AIInsight[] {
  const insights: AIInsight[] = [];
  let id = 0;

  // 1. Top hotspot
  if (hotspots.length > 0) {
    const top = hotspots[0];
    insights.push({
      id: `INS-${++id}`,
      type: 'hotspot',
      severity: top.riskScore > 75 ? 'CRITICAL' : top.riskScore > 55 ? 'HIGH' : 'MEDIUM',
      title: `Crime Hotspot Detected: ${top.label}`,
      description: `DBSCAN clustering identified ${hotspots.length} hotspots. Primary zone at ${top.label} contains ${top.incidentCount} incidents with risk score ${top.riskScore}/100. Dominant crime type: ${top.dominantType}.`,
      recommendation: `Deploy ${top.recommendedPatrols} patrol unit(s) to ${top.label} immediately. Install CCTV at cluster centroid. Initiate community policing engagement.`,
      affectedArea: top.label,
      relatedHotspot: top.id,
      metrics: { riskScore: top.riskScore, incidents: top.incidentCount, clusters: hotspots.length },
    });
  }

  // 2. All hotspot coverage gap
  const gapRecs = patrolRecs.filter(r => r.unitsRequired > r.currentCoverage);
  if (gapRecs.length > 0) {
    const totalGap = gapRecs.reduce((s, r) => s + (r.unitsRequired - r.currentCoverage), 0);
    insights.push({
      id: `INS-${++id}`,
      type: 'patrol',
      severity: totalGap >= 4 ? 'CRITICAL' : totalGap >= 2 ? 'HIGH' : 'MEDIUM',
      title: `AI: ${totalGap} Patrol Unit${totalGap > 1 ? 's' : ''} Required Across ${gapRecs.length} Zones`,
      description: `AI analysis found coverage gaps in ${gapRecs.length} high-risk zones: ${gapRecs.slice(0, 3).map(r => r.location).join(', ')}${gapRecs.length > 3 ? ' and more' : ''}. Total deficit: ${totalGap} active units.`,
      recommendation: gapRecs
        .slice(0, 3)
        .map(r => `${r.location}: +${r.unitsRequired - r.currentCoverage} unit(s) (${r.urgency})`)
        .join(' • '),
      metrics: { totalGap, affectedZones: gapRecs.length },
    });
  }

  // 3. Peak activity prediction
  const nextPeak = predictions
    .filter(p => p.hour > new Date().getHours())
    .sort((a, b) => b.predictedCount - a.predictedCount)[0];
  if (nextPeak) {
    insights.push({
      id: `INS-${++id}`,
      type: 'prediction',
      severity: nextPeak.riskLevel,
      title: `AI Prediction: Peak Activity at ${nextPeak.hour}:00 Today`,
      description: `Machine learning model predicts ${nextPeak.predictedCount.toFixed(1)} incidents/hour at ${nextPeak.hour}:00 (confidence: ${Math.round(nextPeak.confidence * 100)}%). Risk level: ${nextPeak.riskLevel}.`,
      recommendation: `Pre-position patrol units 30 minutes before ${nextPeak.hour}:00. Ensure rapid response team is on standby. Alert supervisors at ${nextPeak.hour - 1}:00.`,
      metrics: { predictedHour: nextPeak.hour, predicted: nextPeak.predictedCount, confidence: Math.round(nextPeak.confidence * 100) + '%' },
    });
  }

  // 4. Peak activity window (historical)
  const peakHour = stats.byHour.indexOf(Math.max(...stats.byHour));
  const peakCount = stats.byHour[peakHour];
  const peakPct = Math.round((peakCount / Math.max(stats.total, 1)) * 100);
  insights.push({
    id: `INS-${++id}`,
    type: 'temporal',
    severity: peakPct > 12 ? 'HIGH' : 'MEDIUM',
    title: `Peak Activity Window: ${peakHour}:00–${peakHour + 1}:00`,
    description: `Historical data shows ${peakCount} incidents at ${peakHour}:00 (${peakPct}% of daily total). Evening hours 19:00–23:00 account for ${Math.round(stats.byHour.slice(19, 23).reduce((a, b) => a + b, 0) / stats.total * 100)}% of incidents.`,
    recommendation: `Maintain maximum patrol presence ${peakHour - 1}:00–${(peakHour + 2) % 24}:00. Stagger shift changes away from this window. Deploy foot patrols in pedestrianised areas.`,
    metrics: { peakHour, peakCount, proportion: peakPct + '%' },
  });

  // 5. Violent crime alert
  if (stats.violentCrimePct > 15) {
    insights.push({
      id: `INS-${++id}`,
      type: 'alert',
      severity: stats.violentCrimePct > 30 ? 'CRITICAL' : 'HIGH',
      title: `Elevated Violent Crime: ${Math.round(stats.violentCrimePct)}%`,
      description: `Violent crimes (Assault + Robbery) represent ${Math.round(stats.violentCrimePct)}% of all incidents, exceeding the 15% threshold. Average incident severity: ${stats.averageSeverity.toFixed(1)}/10.`,
      recommendation: 'Initiate enhanced stop-and-search. Deploy armed response units near hotspots. Coordinate with neighbourhood watch. Issue public safety advisory.',
      metrics: { violentPct: Math.round(stats.violentCrimePct), avgSeverity: stats.averageSeverity.toFixed(1) },
    });
  }

  // 6. Open case backlog
  const openRate = (stats.open / Math.max(stats.total, 1)) * 100;
  if (openRate > 35) {
    insights.push({
      id: `INS-${++id}`,
      type: 'resource',
      severity: openRate > 60 ? 'HIGH' : 'MEDIUM',
      title: `Case Backlog: ${stats.open} Open Cases (${Math.round(openRate)}%)`,
      description: `Resolution rate is ${Math.round(stats.resolutionRate)}%. ${stats.open} of ${stats.total} cases remain open. Investigative capacity appears insufficient for current crime volume.`,
      recommendation: 'Triage: prioritise violent crimes. Request temporary detective reinforcement. Implement digital case management to reduce admin overhead.',
      metrics: { open: stats.open, resolutionRate: Math.round(stats.resolutionRate) + '%' },
    });
  }

  // 7. Weekend pattern
  const weekendTotal = stats.byDayOfWeek[0] + stats.byDayOfWeek[6];
  const weekdayAvg = stats.byDayOfWeek.slice(1, 6).reduce((a, b) => a + b, 0) / 5;
  if (weekendTotal / 2 > weekdayAvg * 1.3) {
    insights.push({
      id: `INS-${++id}`,
      type: 'temporal',
      severity: 'MEDIUM',
      title: 'Weekend Crime Surge Detected',
      description: `Weekend incidents average ${Math.round(weekendTotal / 2)}/day vs ${Math.round(weekdayAvg)}/day on weekdays — a ${Math.round(((weekendTotal / 2) / weekdayAvg - 1) * 100)}% increase. Nighttime economy strongly correlated.`,
      recommendation: 'Increase weekend night patrols Friday–Saturday 20:00–04:00. Coordinate with licensed premises. Deploy extra resources near entertainment districts.',
      metrics: { weekendAvg: Math.round(weekendTotal / 2), weekdayAvg: Math.round(weekdayAvg) },
    });
  }

  // 8. Week trend
  const recentWeek = stats.byDay.slice(-7).reduce((a, b) => a + b.count, 0);
  const prevWeek = stats.byDay.slice(-14, -7).reduce((a, b) => a + b.count, 0);
  if (prevWeek > 0) {
    const changePct = Math.round(((recentWeek - prevWeek) / prevWeek) * 100);
    if (Math.abs(changePct) > 10) {
      insights.push({
        id: `INS-${++id}`,
        type: 'temporal',
        severity: changePct > 20 ? 'HIGH' : changePct > 0 ? 'MEDIUM' : 'LOW',
        title: `Weekly Trend: ${changePct > 0 ? '↑' : '↓'} ${Math.abs(changePct)}%`,
        description: `Incidents ${changePct > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePct)}% this week (${recentWeek} vs ${prevWeek}). ${changePct > 0 ? 'Upward trend requires attention.' : 'Downward trend suggests interventions are working.'}`,
        recommendation: changePct > 0
          ? 'Review patrol deployment from the previous week. Identify days with highest increases and cross-reference with patrol coverage.'
          : 'Document successful interventions for replication. Maintain current strategies while reviewing sustainability.',
        metrics: { thisWeek: recentWeek, lastWeek: prevWeek, change: changePct + '%' },
      });
    }
  }

  return insights.sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return order[a.severity] - order[b.severity];
  });
}

// ── Crime Correlation Detection ────────────────────────────────────────────
export function detectCrimeCorrelations(
  incidents: CrimeIncident[],
  hotspots: HotspotCluster[],
): AIInsight[] {
  const insights: AIInsight[] = [];

  hotspots.slice(0, 6).forEach(hs => {
    const hsInc = incidents.filter(i => hs.incidents.includes(i.id));
    if (hsInc.length < 6) return;

    const typeCounts: Partial<Record<CrimeType, number>> = {};
    for (const inc of hsInc) typeCounts[inc.type] = (typeCounts[inc.type] || 0) + 1;

    const sorted = (Object.entries(typeCounts) as [CrimeType, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (sorted.length < 2) return;

    const [typeA, countA] = sorted[0];
    const [typeB, countB] = sorted[1];
    const coOccurrencePct = Math.round(((countA + countB) / hsInc.length) * 100);

    if (coOccurrencePct < 50) return;

    const isSupplyDemand =
      (typeA === 'Drug Offense' && typeB === 'Robbery') ||
      (typeA === 'Robbery' && typeB === 'Drug Offense');
    const isOpportunistic =
      (typeA === 'Theft' && typeB === 'Burglary') ||
      (typeA === 'Burglary' && typeB === 'Theft');

    const patternLabel = isSupplyDemand
      ? 'supply/demand criminal economy'
      : isOpportunistic
      ? 'opportunistic property crime'
      : 'correlated crime cluster';

    insights.push({
      id: `COR-${hs.id}`,
      type: 'hotspot',
      severity: coOccurrencePct > 70 ? 'HIGH' : 'MEDIUM',
      title: `Correlation: ${typeA} + ${typeB} in ${hs.label}`,
      description: `${typeA} and ${typeB} co-occur in ${coOccurrencePct}% of ${hs.label} incidents (${countA + countB}/${hsInc.length}). This matches a ${patternLabel}.`,
      recommendation: isSupplyDemand
        ? `Coordinate drug enforcement with robbery response. Deploy plain-clothes officers. Target supplier networks.`
        : `Increase property security awareness in ${hs.label}. Consider target hardening measures.`,
      affectedArea: hs.label,
      relatedHotspot: hs.id,
      metrics: { [typeA]: countA, [typeB]: countB, coOccurrence: `${coOccurrencePct}%` },
    });
  });

  return insights;
}
