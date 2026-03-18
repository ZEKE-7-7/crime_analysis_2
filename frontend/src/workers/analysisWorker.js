// src/workers/analysisWorker.js
// Offloads the analysis pipeline from the main thread.
// Built as plain JS (not TS) to avoid Vite worker transform issues.

// We inline a minimal version of the analysis functions here
// so the worker can be fully self-contained.

self.onmessage = function(e) {
  const { incidents, patrolUnits } = e.data;
  
  try {
    // Minimal inline implementations to avoid import resolution in worker context
    const stats               = computeStats(incidents);
    const hotspots            = detectHotspots(incidents);
    const predictions         = generateTimePredictions(stats);
    const predictionZones     = generatePredictionZones(incidents, hotspots);
    const patrolRecommendations = generatePatrolRecommendations(hotspots, patrolUnits, stats);
    const insights            = generateInsights(incidents, stats, hotspots, predictions, patrolRecommendations);

    self.postMessage({ stats, hotspots, predictions, predictionZones, patrolRecommendations, insights });
  } catch(err) {
    self.postMessage({ error: err.message });
  }
};

// ── Inline analysis functions ─────────────────────────────────────────────

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function computeStats(incidents) {
  const byType = {}; const byHour = new Array(24).fill(0); const byDayOfWeek = new Array(7).fill(0);
  const byDayMap = {}; let totalSeverity = 0;
  for (const inc of incidents) {
    byType[inc.type] = (byType[inc.type]||0) + 1;
    const h = new Date(inc.dateTime).getHours(); byHour[h]++;
    byDayOfWeek[new Date(inc.dateTime).getDay()]++;
    const dayKey = new Date(inc.dateTime).toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
    byDayMap[dayKey] = (byDayMap[dayKey]||0) + 1;
    totalSeverity += inc.severity;
  }
  const now = new Date();
  const byDay = Array.from({length:30},(_,i) => {
    const d = new Date(now); d.setDate(d.getDate() - (29-i));
    const key = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
    return { date: key, count: byDayMap[key]||0 };
  });
  const locationMap = {};
  for (const inc of incidents) locationMap[inc.location] = (locationMap[inc.location]||0)+1;
  const topLocations = Object.entries(locationMap).map(([l,c])=>({location:l,count:c})).sort((a,b)=>b.count-a.count).slice(0,8);
  const violent = (byType['Assault']||0)+(byType['Robbery']||0);
  const closed = incidents.filter(i=>i.status==='Closed').length;
  return { total:incidents.length, open:incidents.filter(i=>i.status==='Open').length, closed,
    underInvestigation:incidents.filter(i=>i.status==='Under Investigation').length,
    byType, byHour, byDay, topLocations, byDayOfWeek,
    averageSeverity: incidents.length > 0 ? totalSeverity/incidents.length : 0,
    violentCrimePct: incidents.length > 0 ? (violent/incidents.length)*100 : 0,
    resolutionRate: incidents.length > 0 ? (closed/incidents.length)*100 : 0 };
}

