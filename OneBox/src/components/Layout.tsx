import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import { Plus, LogOut } from 'lucide-react'
import { PageType } from '../App'
import NotificationsPanel from './NotificationsPanel'
import Logo from './Logo'
import LocaleSwitcher from './LocaleSwitcher'
import { clearUserSession } from '../services/api'

interface LayoutProps {
  children: ReactNode
  currentPage: PageType
  onNavigate: (page: PageType) => void
  onNewProject?: () => void
  isPlatformAdmin?: boolean
}

export default function Layout({ children, currentPage, onNavigate, onNewProject, isPlatformAdmin }: LayoutProps) {
  const auth = useAuth()
  const { t } = useTranslation()

  const userEmail = auth.user?.profile?.email || ''
  const userName = auth.user?.profile?.name ||
                  auth.user?.profile?.given_name ||
                  auth.user?.profile?.preferred_username ||
                  userEmail.split('@')[0] ||
                  'User'
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  function handleLogout() {
    const domain = import.meta.env.VITE_COGNITO_DOMAIN
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    const logoutUri = import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173'
    // Clear the ENTIRE local session before redirecting
    clearUserSession()
    auth.removeUser()
    window.location.href = `https://${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`
  }

  const navItems: { id: PageType; label: string }[] = [
    { id: 'projects', label: t('nav.projects', 'Projects') },
    { id: 'intelligence', label: t('nav.intelligence', 'Intelligence') },
    { id: 'integrations', label: t('nav.integrations', 'Integrations') },
    // The "Organizations" tab is only added if the user is a super admin.
    // The backend still guards each /api/platform/* with 403.
    ...(isPlatformAdmin ? [{ id: 'platform' as PageType, label: t('nav.organizations', 'Organizations') }] : []),
  ]

  return (
    <div className="min-h-screen bg-[#0B0B14]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#12121E]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-full mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center cursor-pointer" onClick={() => onNavigate('projects')}>
              <Logo variant="dark" size="sm" />
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => {
                const isActive = currentPage === item.id || (item.id === 'projects' && currentPage === 'wizard')
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/10 text-white border border-white/10'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </nav>

            <div className="flex items-center gap-3">
              {currentPage === 'projects' && onNewProject && (
                <button
                  onClick={onNewProject}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {t('common.newProject', 'New project')}
                </button>
              )}
              <NotificationsPanel onOpen={() => onNavigate('notifications')} />

              {/* Language switcher — persisted in localStorage. */}
              <LocaleSwitcher />

              <div className="flex items-center gap-2.5 pl-3 border-l border-white/10">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {userInitials}
                </div>
                <span className="hidden md:block text-sm font-medium text-white/80">
                  {userName}
                </span>
                <button
                  onClick={handleLogout}
                  className="ml-1 p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition-all"
                  title={t('common.logout', 'Sign out')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#12121E]/95 backdrop-blur-xl border-t border-white/5">
        <div className="flex items-center justify-around py-2">
          {navItems.map(item => {
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  isActive ? 'text-emerald-400' : 'text-white/40'
                }`}
              >
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <main className="pt-20">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}

