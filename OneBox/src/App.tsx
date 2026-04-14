import { useState, useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import Layout from './components/Layout'
import Proyectos from './components/Projects'
import Inteligencia from './components/Intelligence'
import ProjectWizard from './components/ProjectWizard'
import ConectarGmail from './components/GmailConection'
import LandingPage from './components/Landingpage'
import FloatChat from './components/FloatChat'
import { setUserId, setUserEmail } from './services/api'

export type PageType = 'proyectos' | 'inteligencia' | 'centro-ordenes' | 'wizard' | 'conectar-gmail'

export default function App() {
  const auth = useAuth()
  const [currentPage, setCurrentPage] = useState<PageType>('proyectos')
  const [gmailConectado, setGmailConectado] = useState(false)
  const [checkingGmail, setCheckingGmail] = useState(true)

  const isPreview = window.location.search.includes('preview=true')

  if (auth.isAuthenticated && auth.user?.profile?.sub) {
    setUserId(auth.user.profile.sub)
    if (auth.user.profile.email) setUserEmail(auth.user.profile.email as string)
    localStorage.setItem('onebox_user_id', auth.user.profile.sub)
    if (auth.user.profile.email) localStorage.setItem('onebox_user_email', auth.user.profile.email as string)
    if (auth.user.profile.name) localStorage.setItem('onebox_user_name', auth.user.profile.name as string)
  }

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.profile?.sub) {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      fetch(`${API_URL}/api/gmail/status`, {
        headers: { 'x-user-id': auth.user.profile.sub }
      })
        .then(res => res.json())
        .then(data => {
          if (data.connected) {
            setGmailConectado(true)
          } else {
            setCurrentPage('conectar-gmail')
          }
          setCheckingGmail(false)
        })
        .catch(() => setCheckingGmail(false))
    } else {
      setCheckingGmail(false)
    }
  }, [auth.isAuthenticated, auth.user?.profile?.sub])

  useEffect(() => {
    if (auth.isAuthenticated && window.location.search && !isPreview) {
      if (window.location.search.includes('gmail=connected')) {
        setGmailConectado(true)
        setCurrentPage('proyectos')
      }
      window.history.replaceState({}, document.title, '/')
    }
  }, [auth.isAuthenticated, isPreview])

  if (!isPreview) {
    if (auth.isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0B14]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white/50">Conectando...</p>
          </div>
        </div>
      )
    }

    if (auth.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0B14]">
          <div className="text-center p-8 bg-[#12121E] rounded-2xl border border-white/10 max-w-md">
            <p className="text-red-400 mb-4">Error: {auth.error.message}</p>
            <button
              onClick={() => auth.signinRedirect()}
              className="px-6 py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-500 transition-colors"
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      )
    }

    if (!auth.isAuthenticated) {
      return <LandingPage onGetStarted={() => auth.signinRedirect()} />
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'proyectos':
        return <Proyectos onNavigate={setCurrentPage} gmailConectado={gmailConectado} />
      case 'inteligencia':
        return <Inteligencia />
      case 'wizard':
        return <ProjectWizard onNavigate={setCurrentPage} />
      case 'conectar-gmail':
        return <ConectarGmail onNavigate={setCurrentPage} onConectado={() => setGmailConectado(true)} gmailConectado={gmailConectado} />
      case 'centro-ordenes':
        return (
          <div className="flex items-center justify-center h-[calc(100vh-56px)]">
            <div className="text-center">
              <div className="text-4xl mb-4">🚧</div>
              <h2 className="text-xl font-bold text-white">Centro de Órdenes</h2>
              <p className="text-white/50 mt-2">Próximamente</p>
            </div>
          </div>
        )
      default:
        return <Proyectos onNavigate={setCurrentPage} gmailConectado={gmailConectado} />
    }
  }

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={setCurrentPage} onNewProject={() => setCurrentPage('wizard')}>
        {renderPage()}
      </Layout>
      <FloatChat />
    </>
  )
}
