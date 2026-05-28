import { useState, useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import Layout from './components/Layout'
import Proyectos from './components/Projects'
import Inteligencia from './components/Intelligence'
import ProjectWizard, { InitialDocumentDraft } from './components/ProjectWizard'
import ConectarGmail from './components/GmailConection'
import LandingPage from './components/Landingpage'
import OnboardingForm, { PendingProject } from './components/OnboardingForm'
import LoginPage from './components/LoginPage'
import FloatChat from './components/FloatChat'
import { setUserId, setUserEmail, getUserId, clearUserSession, api } from './services/api'

const PENDING_PROJECT_KEY = 'onebox_pending_project'

export type PageType = 'proyectos' | 'inteligencia' | 'centro-ordenes' | 'wizard' | 'conectar-gmail'

export default function App() {
  const auth = useAuth()
  const [currentPage, setCurrentPage] = useState<PageType>('proyectos')
  const [gmailConectado, setGmailConectado] = useState(false)
  const [checkingGmail, setCheckingGmail] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [creatingPending, setCreatingPending] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<InitialDocumentDraft | null>(null)
  
  const [projectsResetSignal, setProjectsResetSignal] = useState(0)

  const handleNavigate = (page: PageType) => {
    if (page === currentPage && page === 'proyectos') {
      setProjectsResetSignal(prev => prev + 1)
    } else {
      setCurrentPage(page)
    }
  }

  const isPreview = window.location.search.includes('preview=true')

 
  if (auth.isAuthenticated && auth.user?.profile?.sub) {
    const newUserId = auth.user.profile.sub
    const storedUserId = getUserId()
    if (storedUserId !== newUserId) {
      if (storedUserId) {
        console.warn('[App] Cambio de usuario detectado, limpiando sesión anterior')
        clearUserSession()
      }
      setUserId(newUserId)
      const newUserEmail = (auth.user.profile.email as string) || ''
      if (newUserEmail) setUserEmail(newUserEmail)
      const newUserName = (auth.user.profile.name as string) || ''
      if (newUserName) {
        try { localStorage.setItem('onebox_user_name', newUserName) } catch { /* private mode */ }
      }
    }
  }

  useEffect(() => {
    const handlePendingProject = async () => {
      console.log('[pending project] Auth check:', { isAuthenticated: auth.isAuthenticated, userId: auth.user?.profile?.sub })
      if (!auth.isAuthenticated || !auth.user?.profile?.sub) return
      const raw = localStorage.getItem(PENDING_PROJECT_KEY)
      console.log('[pending project] Found in localStorage:', !!raw)
      if (!raw) return
      try {
        const pending: PendingProject = JSON.parse(raw)
        console.log('[pending project] Parsed pending project:', pending)
        const token = auth.user.access_token || ''
        const userId = auth.user.profile.sub
        console.log('[pending project] Token available:', !!token)

        setCreatingPending(true)

        if (pending.documentBase64 && pending.documentName) {
          console.log('[pending project] Processing document for review:', pending.documentName)
          try {
            const binaryStr = atob(pending.documentBase64)
            const bytes = new Uint8Array(binaryStr.length)
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
            const blob = new Blob([bytes], { type: pending.documentContentType || 'application/octet-stream' })
            const file = new File([blob], pending.documentName, { type: pending.documentContentType || 'application/octet-stream' })

            api.analyzeDocumentPreview(file, { userId, token })
              .then((res) => {
                console.log('[pending project] Documento analizado, draft:', res?.draftId)
                localStorage.removeItem(PENDING_PROJECT_KEY)
                setPendingDraft({
                  draftId: res.draftId,
                  fileName: res.fileName,
                  fileSize: res.fileSize,
                  extractedTextLength: res.extractedTextLength,
                  suggestion: res.suggestion,
                })
                setCurrentPage('wizard')
              })
              .catch(err => {
                console.error('[pending project] Error analizando documento:', err)
                localStorage.removeItem(PENDING_PROJECT_KEY)
                setCurrentPage('proyectos')
              })
              .finally(() => {
                setCreatingPending(false)
              })
          } catch (decodeErr) {
            console.error('[pending project] Error decoding document:', decodeErr)
            localStorage.removeItem(PENDING_PROJECT_KEY)
            setCreatingPending(false)
          }
          return
        }

        if (pending.pastedText && pending.pastedText.trim().length >= 50) {
          console.log('[pending project] Processing pasted text for review:', pending.pastedText.length, 'chars')
          api.analyzeTextPreview(
            { text: pending.pastedText, source: pending.pastedSource || 'paste' },
            token
          )
            .then((res) => {
              console.log('[pending project] Texto analizado, draft:', res?.draftId)
              localStorage.removeItem(PENDING_PROJECT_KEY)
              setPendingDraft({
                draftId: res.draftId,
                fileName: res.fileName,
                fileSize: res.fileSize,
                extractedTextLength: res.extractedTextLength,
                suggestion: res.suggestion,
              })
              setCurrentPage('wizard')
            })
            .catch(err => {
              console.error('[pending project] Error analizando texto:', err)
              localStorage.removeItem(PENDING_PROJECT_KEY)
              setCurrentPage('proyectos')
            })
            .finally(() => {
              setCreatingPending(false)
            })
          return
        }

        const whatsappParticipants = (pending.whatsappNumbers || []).map(phoneNumber => ({
          nombre: phoneNumber,
          email: '',
          telefono: phoneNumber,
          rol: 'Contacto WhatsApp'
        }))
        const emailParticipants = (pending.emails || []).map(email => ({
          nombre: email.split('@')[0],
          email: email,
          telefono: '',
          rol: 'Contacto Email'
        }))
        const participants = [...emailParticipants, ...whatsappParticipants]

        api.createProject({
          name: pending.name,
          description: pending.description,
          type: pending.type,
          channels: pending.channels,
          participants: participants,
        }, token)
          .then(() => console.log('[pending project] Project created successfully'))
          .catch(err => console.error('[pending project] error creando proyecto:', err))
          .finally(() => {
            console.log('[pending project] Cleanup: removing from localStorage and navigating')
            localStorage.removeItem(PENDING_PROJECT_KEY)
            setCreatingPending(false)
            setCurrentPage('proyectos')
          })
      } catch (e) {
        console.error('[pending project] payload inválido:', e)
        localStorage.removeItem(PENDING_PROJECT_KEY)
      }
    }

    handlePendingProject()
  }, [auth.isAuthenticated, auth.user?.profile?.sub])

  const handleOnboardingSubmit = (data: PendingProject) => {
    localStorage.setItem(PENDING_PROJECT_KEY, JSON.stringify(data))
    auth.signinRedirect()
  }

  useEffect(() => {
    if (auth.isAuthenticated && auth.user?.profile?.sub) {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      fetch(`${API_URL}/api/gmail/status`, {
        headers: { 'x-user-id': auth.user.profile.sub }
      })
        .then(res => res.json())
        .then(data => {
          
          setGmailConectado(!!data.connected)
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
      if (showLogin) {
        return <LoginPage />
      }
      if (showOnboarding) {
        return (
          <OnboardingForm
            onBack={() => setShowOnboarding(false)}
            onSubmit={handleOnboardingSubmit}
            onLoginInstead={() => setShowLogin(true)}
          />
        )
      }
      return (
        <LandingPage
          onGetStarted={() => setShowOnboarding(true)}
          onLogin={() => setShowLogin(true)}
        />
      )
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'proyectos':
        return <Proyectos onNavigate={setCurrentPage} gmailConectado={gmailConectado} resetSignal={projectsResetSignal} />
      case 'inteligencia':
        return <Inteligencia />
      case 'wizard':
        return (
          <ProjectWizard
            onNavigate={setCurrentPage}
            initialDraft={pendingDraft}
            onWizardClose={() => setPendingDraft(null)}
          />
        )
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
        return <Proyectos onNavigate={setCurrentPage} gmailConectado={gmailConectado} resetSignal={projectsResetSignal} />
    }
  }

  return (
    <>
      <Layout currentPage={currentPage} onNavigate={handleNavigate} onNewProject={() => setCurrentPage('wizard')}>
        {renderPage()}
      </Layout>
      <FloatChat />
    </>
  )
}
