import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Mail, 
  CheckCircle, 
  Shield, 
  Eye,
  Loader2,
  ArrowRight,
  RefreshCw,
  Inbox,
  Settings
} from 'lucide-react'
import { PageType } from '../App'

interface ConectarGmailProps {
  onNavigate: (page: PageType) => void
  onConectado: () => void
  gmailConectado: boolean
}

export default function ConectarGmail({ onNavigate, onConectado, gmailConectado }: ConectarGmailProps) {
  const [conectando, setConectando] = useState(false)
  const [paso, setPaso] = useState<'inicio' | 'permisos' | 'conectado'>('inicio')

  const handleConectar = async () => {
    setConectando(true)
    setPaso('permisos')

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const userId = localStorage.getItem('onebox_user_id') || ''
      const response = await fetch(`${API_URL}/api/gmail/auth`, {
        headers: { 'x-user-id': userId }
      })
      const data = await response.json()

      if (data.auth_url) {
        window.location.href = data.auth_url
      } else {
        setPaso('inicio')
        setConectando(false)
      }
    } catch (error) {
      console.error('Error connecting Gmail:', error)
      setPaso('inicio')
      setConectando(false)
    }
  }

  const permisos = [
    { icon: Eye, texto: 'Ver tus correos electrónicos', descripcion: 'Para analizar el contenido y detectar proyectos' },
    { icon: Inbox, texto: 'Acceder a tu bandeja de entrada', descripcion: 'Para leer y organizar los mensajes' },
    { icon: Shield, texto: 'Solo lectura', descripcion: 'No modificaremos ni enviaremos correos' },
  ]

  if (gmailConectado) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm"
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Gmail Conectado</h2>
            <p className="text-slate-600 mb-6">Tu cuenta de Gmail está vinculada correctamente</p>
            
            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-slate-900 font-medium">usuario@gmail.com</p>
                    <p className="text-sm text-slate-500">Última sincronización: Hace 5 min</p>
                  </div>
                </div>
                <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => onNavigate('proyectos')}
                className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
              >
                Ver Bandeja
                <ArrowRight className="w-5 h-5" />
              </button>
              <button className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all border border-slate-200">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Conectar Gmail</h1>
          <p className="text-slate-600 mt-2">Vincula tu cuenta de Gmail para comenzar el análisis inteligente</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
        >
          {paso === 'inicio' && (
            <div className="p-8">
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-200 to-indigo-200 rounded-3xl animate-pulse"></div>
                <div className="absolute inset-2 bg-white rounded-2xl flex items-center justify-center border border-slate-200">
                  <Mail className="w-16 h-16 text-violet-600" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-slate-900 text-center mb-4">
                Conecta tu cuenta de Gmail
              </h2>
              <p className="text-slate-600 text-center mb-8">
                OneBox analizará tus correos de forma segura para identificar proyectos, 
                personas y relaciones automáticamente.
              </p>

              <div className="space-y-3 mb-8">
                {permisos.map((permiso, i) => {
                  const Icon = permiso.icon
                  return (
                    <div 
                      key={i}
                      className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-slate-900 font-medium">{permiso.texto}</p>
                        <p className="text-sm text-slate-500">{permiso.descripcion}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-8">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-emerald-700 font-medium">Conexión 100% segura</p>
                    <p className="text-sm text-emerald-600 mt-1">
                      Usamos OAuth 2.0 de Google. Nunca almacenamos tu contraseña y puedes 
                      revocar el acceso en cualquier momento.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConectar}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Conectar con Google
              </button>
            </div>
          )}

          {paso === 'permisos' && (
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Conectando con Gmail...</h2>
              <p className="text-slate-600">Autorizando permisos de solo lectura</p>
              
              <div className="mt-8 space-y-3">
                {['Verificando credenciales', 'Solicitando permisos', 'Estableciendo conexión'].map((paso, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.5 }}
                    className="flex items-center gap-3 justify-center text-slate-600"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    {paso}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {paso === 'conectado' && (
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </motion.div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">¡Conectado exitosamente!</h2>
              <p className="text-slate-600 mb-8">Tu cuenta de Gmail está lista para ser analizada</p>
              
              <button
                onClick={() => onNavigate('proyectos')}
                className="w-full py-4 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
              >
                Ir a Proyectos
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </motion.div>

        {paso === 'inicio' && (
          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Preguntas frecuentes</h3>
            {[
              { pregunta: '¿Mis correos están seguros?', respuesta: 'Sí, usamos encriptación de extremo a extremo y nunca compartimos tus datos.' },
              { pregunta: '¿Puedo desconectar Gmail?', respuesta: 'Sí, puedes revocar el acceso en cualquier momento desde la configuración.' },
              { pregunta: '¿Qué datos se analizan?', respuesta: 'Solo analizamos remitente, asunto y contenido para detectar proyectos y relaciones.' },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <p className="text-slate-900 font-medium">{faq.pregunta}</p>
                <p className="text-sm text-slate-600 mt-1">{faq.respuesta}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}