function detectHotspots(incidents) {
  const EPS = 600; const MIN_PTS = 4;
  const visited = new Set(); const clusters = [];
  function rq(idx) {
    const inc = incidents[idx];
    return incidents.map((o,j)=>({j,d:haversineMetres(inc.lat,inc.lng,o.lat,o.lng)})).filter(({d})=>d<=EPS).map(({j})=>j);
  }
  function expand(idx, neighbours, cluster) {
    cluster.points.push(idx);
    let i = 0;
    while (i < neighbours.length) {
      const q = neighbours[i];
      if (!visited.has(q)) { visited.add(q); const qn = rq(q); if (qn.length>=MIN_PTS) neighbours.push(...qn.filter(n=>!neighbours.includes(n))); }
      if (!clusters.some(c=>c.points.includes(q))) cluster.points.push(q);
      i++;
    }
  }
  incidents.forEach((_,idx)=>{
    if (visited.has(idx)) return; visited.add(idx); const nb = rq(idx);
    if (nb.length>=MIN_PTS) { const cluster={points:[]}; clusters.push(cluster); expand(idx,nb,cluster); }
  });
  const AREAS = [
    {name:'Westminster',lat:51.4975,lng:-0.1357},{name:'Soho',lat:51.5137,lng:-0.1329},
    {name:'Camden',lat:51.5390,lng:-0.1426},{name:'Hackney',lat:51.5450,lng:-0.0553},
    {name:'Islington',lat:51.5362,lng:-0.1027},{name:'Southwark',lat:51.5036,lng:-0.0880},
    {name:'Lambeth',lat:51.4607,lng:-0.1163},{name:'Tower Hamlets',lat:51.5099,lng:-0.0059},
    {name:'Lewisham',lat:51.4615,lng:-0.0169},{name:'Brixton',lat:51.4613,lng:-0.1156},
    {name:'Shoreditch',lat:51.5237,lng:-0.0777},{name:'Peckham',lat:51.4735,lng:-0.0695},
  ];
  return clusters.filter(c=>c.points.length>=MIN_PTS).map((c,i)=>{
    const pts = c.points.map(j=>incidents[j]);
    const cLat = pts.reduce((s,p)=>s+p.lat,0)/pts.length;
    const cLng = pts.reduce((s,p)=>s+p.lng,0)/pts.length;
    const radius = Math.max(...pts.map(p=>haversineMetres(cLat,cLng,p.lat,p.lng)));
    const tc={}; let totalSev=0;
    for (const p of pts) { tc[p.type]=(tc[p.type]||0)+1; totalSev+=p.severity; }
    const domType = Object.entries(tc).sort((a,b)=>b[1]-a[1])[0][0];
    const riskScore = Math.round(Math.min(pts.length/10,1)*50 + (totalSev/pts.length/10)*50);
    const area = AREAS.reduce((best,a)=>haversineMetres(cLat,cLng,a.lat,a.lng)<haversineMetres(cLat,cLng,best.lat,best.lng)?a:best);
    return { id:`HS-${String(i+1).padStart(3,'0')}`, centroidLat:cLat, centroidLng:cLng,
      radius:Math.max(radius,200), incidentCount:pts.length, dominantType:domType, riskScore,
      label:area.name, incidents:pts.map(p=>p.id), recommendedPatrols:pts.length>=20?3:pts.length>=10?2:1 };
  }).sort((a,b)=>b.riskScore-a.riskScore).slice(0,10);
}

function generateTimePredictions(stats) {
  const ALPHA=0.3; const hourlyRates=stats.byHour.map(c=>c/Math.max(stats.total/24,1));
  const smoothed=[...hourlyRates];
  for (let p=0;p<2;p++) for (let h=1;h<24;h++) smoothed[h]=ALPHA*hourlyRates[h]+(1-ALPHA)*smoothed[h-1];
  const residuals=hourlyRates.map((r,h)=>r-smoothed[h]);
  const sigma=Math.sqrt(residuals.reduce((s,r)=>s+r*r,0)/24);
  const maxS=Math.max(...smoothed,0.001); const conf=Math.min(0.95,0.55+stats.total/600);
  const isWeekend=[0,5,6].includes(new Date().getDay());
  return Array.from({length:24},(_,hour)=>{
    const pb=[19,20,21,22,23,1,2].includes(hour)?1.1:1.0;
    const pred=smoothed[hour]*(isWeekend?1.15:1.0)*pb;
    const band=sigma*(2-conf); const ratio=pred/maxS;
    return { hour, predictedCount:Math.round(pred*10)/10, lower:Math.max(0,Math.round((pred-band)*10)/10),
      upper:Math.round((pred+band)*10)/10, confidence:conf,
      riskLevel:ratio>0.7?'CRITICAL':ratio>0.5?'HIGH':ratio>0.3?'MEDIUM':'LOW' };
  });
}

function generatePredictionZones(incidents, hotspots) {
  return hotspots.slice(0,6).map(hs=>{
    const hsInc=incidents.filter(i=>hs.incidents.includes(i.id));
    const hc=new Array(24).fill(0); for (const inc of hsInc) hc[new Date(inc.dateTime).getHours()]++;
    return { location:hs.label, lat:hs.centroidLat, lng:hs.centroidLng,
      nextPeakHour:hc.indexOf(Math.max(...hc)), predictedIncidents:Math.round(hsInc.length/30*1.1), riskScore:hs.riskScore };
  });
}

