import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AlertTriangle, Plus, RefreshCw, Download } from 'lucide-react'
import api from '../lib/api'

export default function BouncesPage() {
  const qc = useQueryClient()
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newBounce, setNewBounce] = useState({ email: '', type: 'HARD' })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bounces', typeFilter, page],
    queryFn: () => api.get('/bounces', { params: { type: typeFilter || undefined, page, limit: 50 } }).then(r => r.data),
    staleTime: 15000,
  })

  const addMutation = useMutation({
    mutationFn: () => api.post('/bounces', newBounce),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bounces'] })
      setNewBounce({ email: '', type: 'HARD' })
      setShowAddForm(false)
      toast.success('Bounce recorded and contact suppressed')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  })

  const exportCSV = () => {
    const url = `/api/bounces/export?type=${typeFilter}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Bounce Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">Monitor bounces and suppression list</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-secondary gap-1.5"><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary gap-1.5">
            <Plus size={14} /> Add Bounce
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bounces', value: data?.total ?? '—', color: 'text-red-400' },
          { label: 'Hard Bounces', value: data?.hardCount ?? '—', color: 'text-red-400' },
          { label: 'Soft Bounces', value: data?.softCount ?? '—', color: 'text-yellow-400' },
          { label: 'Suppressed', value: data?.total ?? '—', color: 'text-slate-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <AlertTriangle size={16} className={`mb-2 ${color}`} />
            <div className="stat-number">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Add bounce form */}
      {showAddForm && (
        <div className="card p-5 space-y-4">
          <h3 className="section-title">Manually Add Bounce</h3>
          <div className="flex gap-3 flex-wrap">
            <input
              className="input flex-1 min-w-48"
              type="email"
              placeholder="email@example.com"
              value={newBounce.email}
              onChange={e => setNewBounce(p => ({ ...p, email: e.target.value }))}
            />
            <select
              className="input w-auto"
              value={newBounce.type}
              onChange={e => setNewBounce(p => ({ ...p, type: e.target.value }))}
            >
              <option value="HARD">Hard Bounce</option>
              <option value="SOFT">Soft Bounce</option>
            </select>
            <button
              onClick={() => addMutation.mutate()}
              className="btn-primary"
              disabled={!newBounce.email || addMutation.isPending}
            >
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
          </div>
          <p className="text-xs text-slate-500">Hard bounces automatically set the contact status to BOUNCED.</p>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <select className="input w-auto text-xs py-1.5" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}>
          <option value="">All Types</option>
          <option value="HARD">Hard</option>
          <option value="SOFT">Soft</option>
        </select>
        {data && <span className="text-xs text-slate-400 ml-auto">{data.total.toLocaleString()} records</span>}
        <button onClick={exportCSV} className="btn-secondary text-xs gap-1.5"><Download size={12} /> Export</button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Type</th>
              <th>Campaign</th>
              <th>Raw Response</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading…</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">No bounces recorded</td></tr>
            ) : data?.data?.map((b: any) => (
              <tr key={b.id}>
                <td className="font-mono text-xs">{b.email}</td>
                <td>
                  <span className={b.type === 'HARD' ? 'badge-red' : 'badge-yellow'}>{b.type}</span>
                </td>
                <td className="text-xs text-slate-400">{b.campaign?.name || b.campaignId || '—'}</td>
                <td className="max-w-[200px]">
                  {b.rawResponse ? (
                    <span className="text-xs text-slate-500 truncate block" title={b.rawResponse}>
                      {typeof b.rawResponse === 'string' ? b.rawResponse.slice(0, 60) : JSON.stringify(b.rawResponse).slice(0, 60)}…
                    </span>
                  ) : '—'}
                </td>
                <td className="text-xs text-slate-400">{new Date(b.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 50 && (
        <div className="flex justify-end gap-2">
          <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span className="text-xs text-slate-400 self-center">Page {page}</span>
          <button className="btn-secondary text-xs" disabled={page * 50 >= data.total} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
