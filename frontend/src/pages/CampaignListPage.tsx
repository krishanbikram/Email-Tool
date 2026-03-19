import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Send, Eye, Trash2, Mail, BarChart2, Clock, BarChart } from 'lucide-react'
import api from '../lib/api'

const statusColor: Record<string, string> = {
  DRAFT: 'badge-slate', SCHEDULED: 'badge-yellow', SENDING: 'badge-blue',
  SENT: 'badge-green', FAILED: 'badge-red', PAUSED: 'badge-yellow',
}

export default function CampaignListPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then(r => r.data),
    refetchInterval: 10000,
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/send`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(`${res.data.message}`)
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to send'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campaign deleted') },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="text-sm text-slate-400 mt-0.5">Build and manage email campaigns</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary" id="new-campaign-btn">
          <Plus size={15} /> New Campaign
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading campaigns…</div>
      ) : data?.data?.length === 0 ? (
        <div className="card p-12 text-center">
          <Mail size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-4">No campaigns yet.</p>
          <Link to="/campaigns/new" className="btn-primary inline-flex">Create your first campaign</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data?.map((c: any) => (
            <div key={c.id} className="card-hover p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className={statusColor[c.status] || 'badge-slate'}>{c.status}</span>
                    <h3 className="font-semibold text-slate-100 truncate">{c.name}</h3>
                  </div>
                  <p className="text-sm text-slate-400 truncate">Subject: {c.subject}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Mail size={11} /> {c.domain?.domain || '—'}</span>
                    <span className="flex items-center gap-1"><BarChart2 size={11} /> {c.list?.name || '—'}</span>
                    {c.scheduledAt && <span className="flex items-center gap-1"><Clock size={11} /> {new Date(c.scheduledAt).toLocaleString()}</span>}
                    <span>{c._count?.emailLogs || 0} queued</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link to={`/campaigns/${c.id}/stats`} className="btn-ghost text-xs gap-1.5 text-slate-400 hover:text-slate-200">
                    <BarChart size={13} /> Stats
                  </Link>
                  <Link to={`/campaigns/${c.id}/edit`} className="btn-secondary text-xs gap-1.5">
                    <Eye size={13} /> Edit
                  </Link>
                  {['DRAFT', 'SCHEDULED'].includes(c.status) && (
                    <button onClick={() => { if (confirm(`Send "${c.name}" now?`)) sendMutation.mutate(c.id) }}
                      className="btn-primary text-xs gap-1.5" disabled={sendMutation.isPending}>
                      <Send size={13} /> Send
                    </button>
                  )}
                  <button onClick={() => { if (confirm('Delete campaign?')) deleteMutation.mutate(c.id) }}
                    className="btn-ghost p-1.5 text-red-400 hover:text-red-300">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