function generatePatrolRecommendations(hotspots, patrolUnits, stats) {
  const now=new Date(); const currentHour=now.getHours();
  const peakHour=stats.byHour.indexOf(Math.max(...stats.byHour));
  return hotspots.slice(0,6).map(hs=>{
    const nearby=patrolUnits.filter(p=>{
      const d=haversineMetres(hs.centroidLat,hs.centroidLng,p.lat,p.lng);
      return d<1500 && p.status!=='Off Duty';
    });
    const gap=Math.max(0,hs.recommendedPatrols-nearby.length);
    const urgency=hs.riskScore>75?'CRITICAL':hs.riskScore>55?'HIGH':hs.riskScore>35?'MEDIUM':'LOW';
    const isInPeak=Math.abs(currentHour-peakHour)<=2;
    return { hotspotId:hs.id, location:hs.label, lat:hs.centroidLat, lng:hs.centroidLng,
      unitsRequired:hs.recommendedPatrols, currentCoverage:nearby.length, urgency,
      reason: gap>0 ? `Coverage gap: ${gap} unit(s) needed. ${hs.incidentCount} incidents.${isInPeak?' Peak activity window active.':''}` : `Adequate coverage. Risk score ${hs.riskScore}/100.`,
      timeWindow:`${peakHour}:00–${(peakHour+3)%24}:00`, crimeTypes:[hs.dominantType] };
  });
}

function generateInsights(incidents, stats, hotspots, predictions, patrolRecs) {
  const insights=[]; let id=0;
  if (hotspots.length>0) {
    const top=hotspots[0];
    insights.push({ id:`INS-${++id}`, type:'hotspot', severity:top.riskScore>75?'CRITICAL':top.riskScore>55?'HIGH':'MEDIUM',
      title:`Crime Hotspot: ${top.label}`, affectedArea:top.label, relatedHotspot:top.id,
      description:`${hotspots.length} hotspots detected. Primary at ${top.label}: ${top.incidentCount} incidents, risk ${top.riskScore}/100. Dominant: ${top.dominantType}.`,
      recommendation:`Deploy ${top.recommendedPatrols} patrol unit(s) to ${top.label}. Install CCTV at centroid.`,
      metrics:{riskScore:top.riskScore,incidents:top.incidentCount,clusters:hotspots.length} });
  }
  const nextPeak=predictions.filter(p=>p.hour>new Date().getHours()).sort((a,b)=>b.predictedCount-a.predictedCount)[0];
  if (nextPeak) {
    insights.push({ id:`INS-${++id}`, type:'prediction', severity:nextPeak.riskLevel,
      title:`Prediction: Peak at ${nextPeak.hour}:00 today`,
      description:`Model predicts ${nextPeak.predictedCount} inc/hr at ${nextPeak.hour}:00 (confidence ${Math.round(nextPeak.confidence*100)}%).`,
      recommendation:`Pre-position units 30min before ${nextPeak.hour}:00.`,
      metrics:{predictedHour:nextPeak.hour,predicted:nextPeak.predictedCount,confidence:Math.round(nextPeak.confidence*100)+'%'} });
  }
  const gapRecs=patrolRecs.filter(r=>r.unitsRequired>r.currentCoverage);
  if (gapRecs.length>0) {
    const totalGap=gapRecs.reduce((s,r)=>s+(r.unitsRequired-r.currentCoverage),0);
    insights.push({ id:`INS-${++id}`, type:'patrol', severity:totalGap>=4?'CRITICAL':totalGap>=2?'HIGH':'MEDIUM',
      title:`${totalGap} Units Needed Across ${gapRecs.length} Zones`,
      description:`Coverage gaps: ${gapRecs.slice(0,3).map(r=>r.location).join(', ')}.`,
      recommendation:gapRecs.slice(0,3).map(r=>`${r.location}: +${r.unitsRequired-r.currentCoverage} (${r.urgency})`).join(' • '),
      metrics:{totalGap,affectedZones:gapRecs.length} });
  }
  if (stats.violentCrimePct>15) {
    insights.push({ id:`INS-${++id}`, type:'alert', severity:stats.violentCrimePct>30?'CRITICAL':'HIGH',
      title:`Elevated Violent Crime: ${Math.round(stats.violentCrimePct)}%`,
      description:`Assault+Robbery = ${Math.round(stats.violentCrimePct)}% of incidents. Avg severity: ${stats.averageSeverity.toFixed(1)}/10.`,
      recommendation:'Enhanced stop-and-search. Armed response units near hotspots.',
      metrics:{violentPct:Math.round(stats.violentCrimePct),avgSeverity:stats.averageSeverity.toFixed(1)} });
  }
  const order={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3};
  return insights.sort((a,b)=>order[a.severity]-order[b.severity]);
}
