import { useState, useMemo, useCallback } from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download, X, Filter } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { CrimeIncident, CrimeType, CrimeStatus } from '@/types'
import { CRIME_COLORS } from '../map/MapView'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

type SortKey = 'dateTime' | 'type' | 'severity' | 'status' | 'location' | 'id'

const PAGE_SIZE = 80

const STATUS_CONFIG: Record<CrimeStatus, { bg: string; text: string; label: string }> = {
  'Open':               { bg: 'bg-red-500/10',    text: 'text-red-400',    label: 'Open' },
  'Closed':             { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Closed' },
  'Under Investigation':{ bg: 'bg-amber-500/10',   text: 'text-amber-400',   label: 'Invest.' },
}

export function IncidentTable() {
  const { displayIncidents } = useAppStore()

  const [search,    setSearch]    = useState('')
  const [sortKey,   setSortKey]   = useState<SortKey>('dateTime')
  const [sortAsc,   setSortAsc]   = useState(false)
  const [page,      setPage]      = useState(0)
  const [typeFilter, setTypeFilter] = useState<CrimeType | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<CrimeStatus | 'All'>('All')
  const [selected,  setSelected]  = useState<Set<string>>(new Set())

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) { setSortAsc(a => !a); return key }
      setSortAsc(true)
      return key
    })
    setPage(0)
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return displayIncidents
      .filter(i => {
        if (typeFilter !== 'All' && i.type !== typeFilter) return false
        if (statusFilter !== 'All' && i.status !== statusFilter) return false
        if (q && !i.id.toLowerCase().includes(q) && !i.type.toLowerCase().includes(q) &&
            !i.location.toLowerCase().includes(q) && !i.description.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        let va: string | number, vb: string | number
        if (sortKey === 'dateTime') { va = a.dateTime.getTime(); vb = b.dateTime.getTime() }
        else if (sortKey === 'severity') { va = a.severity; vb = b.severity }
        else { va = String((a as any)[sortKey]).toLowerCase(); vb = String((b as any)[sortKey]).toLowerCase() }
        if (va === vb) return 0
        return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
      })
  }, [displayIncidents, search, sortKey, sortAsc, typeFilter, statusFilter])

  const pageData    = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const exportCSV = useCallback(() => {
    const toExport = selected.size > 0
      ? filtered.filter(i => selected.has(i.id))
      : filtered
    const rows = ['ID,Type,DateTime,Status,Severity,Location,Description']
    toExport.forEach(i => {
      rows.push([
        i.id, i.type,
        format(i.dateTime, 'yyyy-MM-dd HH:mm'),
        i.status, i.severity, `"${i.location}"`, `"${i.description}"`,
      ].join(','))
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }))
    a.download = `incidents_${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [filtered, selected])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const SortIcon = ({ key: k }: { key: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown size={10} className="text-slate-600" />
    return sortAsc ? <ArrowUp size={10} className="text-sky-400" /> : <ArrowDown size={10} className="text-sky-400" />
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="ID, type, location, description…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs text-slate-300 placeholder-slate-600 outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value as CrimeType | 'All'); setPage(0) }}
          className="text-xs py-1.5 px-2 rounded-lg text-slate-400 outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <option value="All">All types</option>
          {['Theft','Assault','Robbery','Burglary','Vandalism','Drug Offense','Fraud','Other'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as CrimeStatus | 'All'); setPage(0) }}
          className="text-xs py-1.5 px-2 rounded-lg text-slate-400 outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <option value="All">All status</option>
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
          <option value="Under Investigation">Investigating</option>
        </select>

        {/* Export */}
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0"
          style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', color: '#38bdf8' }}
        >
          <Download size={12} />
          {selected.size > 0 ? `Export ${selected.size}` : `Export ${filtered.length}`}
        </button>
      </div>

      {/* Active filters */}
      {(typeFilter !== 'All' || statusFilter !== 'All' || search) && (
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <span className="text-[10px] text-slate-600 flex items-center gap-1"><Filter size={9} /> Filters:</span>
          {typeFilter !== 'All' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: `${CRIME_COLORS[typeFilter as CrimeType]}20`, color: CRIME_COLORS[typeFilter as CrimeType], border: `1px solid ${CRIME_COLORS[typeFilter as CrimeType]}30` }}>
              {typeFilter}
              <button onClick={() => setTypeFilter('All')}><X size={9} /></button>
            </span>
          )}
          {statusFilter !== 'All' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400 border border-white/10 flex items-center gap-1">
              {statusFilter}
              <button onClick={() => setStatusFilter('All')}><X size={9} /></button>
            </span>
          )}
          {search && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400 border border-white/10 flex items-center gap-1">
              "{search}"
              <button onClick={() => setSearch('')}><X size={9} /></button>
            </span>
          )}
          <span className="text-[10px] text-slate-600 ml-1">{filtered.length} results</span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)', minHeight: 0 }}>
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead className="sticky top-0" style={{ background: '#0a0f1e', borderBottom: '1px solid rgba(255,255,255,0.06)', zIndex: 10 }}>
            <tr>
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === pageData.length && pageData.length > 0}
                  onChange={() => {
                    if (selected.size === pageData.length) setSelected(new Set())
                    else setSelected(new Set(pageData.map(i => i.id)))
                  }}
                  className="accent-sky-500"
                />
              </th>
              {([
                ['id',       'ID'],
                ['dateTime', 'Date/Time'],
                ['type',     'Type'],
                ['status',   'Status'],
                ['severity', 'Sev.'],
                ['location', 'Location'],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th key={key}
                  onClick={() => toggleSort(key)}
                  className="text-left px-3 py-2 text-slate-500 font-medium cursor-pointer hover:text-slate-300 whitespace-nowrap select-none"
                >
                  <span className="flex items-center gap-1">
                    {label}
                    <SortIcon key={key} />
                  </span>
                </th>
              ))}
              <th className="text-left px-3 py-2 text-slate-500 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-600 text-sm">
                  No incidents match your filters
                </td>
              </tr>
            )}
            {pageData.map((inc, idx) => {
              const sc = STATUS_CONFIG[inc.status]
              const isSelected = selected.has(inc.id)
              return (
                <tr
                  key={inc.id}
                  onClick={() => toggleSelect(inc.id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: isSelected
                      ? 'rgba(14,165,233,0.08)'
                      : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                >
                  <td className="px-2 py-2.5">
                    <input type="checkbox" checked={isSelected} readOnly className="accent-sky-500" />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">{inc.id}</td>
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{format(inc.dateTime, 'dd MMM, HH:mm')}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: CRIME_COLORS[inc.type] }} />
                      <span className="text-slate-300">{inc.type}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', sc.bg, sc.text)}>
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('font-mono font-bold', inc.severity >= 8 ? 'text-red-400' : inc.severity >= 6 ? 'text-amber-400' : 'text-slate-400')}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{inc.location}</td>
                  <td className="px-3 py-2.5 text-slate-500 max-w-[160px] truncate">{inc.description}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] text-slate-500">
          {filtered.length} results · page {page + 1}/{totalPages}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </span>
        <div className="flex gap-1">
          <button disabled={page === 0} onClick={() => setPage(0)}
            className="px-2 py-1 rounded-lg text-[11px] text-slate-500 disabled:opacity-30 hover:text-slate-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            ««
          </button>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-2 py-1 rounded-lg text-[11px] text-slate-500 disabled:opacity-30 hover:text-slate-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            Prev
          </button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
            className="px-2 py-1 rounded-lg text-[11px] text-slate-500 disabled:opacity-30 hover:text-slate-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            Next
          </button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}
            className="px-2 py-1 rounded-lg text-[11px] text-slate-500 disabled:opacity-30 hover:text-slate-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            »»
          </button>
        </div>
      </div>
    </div>
  )
}
