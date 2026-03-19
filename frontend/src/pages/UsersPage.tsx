import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, Check, X, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'

interface UserForm {
  email: string
  name: string
  password: string
  role: string
}

const emptyForm: UserForm = { email: '', name: '', password: '', role: 'MANAGER' }

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'badge-red',
  MANAGER: 'badge-blue',
  VIEWER: 'badge-slate',
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<UserForm>>({})

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setForm(emptyForm)
      setShowForm(false)
      toast.success('User created')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create user'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserForm> }) => api.put(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditId(null)
      toast.success('User updated')
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted') },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete'),
  })

  const f = (field: keyof UserForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const startEdit = (u: any) => {
    setEditId(u.id)
    setEditForm({ name: u.name || '', role: u.role, password: '' })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage team members and their access levels</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary gap-1.5">
          <Plus size={15} /> Add User
        </button>
      </div>

      {/* Role legend */}
      <div className="card p-4 flex items-center gap-6 flex-wrap">
        <Shield size={14} className="text-slate-400" />
        {[
          { role: 'ADMIN', desc: 'Full access — manage users, settings, all campaigns' },
          { role: 'MANAGER', desc: 'Create & send campaigns, manage contacts/domains' },
          { role: 'VIEWER', desc: 'Read-only access to campaigns and logs' },
        ].map(({ role, desc }) => (
          <div key={role} className="flex items-center gap-2 text-xs text-slate-400">
            <span className={ROLE_BADGE[role]}>{role}</span>
            <span>{desc}</span>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5 space-y-4">
          <h3 className="section-title">New User</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" placeholder="user@example.com" value={form.email} onChange={f('email')} />
            </div>
            <div>
              <label className="label">Display Name</label>
              <input className="input" placeholder="Jane Smith" value={form.name} onChange={f('name')} />
            </div>
            <div>
              <label className="label">Password *</label>
              <input className="input" type="password" placeholder="Min 8 characters" value={form.password} onChange={f('password')} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={f('role')}>
                <option value="MANAGER">MANAGER</option>
                <option value="VIEWER">VIEWER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setForm(emptyForm) }} className="btn-secondary">Cancel</button>
            <button
              onClick={() => createMutation.mutate()}
              className="btn-primary"
              disabled={!form.email || !form.password || createMutation.isPending}
              id="create-user-btn"
            >
              {createMutation.isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-500">Loading…</div>
      ) : (
        <div className="card">
          <div className="table-wrapper rounded-none border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Name / Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(users || []).length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">No users found</td></tr>
                ) : (users || []).map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      {editId === u.id ? (
                        <input
                          className="input py-1 text-sm"
                          value={editForm.name || ''}
                          onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="Display name"
                        />
                      ) : (
                        <div>
                          <div className="font-medium text-slate-200">{u.name || '—'}</div>
                          <div className="text-xs font-mono text-slate-400">{u.email}</div>
                        </div>
                      )}
                    </td>
                    <td>
                      {editId === u.id ? (
                        <select
                          className="input py-1 text-sm w-auto"
                          value={editForm.role || 'MANAGER'}
                          onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                          disabled={u.id === me?.id}
                        >
                          <option value="MANAGER">MANAGER</option>
                          <option value="VIEWER">VIEWER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      ) : (
                        <span className={ROLE_BADGE[u.role] || 'badge-slate'}>{u.role}</span>
                      )}
                    </td>
                    <td className="text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {editId === u.id ? (
                          <>
                            <button
                              onClick={() => updateMutation.mutate({ id: u.id, data: editForm })}
                              className="btn-ghost p-1.5 text-green-400 hover:text-green-300"
                              disabled={updateMutation.isPending}
                            >
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditId(null)} className="btn-ghost p-1.5 text-slate-400">
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(u)} className="btn-ghost p-1.5 text-slate-400 hover:text-slate-200">
                              <Edit2 size={13} />
                            </button>
                            {u.id !== me?.id && (
                              <button
                                onClick={() => { if (confirm(`Delete user ${u.email}?`)) deleteMutation.mutate(u.id) }}
                                className="btn-ghost p-1.5 text-red-400 hover:text-red-300"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
