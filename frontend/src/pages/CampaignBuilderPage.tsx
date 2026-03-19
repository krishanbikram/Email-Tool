import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Save, Send, Monitor, Smartphone, ArrowLeft, AlertCircle } from 'lucide-react'
import api from '../lib/api'

// Dynamic import of Quill to handle SSR/module issues
// @ts-ignore
import ReactQuill from 'react-quill'

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['clean'],
  ],
}

interface CampaignForm {
  name: string; subject: string; subjectB: string; abSplitPercent: number
  htmlBody: string; textBody: string; listId: string; domainId: string
  scheduledAt: string; timezone: string; trackOpens: boolean
  trackClicks: boolean; sendRatePerHour: number
}

const emptyForm: CampaignForm = {
  name: '', subject: '', subjectB: '', abSplitPercent: 50,
  htmlBody: '', textBody: '', listId: '', domainId: '',
  scheduledAt: '', timezone: 'UTC', trackOpens: true,
  trackClicks: true, sendRatePerHour: 100,
}

export default function CampaignBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<CampaignForm>(emptyForm)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile' | null>(null)
  const [enableAB, setEnableAB] = useState(false)

  const { data: domains } = useQuery({ queryKey: ['domains'], queryFn: () => api.get('/domains').then(r => r.data) })
  const { data: lists } = useQuery({ queryKey: ['contact-lists'], queryFn: () => api.get('/contacts/lists').then(r => r.data) })

  const { data: existing } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get(`/campaigns/${id}`).then(r => r.data),
    enabled: !!id,
  })

  useEffect(() => {
    if (existing) {
      setForm({ ...emptyForm, ...existing, scheduledAt: existing.scheduledAt ? existing.scheduledAt.slice(0,16) : '' })
      if (existing.subjectB) setEnableAB(true)
    }
  }, [existing])

  const f = (field: keyof CampaignForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.type === 'number' ? +e.target.value : e.target.value }))

  const saveMutation = useMutation({
    mutationFn: (data: CampaignForm) => id ? api.put(`/campaigns/${id}`, data) : api.post('/campaigns', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(id ? 'Campaign updated' : 'Campaign created')
      if (!id) navigate(`/campaigns/${res.data.id}/edit`)
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save'),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/send`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(res.data.message)
      navigate('/campaigns')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Send failed'),
  })

  const payload = { ...form, subjectB: enableAB ? form.subjectB : undefined, abSplitPercent: enableAB ? form.abSplitPercent : undefined }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/campaigns')} className="btn-ghost p-1.5"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="page-title">{id ? 'Edit Campaign' : 'New Campaign'}</h1>
          <p className="text-sm text-slate-400 mt-0.5">Configure and preview your email campaign</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => saveMutation.mutate(payload as CampaignForm)} className="btn-secondary" disabled={saveMutation.isPending} id="save-campaign-btn">
            <Save size={15} /> {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
          </button>
          {id && (
            <button onClick={() => sendMutation.mutate()} className="btn-primary" disabled={sendMutation.isPending} id="send-campaign-btn">
              <Send size={15} /> {sendMutation.isPending ? 'Sending…' : 'Send Now'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: form */}
        <div className="xl:col-span-2 space-y-4">
          {/* Basic info */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title">Campaign Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">Campaign Name *</label>
                <input className="input" placeholder="e.g. March Newsletter" value={form.name} onChange={f('name')} />
              </div>
              <div>
                <label className="label">Contact List *</label>
                <select className="input" value={form.listId} onChange={f('listId')}>
                  <option value="">Select list…</option>
                  {(lists || []).map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l._count?.contacts || 0})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Sending Domain *</label>
                <select className="input" value={form.domainId} onChange={f('domainId')}>
                  <option value="">Select domain…</option>
                  {(domains || []).filter((d: any) => d.isActive).map((d: any) => <option key={d.id} value={d.id}>{d.domain}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Subject + A/B */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Subject Line</h3>
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input type="checkbox" checked={enableAB} onChange={e => setEnableAB(e.target.checked)} className="rounded" />
                Enable A/B Test
              </label>
            </div>
            <div>
              <label className="label">Subject A {enableAB && <span className="text-brand-400">(Variant A)</span>}</label>
              <input className="input" placeholder="Enter email subject…" value={form.subject} onChange={f('subject')} />
            </div>
            {enableAB && (
              <>
                <div>
                  <label className="label">Subject B <span className="text-purple-400">(Variant B)</span></label>
                  <input className="input" placeholder="Alternative subject…" value={form.subjectB} onChange={f('subjectB')} />
                </div>
                <div>
                  <label className="label">% receiving Variant B: {form.abSplitPercent}%</label>
                  <input type="range" min="5" max="95" step="5" value={form.abSplitPercent} onChange={f('abSplitPercent')} className="w-full accent-purple-500" />
                </div>
              </>
            )}
          </div>

          {/* Email body */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title">Email Body</h3>
              <div className="flex gap-1">
                <button onClick={() => setPreviewMode('desktop')} className={`btn-ghost p-1.5 ${previewMode === 'desktop' ? 'text-brand-400' : ''}`}><Monitor size={15} /></button>
                <button onClick={() => setPreviewMode('mobile')} className={`btn-ghost p-1.5 ${previewMode === 'mobile' ? 'text-brand-400' : ''}`}><Smartphone size={15} /></button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
              <AlertCircle size={11} /> Use variables: <code className="bg-slate-800 px-1 rounded">{'{{first_name}}'}</code> <code className="bg-slate-800 px-1 rounded">{'{{company}}'}</code> <code className="bg-slate-800 px-1 rounded">{'{{unsubscribe_url}}'}</code>
            </p>
            {ReactQuill ? (
              <div className="quill-dark">
                <ReactQuill
                  theme="snow"
                  value={form.htmlBody}
                  onChange={(v: string) => setForm(prev => ({ ...prev, htmlBody: v }))}
                  modules={quillModules}
                  style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: '8px', minHeight: '300px' }}
                />
              </div>
            ) : (
              <textarea
                className="input min-h-[300px] font-mono text-xs"
                placeholder="Paste HTML email body here…"
                value={form.htmlBody}
                onChange={f('htmlBody')}
              />
            )}
          </div>

          {/* Plain text body */}
          <div className="card p-5">
            <label className="label">Plain Text Fallback</label>
            <textarea className="input min-h-[100px] font-mono text-xs" placeholder="Plain text version (recommended for deliverability)…" value={form.textBody} onChange={f('textBody')} />
          </div>
        </div>

        {/* Right: settings + preview */}
        <div className="space-y-4">
          {/* Schedule */}
          <div className="card p-5 space-y-3">
            <h3 className="section-title">Schedule & Rate</h3>
            <div>
              <label className="label">Schedule (leave empty to send immediately)</label>
              <input type="datetime-local" className="input" value={form.scheduledAt} onChange={f('scheduledAt')} />
            </div>
            <div>
              <label className="label">Send Rate (emails/hour)</label>
              <input type="number" min="10" max="10000" className="input" value={form.sendRatePerHour} onChange={f('sendRatePerHour')} />
            </div>
          </div>

          {/* Tracking */}
          <div className="card p-5 space-y-3">
            <h3 className="section-title">Tracking</h3>
            {[['trackOpens','Track Opens (1×1 pixel)'],['trackClicks','Track Clicks (URL proxy)']].map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[field as keyof CampaignForm] as boolean} onChange={f(field as keyof CampaignForm)} className="rounded accent-brand-500" />
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>

          {/* Preview panel */}
          {previewMode && form.htmlBody && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="section-title">Preview</h3>
                <button onClick={() => setPreviewMode(null)} className="btn-ghost text-xs">Close</button>
              </div>
              <div className={`border border-slate-700 rounded-lg overflow-hidden bg-white ${previewMode === 'mobile' ? 'max-w-[375px] mx-auto' : 'w-full'}`}>
                <iframe
                  srcDoc={form.htmlBody}
                  className="w-full"
                  style={{ height: previewMode === 'mobile' ? '600px' : '400px', border: 'none' }}
                  title="Email preview"
                  sandbox="allow-same-origin"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                {previewMode === 'mobile' ? '📱 Mobile preview (375px)' : '🖥️ Desktop preview'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
