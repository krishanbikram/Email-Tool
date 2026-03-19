import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Globe, Users, Mail, Thermometer,
  FileText, Settings, LogOut, Zap, AlertTriangle, UserCog
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/domains', icon: Globe, label: 'Domains & SMTP' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/campaigns', icon: Mail, label: 'Campaigns' },
  { to: '/warmup', icon: Thermometer, label: 'Warmup Engine' },
  { to: '/bounces', icon: AlertTriangle, label: 'Bounces' },
  { to: '/logs', icon: FileText, label: 'Email Logs' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

const adminNavItems = [
  { to: '/users', icon: UserCog, label: 'Users' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/25">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-sm leading-none">MailFlow Pro</div>
              <div className="text-xs text-slate-500 mt-0.5">Email Platform</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
          {user?.role === 'ADMIN' && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs text-slate-600 uppercase tracking-wider font-semibold">Admin</div>
              {adminNavItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-brand-400">
                {(user?.name || user?.email || '?')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate">{user?.name || user?.email}</div>
              <div className="text-xs text-slate-500 capitalize">{user?.role?.toLowerCase()}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
