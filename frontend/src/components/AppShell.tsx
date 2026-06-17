import {
  BarChart3,
  CalendarRange,
  MessageSquareShare,
  FileText,
  LogOut,
  Menu,
  Map,
  Settings,
  ShieldCheck,
  Users,
  UserSquare2,
  Vote,
  X,
  ChevronRight,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  visible: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

export function AppShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const navGroups: NavGroup[] = [
    {
      label: 'Principal',
      items: [
        { to: '/', label: 'Dashboard', icon: BarChart3, visible: true },
        { to: '/supporters', label: 'Apoiadores', icon: Vote, visible: true },
        { to: '/communications', label: 'Comunicação', icon: MessageSquareShare, visible: true },
        { to: '/events', label: 'Eventos', icon: CalendarRange, visible: true },
        { to: '/territories', label: 'Territórios', icon: Map, visible: true },
      ],
    },
    {
      label: 'Gestão',
      items: [
        { to: '/leaders', label: 'Líderes', icon: Users, visible: user?.role !== 'LEADER' },
        { to: '/supervisors', label: 'Supervisores', icon: ShieldCheck, visible: user?.role !== 'LEADER' },
        { to: '/reports', label: 'Relatórios', icon: FileText, visible: true },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { to: '/settings', label: 'Configurações', icon: Settings, visible: true },
        { to: '/account', label: 'Minha conta', icon: UserSquare2, visible: true },
      ],
    },
  ]

  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    '/': { title: 'Dashboard', subtitle: 'Visão geral da operação de campo' },
    '/supporters': { title: 'Apoiadores', subtitle: 'Gestão da base territorial' },
    '/communications': { title: 'Comunicação', subtitle: 'Central de mensagens e notificações' },
    '/events': { title: 'Eventos', subtitle: 'Agenda e mobilização' },
    '/territories': { title: 'Territórios', subtitle: 'Mapa territorial' },
    '/leaders': { title: 'Líderes', subtitle: 'Rede de lideranças' },
    '/supervisors': { title: 'Supervisores', subtitle: 'Supervisão regional' },
    '/reports': { title: 'Relatórios', subtitle: 'Exportações e análises' },
    '/settings': { title: 'Configurações', subtitle: 'Governança e segurança' },
    '/account': { title: 'Minha conta', subtitle: 'Dados pessoais e senha' },
  }

  const currentPage = pageTitles[location.pathname] ?? {
    title: location.pathname.replace('/', '').replace(/-/g, ' '),
    subtitle: '',
  }

  const roleLabel: Record<string, string> = {
    ADMIN: 'Administrador',
    SUPERVISOR: 'Supervisor',
    LEADER: 'Líder',
  }

  const Sidebar = () => (
    <aside className="flex h-full flex-col bg-sidebar text-white">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal font-display text-sm font-bold text-white">
          CH
        </div>
        <div>
          <div className="font-display text-sm font-bold leading-none text-white">CampanhaHub</div>
          <div className="mt-0.5 text-[10px] text-white/40 uppercase tracking-widest">Operação de campo</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => item.visible)
          if (visibleItems.length === 0) return null
          return (
            <div key={group.label} className="mb-5">
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-teal/20 text-teal'
                            : 'text-white/65 hover:bg-white/8 hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-teal' : 'text-white/40 group-hover:text-white/70'}`} />
                          <span className="flex-1">{item.label}</span>
                          {isActive && <ChevronRight className="h-3 w-3 text-teal/60" />}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-display text-xs font-bold text-white">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
            <div className="truncate text-xs text-white/45">{roleLabel[user?.role ?? ''] ?? user?.role}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sair"
            className="rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-card lg:hidden"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Sidebar — desktop */}
      <div className="hidden w-60 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-60">
          <Sidebar />
        </div>
      </div>

      {/* Sidebar — mobile overlay */}
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-60 lg:hidden">
            <Sidebar />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white px-6 shadow-sm">
          <div className="ml-10 lg:ml-0">
            <h1 className="font-display text-lg font-bold text-ink leading-none">{currentPage.title}</h1>
            {currentPage.subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{currentPage.subtitle}</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-medium text-teal sm:block">
              LGPD ativa
            </span>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
