import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Filter, RefreshCw } from 'lucide-react'
import api from '../lib/api'

const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'badge-slate', SENT: 'badge-blue', DELIVERED: 'badge-green',
  OPENED: 'badge-green', CLICKED: 'badge-green', BOUNCED: 'badge-red',
  FAILED: 'badge-red', UNSUBSCRIBED: 'badge-yellow',
}

export default function LogsPage() {
  const [filters, setFilters] = useState({ status: '', from: '', to: '', page: 1 })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['logs', filters],
    queryFn: () => api.get('/logs', { params: { ...filters, limit: 100 } }).then(r => r.data),
    staleTime: 15000,
  })

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters(prev => ({ ...prev, [field]: e.target.value, page: 1 }))

  const exportCSV = () => {
    const url = `/api/logs/export?status=${filters.status}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Email Logs</h1>
          <p className="text-sm text-slate-400 mt-0.5">Detailed send history and delivery status</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-secondary gap-1.5"><RefreshCw size={14} /> Refresh</button>
          <button onClick={exportCSV} className="btn-secondary gap-1.5"><Download size={14} /> Export CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={14} className="text-slate-400" />
          <select className="input w-auto text-xs py-1.5" value={filters.status} onChange={f('status')}>
            <option value="">All Statuses</option>
            {['QUEUED','SENT','DELIVERED','OPENED','CLICKED','BOUNCED','FAILED','UNSUBSCRIBED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">From:</span>
            <input type="datetime-local" className="input w-auto text-xs py-1.5" value={filters.from} onChange={f('from')} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">To:</span>
            <input type="datetime-local" className="input w-auto text-xs py-1.5" value={filters.to} onChange={f('to')} />
          </div>
          {data && <span className="text-xs text-slate-400 ml-auto">{data.total} records</span>}
        </div>
      </div>

      {/* Log table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Campaign</th>
              <th>Domain</th>
              <th>Status</th>
              <th>SMTP Code</th>
              <th>Error</th>
              <th>Sent At</th>
              <th>Opened</th>
              <th>Clicked</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-8 text-slate-500">Loading logs…</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-slate-500">No logs matching filters</td></tr>
            ) : data?.data?.map((log: any) => (
              <tr key={log.id}>
                <td>
                  <div className="font-mono text-xs">{log.contact?.email}</div>
                  {log.contact?.firstName && <div className="text-xs text-slate-500">{log.contact.firstName}</div>}
                </td>
                <td className="text-xs text-slate-400 max-w-[120px] truncate">{log.campaign?.name || '—'}</td>
                <td className="text-xs font-mono text-slate-400">{log.domain?.domain || '—'}</td>
                <td><span className={STATUS_COLORS[log.status] || 'badge-slate'}>{log.status}</span></td>
                <td className="text-xs font-mono text-slate-400">{log.smtpCode || '—'}</td>
                <td className="max-w-[150px]"><span className="text-xs text-red-400 truncate block" title={log.errorMessage}>{log.errorMessage || '—'}</span></td>
                <td className="text-xs text-slate-400">{log.sentAt ? new Date(log.sentAt).toLocaleString() : '—'}</td>
                <td className="text-xs text-slate-400">{log.openedAt ? '✓' : '—'}</td>
                <td className="text-xs text-slate-400">{log.clickedAt ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 100 && (
        <div className="flex justify-end gap-2">
          <button className="btn-secondary text-xs" disabled={filters.page <= 1} onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}>Prev</button>
          <span className="text-xs text-slate-400 self-center">Page {filters.page}</span>
          <button className="btn-secondary text-xs" disabled={filters.page * 100 >= data.total} onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}>Next</button>
        </div>
      )}
    </div>
  )
}
