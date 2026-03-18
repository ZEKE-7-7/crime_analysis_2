import { CrimeIncident } from '@/types'

export function IncidentPopup({ incident }: { incident: CrimeIncident }) {
  return (
    <div className="text-xs text-white">
      <strong>{incident.type}</strong> — {incident.status}
    </div>
  )
}
