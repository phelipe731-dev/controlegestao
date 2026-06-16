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

export function AppShell() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const navItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: BarChart3, visible: true },
    { to: '/supporters', label: 'Apoiadores', icon: Vote, visible: true },
    { to: '/communications', label: 'Comunicacao', icon: MessageSquareShare, visible: true },
    { to: '/events', label: 'Eventos', icon: CalendarRange, visible: true },
    { to: '/territories', label: 'Territorios', icon: Map, visible: true },
    { to: '/leaders', label: 'Lideres', icon: Users, visible: user?.role !== 'LEADER' },
    { to: '/supervisors', label: 'Supervisores', icon: ShieldCheck, visible: user?.role !== 'LEADER' },
    { to: '/reports', label: 'Relatorios', icon: FileText, visible: true },
    { to: '/settings', label: 'Configuracoes', icon: Settings, visible: true },
    { to: '/account', label: 'Minha conta', icon: UserSquare2, visible: true },
  ]

  const pageTitles: Record<string, string> = {
    '/': 'Visao geral da operacao',
    '/supporters': 'Gestao de apoiadores',
    '/communications': 'Central de comunicacao',
    '/events': 'Agenda e mobilizacao',
    '/territories': 'Mapa territorial',
    '/leaders': 'Rede de liderancas',
    '/supervisors': 'Supervisao regional',
    '/reports': 'Relatorios e exportacoes',
    '/settings': 'Governanca e seguranca',
    '/account': 'Minha conta',
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[300px_1fr]">
      <div className="fixed left-4 top-4 z-40 lg:hidden">
        <button type="button" onClick={() => setOpen((current) => !current)} className="button-secondary shadow-glow">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <aside
        className={`${
          open ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-30 flex w-[300px] flex-col bg-ink px-6 py-8 text-white transition lg:translate-x-0`}
      >
        <Link to="/" className="mb-10 block">
          <div className="text-xs uppercase tracking-[0.25em] text-white/60">CampanhaHub</div>
          <div className="mt-2 font-display text-3xl font-bold">Operacao de Campo</div>
          <div className="mt-3 text-sm text-white/70">Cadastro, LGPD e gestao por lideranca.</div>
        </Link>

        <nav className="space-y-2">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white text-ink shadow-glow'
                        : 'text-white/78 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
        </nav>

        <div className="mt-auto rounded-3xl border border-white/10 bg-white/10 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Sessao</div>
          <div className="mt-2 font-semibold">{user?.name}</div>
          <div className="text-sm text-white/70">{user?.email}</div>
          <div className="mt-1 text-xs text-white/50">Perfil: {user?.role}</div>
          <button type="button" onClick={logout} className="button-secondary mt-5 w-full border-white/20 bg-transparent text-white hover:bg-white/10">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {open ? <button type="button" className="fixed inset-0 z-20 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} /> : null}

      <main className="min-h-screen px-4 pb-10 pt-20 lg:col-start-2 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.25em] text-slate-500">Plataforma interna</div>
              <h1 className="mt-2 font-display text-3xl font-bold text-ink">
                {pageTitles[location.pathname] ?? location.pathname.replace('/', '').replace(/-/g, ' ')}
              </h1>
            </div>
            <div className="rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-right shadow-glow">
              <div className="text-sm text-slate-500">Auditoria e consentimento ativos</div>
              <div className="font-semibold text-ink">LGPD monitorada por perfil</div>
            </div>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
