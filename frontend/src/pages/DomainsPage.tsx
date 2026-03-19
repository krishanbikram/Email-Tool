import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Globe, Plus, Trash2, TestTube, Copy, CheckCircle, XCircle, Info, Thermometer } from 'lucide-react'
import api from '../lib/api'

function DNSCard({ domainId }: { domainId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dns', domainId],
    queryFn: () => api.get(`/domains/${domainId}/dns-suggestions`).then(r => r.data),
  })

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  if (isLoading) return <div className="text-slate-500 text-xs">Loading DNS records…</div>

  return (
    <div className="space-y-3 mt-3">
      {data && Object.entries(data).map(([key, rec]: [string, any]) => (
        <div key={key} className="bg-slate-950 rounded-lg p-3 border border-slate-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-brand-400 uppercase">{key}</span>
            <span className="badge badge-slate">{rec.type}</span>
          </div>
          <div className="text-xs text-slate-400 mb-1">{rec.description}</div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-slate-300 bg-slate-800 rounded px-2 py-1 flex-1 font-mono truncate">{rec.value}</code>
            <button onClick={() => copy(rec.value)} className="btn-ghost p-1.5" title="Copy">
              <Copy size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

interface DomainFormData {
  domain: string; smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string;
  encryption: string; fromName: string; fromEmail: string;
}

const emptyForm: DomainFormData = { domain: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', encryption: 'TLS', fromName: 'No Reply', fromEmail: '' }

export default function DomainsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [form, setForm] = useState<DomainFormData>(emptyForm)
  const [testingId, setTestingId] = useState<string | null>(null)

  const { data: domains, isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get('/domains').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: DomainFormData) => api.post('/domains', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domains'] }); setShowForm(false); setForm(emptyForm); toast.success('Domain added') },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to add domain'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/domains/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['domains'] }); toast.success('Domain deleted') },
  })

  const testSmtp = async (id: string) => {
    setTestingId(id)
    try {
      const { data } = await api.post(`/domains/${id}/test-smtp`)
      if (data.success) toast.success(data.message)
      else toast.error(data.message)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'SMTP test failed')
    } finally {
      setTestingId(null)
    }
  }

  const f = (field: keyof DomainFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: field === 'smtpPort' ? +e.target.value : e.target.value }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Domains & SMTP</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage sending domains and SMTP credentials</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary" id="add-domain-btn">
          <Plus size={15} /> Add Domain
        </button>
      </div>

      {/* Add domain form */}
      {showForm && (
        <div className="card p-6">
          <h3 className="section-title mb-4">Add Sending Domain</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[['domain','Domain (e.g. mail.example.com)','text'],['smtpHost','SMTP Host','text'],['smtpUser','SMTP Username','text'],['smtpPass','SMTP Password','password'],['fromName','From Name','text'],['fromEmail','From Email','email']].map(([field, placeholder, type]) => (
              <div key={field}>
                <label className="label capitalize">{field.replace(/([A-Z])/g,' $1')}</label>
                <input type={type} className="input" placeholder={placeholder} value={form[field as keyof DomainFormData] as string} onChange={f(field as keyof DomainFormData)} />
              </div>
            ))}
            <div>
              <label className="label">SMTP Port</label>
              <input type="number" className="input" value={form.smtpPort} onChange={f('smtpPort')} />
            </div>
            <div>
              <label className="label">Encryption</label>
              <select className="input" value={form.encryption} onChange={f('encryption')}>
                <option value="TLS">TLS (STARTTLS)</option>
                <option value="SSL">SSL</option>
                <option value="NONE">None</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => createMutation.mutate(form)} className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Domain'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Domain cards */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading domains…</div>
      ) : domains?.length === 0 ? (
        <div className="card p-12 text-center">
          <Globe size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No domains yet. Add your first sending domain.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {domains?.map((d: any) => (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${d.isActive ? 'bg-brand-400' : 'bg-slate-600'}`} />
                  <div>
                    <div className="font-semibold text-slate-100">{d.domain}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{d.smtpHost}:{d.smtpPort} · {d.encryption} · {d.totalSent} sent</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.warmupEnabled && d.warmupProgress && (
                    <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2.5 py-1">
                      <Thermometer size={12} className="text-orange-400" />
                      <span className="text-xs text-orange-400">Week {d.warmupProgress.week} · {d.warmupProgress.dailyLimit}/day</span>
                    </div>
                  )}
                  <button onClick={() => testSmtp(d.id)} className="btn-secondary text-xs gap-1.5" disabled={testingId === d.id}>
                    <TestTube size={13} />
                    {testingId === d.id ? 'Testing…' : 'Test SMTP'}
                  </button>
                  <button onClick={() => setSelectedDomain(selectedDomain === d.id ? null : d.id)} className="btn-ghost p-1.5" title="DNS Records">
                    <Info size={15} />
                  </button>
                  <button onClick={() => { if (confirm('Delete this domain?')) deleteMutation.mutate(d.id) }} className="btn-ghost p-1.5 text-red-400 hover:text-red-300">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* DNS records panel */}
              {selectedDomain === d.id && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">DNS Records for {d.domain}</h4>
                  <DNSCard domainId={d.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
