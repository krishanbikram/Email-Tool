import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { Users, Plus, Upload, ChevronRight, UserX, Tag } from 'lucide-react'
import api from '../lib/api'

export default function ContactsPage() {
  const qc = useQueryClient()
  const [selectedList, setSelectedList] = useState<string | null>(null)
  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({ email: '', firstName: '', lastName: '', company: '' })
  const [uploading, setUploading] = useState(false)
  const [page, setPage] = useState(1)

  const { data: lists } = useQuery({
    queryKey: ['contact-lists'],
    queryFn: () => api.get('/contacts/lists').then(r => r.data),
  })

  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', selectedList, page],
    queryFn: () => api.get('/contacts', { params: { listId: selectedList, page, limit: 50 } }).then(r => r.data),
    enabled: !!selectedList,
  })

  const createList = useMutation({
    mutationFn: (name: string) => api.post('/contacts/lists', { name }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['contact-lists'] })
      setShowNewList(false); setNewListName('')
      setSelectedList(res.data.id)
      toast.success('List created')
    },
  })

  const addContact = useMutation({
    mutationFn: (data: typeof newContact) => api.post('/contacts', { ...data, listId: selectedList }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setShowAddContact(false)
      setNewContact({ email: '', firstName: '', lastName: '', company: '' })
      toast.success('Contact added')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to add contact'),
  })

  const onDrop = useCallback(async (files: File[]) => {
    if (!selectedList || !files[0]) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', files[0])
    formData.append('listId', selectedList)
    try {
      const { data } = await api.post('/contacts/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['contact-lists'] })
      toast.success(`Imported ${data.imported} contacts (${data.duplicates} duplicates)`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Import failed')
    } finally {
      setUploading(false)
    }
  }, [selectedList, qc])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'] }, disabled: !selectedList || uploading,
  })

  const statusColor: Record<string, string> = {
    ACTIVE: 'badge-green', BOUNCED: 'badge-red', UNSUBSCRIBED: 'badge-slate', SPAM_COMPLAINT: 'badge-yellow',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage contact lists and subscribers</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Lists sidebar */}
        <div className="col-span-12 md:col-span-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-300">Lists</h3>
            <button onClick={() => setShowNewList(true)} className="btn-ghost p-1.5"><Plus size={14} /></button>
          </div>

          {showNewList && (
            <div className="card p-3 space-y-2">
              <input className="input text-xs py-1.5" placeholder="List name…" value={newListName} onChange={e => setNewListName(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && newListName.trim()) createList.mutate(newListName.trim()) }} />
              <div className="flex gap-2">
                <button className="btn-primary text-xs py-1 flex-1" onClick={() => newListName.trim() && createList.mutate(newListName.trim())} disabled={createList.isPending}>Create</button>
                <button className="btn-secondary text-xs py-1" onClick={() => setShowNewList(false)}>Cancel</button>
              </div>
            </div>
          )}

          {(lists || []).map((l: any) => (
            <button key={l.id} onClick={() => { setSelectedList(l.id); setPage(1) }}
              className={`w-full text-left card p-3 transition-all duration-150 hover:border-slate-700 cursor-pointer ${selectedList === l.id ? 'border-brand-500/40 bg-brand-500/5' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200 truncate">{l.name}</span>
                <ChevronRight size={13} className="text-slate-500 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Users size={11} className="text-slate-500" />
                <span className="text-xs text-slate-500">{l._count?.contacts || 0} contacts</span>
              </div>
            </button>
          ))}
        </div>

        {/* Contacts table */}
        <div className="col-span-12 md:col-span-9 space-y-4">
          {selectedList ? (
            <>
              {/* Actions bar */}
              <div className="flex items-center gap-3">
                <div {...getRootProps()} className={`flex-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${isDragActive ? 'border-brand-500 bg-brand-500/5' : 'border-slate-700 hover:border-slate-600'}`}>
                  <input {...getInputProps()} />
                  <div className="flex items-center justify-center gap-2">
                    <Upload size={14} className="text-slate-400" />
                    <span className="text-xs text-slate-400">{uploading ? 'Importing…' : isDragActive ? 'Drop CSV here' : 'Drag & drop CSV or click to upload'}</span>
                  </div>
                </div>
                <button onClick={() => setShowAddContact(true)} className="btn-primary flex-shrink-0" id="add-contact-btn">
                  <Plus size={14} /> Add Contact
                </button>
              </div>

              {showAddContact && (
                <div className="card p-4">
                  <h4 className="text-sm font-semibold text-slate-200 mb-3">Add Contact</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[['email','Email *'],['firstName','First Name'],['lastName','Last Name'],['company','Company']].map(([f,p]) => (
                      <div key={f}>
                        <input className="input text-xs" placeholder={p} value={newContact[f as keyof typeof newContact]} onChange={e => setNewContact(prev => ({ ...prev, [f]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="btn-primary text-xs" onClick={() => addContact.mutate(newContact)} disabled={!newContact.email || addContact.isPending}>Save</button>
                    <button className="btn-secondary text-xs" onClick={() => setShowAddContact(false)}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Email</th><th>Name</th><th>Company</th><th>Tags</th><th>Status</th></tr></thead>
                  <tbody>
                    {loadingContacts ? (
                      <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading…</td></tr>
                    ) : contacts?.data?.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-slate-500">No contacts in this list. Upload a CSV or add manually.</td></tr>
                    ) : contacts?.data?.map((c: any) => (
                      <tr key={c.id}>
                        <td className="font-mono text-xs">{c.email}</td>
                        <td>{[c.firstName, c.lastName].filter(Boolean).join(' ') || '—'}</td>
                        <td className="text-slate-400">{c.company || '—'}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {c.tags?.map((t: string) => <span key={t} className="badge-slate text-xs">{t}</span>)}
                          </div>
                        </td>
                        <td><span className={statusColor[c.status] || 'badge-slate'}>{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {contacts && contacts.total > 50 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{contacts.total} total</span>
                  <div className="flex gap-2">
                    <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                    <button className="btn-secondary text-xs" disabled={page * 50 >= contacts.total} onClick={() => setPage(p => p + 1)}>Next</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-12 text-center">
              <Users size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Select a list to view contacts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
