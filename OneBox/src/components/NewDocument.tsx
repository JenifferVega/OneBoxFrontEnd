import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft,
  FileText,
  CreditCard,
  Check,
  Plus,
  Trash2,
  Upload,
  User,
  Building,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Eye,
  Edit3,
  MapPin,
  Hash,
  Calendar,
  DollarSign,
  Home,
  Users,
  FileSearch,
  Sparkles
} from 'lucide-react'
import { PageType } from '../App'
import { useDocuments } from '../context/DocumentContext'
import { 
  TipoEscritura, 
  Persona, 
  TipoIdentificacion,
  DocumentoEscritura,
  DatosInmueble,
  DatosTradicion,
  DatosHipoteca
} from '../types'

interface NuevoDocumentoProps {
  onNavigate: (page: PageType) => void
}

type Paso = 1 | 2 | 3

interface ArchivoDocumento {
  id: string
  nombre: string
  archivo?: File
  requerido: boolean
  categoria: 'soporte' | 'vendedor' | 'comprador'
  personaId?: string
}

export default function NuevoDocumento({ onNavigate }: NuevoDocumentoProps) {
  const { agregarDocumento } = useDocuments()
  const [pasoActual, setPasoActual] = useState<Paso>(1)
  const [tipoEscritura, setTipoEscritura] = useState<TipoEscritura>('compraventa_simple')
  const [esPropiedadHorizontal, setEsPropiedadHorizontal] = useState(false)
  const [procesandoOCR, setProcesandoOCR] = useState(false)
  const [progresoOCR, setProgresoOCR] = useState(0)
  const [guardando, setGuardando] = useState(false)

  const [archivosSubidos, setArchivosSubidos] = useState<Record<string, File>>({})
  
  const [cantidadVendedores, setCantidadVendedores] = useState(1)
  const [cantidadCompradores, setCantidadCompradores] = useState(1)
  const [archivosVendedores, setArchivosVendedores] = useState<Record<string, File>>({})
  const [archivosCompradores, setArchivosCompradores] = useState<Record<string, File>>({})

  const [vendedores, setVendedores] = useState<Persona[]>([])
  const [compradores, setCompradores] = useState<Persona[]>([])
  const [datosInmueble, setDatosInmueble] = useState<DatosInmueble>({
    direccion: '',
    matriculaInmobiliaria: '',
    cedulaCatastral: '',
    oficinaRegistro: '',
    zona: '',
    linderos: '',
    areaPrivada: '',
    areaConstruida: '',
    esPropiedadHorizontal: false,
    coeficiente: '',
    nombreConjunto: ''
  })
  const [datosTradicion, setDatosTradicion] = useState<DatosTradicion>({
    vendedorAnterior: '',
    vendedorAnteriorCC: '',
    compradorAnterior: '',
    compradorAnteriorCC: '',
    numeroEscritura: '',
    fechaEscritura: '',
    notaria: '',
    ciudad: ''
  })
  const [datosHipoteca, setDatosHipoteca] = useState<DatosHipoteca>({
    entidadBancaria: '',
    numeroCartaCredito: '',
    montoCredito: 0,
    montoCreditoLetras: '',
    tasaInteres: '',
    plazo: ''
  })
  const [precioVenta, setPrecioVenta] = useState(0)
  const [precioVentaLetras, setPrecioVentaLetras] = useState('')

  const pasos = [
    { numero: 1, titulo: 'Carga de Documentos', descripcion: 'Sube los documentos fuente' },
    { numero: 2, titulo: 'Datos Extraídos', descripcion: 'Verifica y edita la información' },
    { numero: 3, titulo: 'Verificación Final', descripcion: 'Revisa antes de generar' },
  ]

  const tiposEscritura = [
    {
      id: 'compraventa_simple' as TipoEscritura,
      titulo: 'Compraventa Simple',
      descripcion: 'Venta entre particulares sin financiación bancaria',
      icon: FileText,
    },
    {
      id: 'compraventa_hipoteca' as TipoEscritura,
      titulo: 'Compraventa con Hipoteca',
      descripcion: 'Venta con financiación bancaria (crédito hipotecario)',
      icon: CreditCard,
      badge: 'Incluye hipoteca',
    },
  ]

  const documentosSoporte = [
    { 
      id: 'certificadoTradicion', 
      nombre: 'Certificado de Tradición y Libertad (CTL)', 
      requerido: true,
      descripcion: 'Matrícula inmobiliaria, linderos, tradición'
    },
    { 
      id: 'promesaCompraventa', 
      nombre: 'Promesa de Compraventa', 
      requerido: true,
      descripcion: 'Precio de venta acordado'
    },
    { 
      id: 'pazYSalvoPredial', 
      nombre: 'Paz y Salvo Predial', 
      requerido: true,
      descripcion: 'Estado de impuestos del predio'
    },
    { 
      id: 'pazYSalvoAdministracion', 
      nombre: 'Paz y Salvo de Administración', 
      requerido: esPropiedadHorizontal,
      descripcion: 'Solo para propiedad horizontal'
    },
    { 
      id: 'cartaCredito', 
      nombre: 'Carta de Crédito Bancaria', 
      requerido: tipoEscritura === 'compraventa_hipoteca',
      descripcion: 'Aprobación del crédito hipotecario'
    },
  ].filter(doc => doc.requerido || doc.id === 'pazYSalvoAdministracion' && esPropiedadHorizontal || doc.id === 'cartaCredito' && tipoEscritura === 'compraventa_hipoteca')

  const handleArchivoSoporte = (docId: string, archivo: File) => {
    setArchivosSubidos(prev => ({ ...prev, [docId]: archivo }))
  }

  const handleArchivoVendedor = (index: number, archivo: File) => {
    setArchivosVendedores(prev => ({ ...prev, [`vendedor_${index}`]: archivo }))
  }

  const handleArchivoComprador = (index: number, archivo: File) => {
    setArchivosCompradores(prev => ({ ...prev, [`comprador_${index}`]: archivo }))
  }

  const puedeAvanzarPaso1 = () => {
    const documentosRequeridos = documentosSoporte.filter(d => d.requerido)
    const todosSoporteSubidos = documentosRequeridos.every(doc => archivosSubidos[doc.id])
    const todosVendedoresSubidos = Array.from({ length: cantidadVendedores }).every((_, i) => archivosVendedores[`vendedor_${i}`])
    const todosCompradoresSubidos = Array.from({ length: cantidadCompradores }).every((_, i) => archivosCompradores[`comprador_${i}`])
    return todosSoporteSubidos && todosVendedoresSubidos && todosCompradoresSubidos
  }

  const simularExtraccionOCR = () => {
    setProcesandoOCR(true)
    setProgresoOCR(0)

    const intervalId = setInterval(() => {
      setProgresoOCR(prev => {
        if (prev >= 100) {
          clearInterval(intervalId)
          return 100
        }
        return prev + 10
      })
    }, 200)

    setTimeout(() => {
      setDatosInmueble({
        direccion: 'Carrera 15 No. 123-45, Apartamento 501, Bogotá D.C.',
        matriculaInmobiliaria: '050N-1234567',
        cedulaCatastral: '01-02-0123-0456-000',
        oficinaRegistro: 'Oficina de Registro de Instrumentos Públicos de Bogotá - Zona Norte',
        zona: 'Norte',
        linderos: 'NORTE: Colinda con el Apartamento 502 en una extensión de 8.50 metros\nSUR: Colinda con zona común de circulación en una extensión de 8.50 metros\nORIENTE: Colinda con fachada exterior del edificio en una extensión de 12.30 metros\nOCCIDENTE: Colinda con punto fijo de escaleras en una extensión de 12.30 metros',
        areaPrivada: '85.50',
        areaConstruida: '92.00',
        esPropiedadHorizontal,
        coeficiente: esPropiedadHorizontal ? '1.2345' : '',
        nombreConjunto: esPropiedadHorizontal ? 'Conjunto Residencial Torres del Norte P.H.' : ''
      })

      setDatosTradicion({
        vendedorAnterior: 'MARÍA ELENA LÓPEZ CASTRO',
        vendedorAnteriorCC: '98.765.432',
        compradorAnterior: 'JUAN CARLOS RODRÍGUEZ GÓMEZ',
        compradorAnteriorCC: '1.234.567.890',
        numeroEscritura: '1234',
        fechaEscritura: '10/03/2020',
        notaria: 'Notaría 45',
        ciudad: 'Bogotá D.C.'
      })

      const vendedoresExtraidos: Persona[] = Array.from({ length: cantidadVendedores }).map((_, i) => ({
        id: crypto.randomUUID(),
        nombres: i === 0 ? 'JUAN CARLOS' : `VENDEDOR ${i + 1}`,
        apellidos: i === 0 ? 'RODRÍGUEZ GÓMEZ' : 'APELLIDOS',
        tipoIdentificacion: 'cedula' as TipoIdentificacion,
        numeroIdentificacion: i === 0 ? '1.234.567.890' : '',
        lugarExpedicion: i === 0 ? 'Bogotá D.C.' : '',
        estadoCivil: '',
        direccionResidencia: '',
        telefono: '',
        email: '',
        confianzaOCR: i === 0 ? 95 : 0
      }))
      setVendedores(vendedoresExtraidos)

      const compradoresExtraidos: Persona[] = Array.from({ length: cantidadCompradores }).map((_, i) => ({
        id: crypto.randomUUID(),
        nombres: i === 0 ? 'PEDRO ANTONIO' : `COMPRADOR ${i + 1}`,
        apellidos: i === 0 ? 'MARTÍNEZ SILVA' : 'APELLIDOS',
        tipoIdentificacion: 'cedula' as TipoIdentificacion,
        numeroIdentificacion: i === 0 ? '52.987.654' : '',
        lugarExpedicion: i === 0 ? 'Medellín' : '',
        estadoCivil: '',
        direccionResidencia: '',
        telefono: '',
        email: '',
        confianzaOCR: i === 0 ? 92 : 0
      }))
      setCompradores(compradoresExtraidos)

      setPrecioVenta(450000000)
      setPrecioVentaLetras('CUATROCIENTOS CINCUENTA MILLONES DE PESOS M/CTE')

      if (tipoEscritura === 'compraventa_hipoteca') {
        setDatosHipoteca({
          entidadBancaria: 'Banco Davivienda S.A.',
          numeroCartaCredito: 'CRH-2024-001234',
          montoCredito: 350000000,
          montoCreditoLetras: 'TRESCIENTOS CINCUENTA MILLONES DE PESOS M/CTE',
          tasaInteres: '12.5% E.A.',
          plazo: '180 meses'
        })
      }

      setProcesandoOCR(false)
      setPasoActual(2)
    }, 2500)
  }

  const handleSiguiente = () => {
    if (pasoActual === 1) {
      simularExtraccionOCR()
    } else if (pasoActual === 2) {
      setPasoActual(3)
    }
  }

  const handleAnterior = () => {
    if (pasoActual > 1) {
      setPasoActual((pasoActual - 1) as Paso)
    }
  }

  const handleGuardar = () => {
    setGuardando(true)
    setTimeout(() => {
      const nuevoDocumento: DocumentoEscritura = {
        id: crypto.randomUUID(),
        titulo: `${tipoEscritura === 'compraventa_simple' ? 'Compraventa Simple' : 'Compraventa con Hipoteca'} - ${datosInmueble.matriculaInmobiliaria || 'Borrador'}`,
        tipoEscritura,
        estado: 'borrador',
        fechaCreacion: new Date(),
        fechaModificacion: new Date(),
        configuracion: { tipoEscritura, esPropiedadHorizontal },
        vendedores,
        compradores,
        datosInmueble,
        datosTradicion,
        datosHipoteca: tipoEscritura === 'compraventa_hipoteca' ? datosHipoteca : undefined,
        precioVenta,
        precioVentaLetras,
        documentosAdjuntos: {},
        tiempoGeneracion: Math.floor(Math.random() * 300) + 30,
      }
      agregarDocumento(nuevoDocumento)
      setGuardando(false)
      onNavigate('historial')
    }, 1500)
  }

  const actualizarVendedor = (index: number, campo: keyof Persona, valor: string) => {
    setVendedores(prev => prev.map((v, i) => 
      i === index ? { ...v, [campo]: valor } : v
    ))
  }

  const actualizarComprador = (index: number, campo: keyof Persona, valor: string) => {
    setCompradores(prev => prev.map((c, i) => 
      i === index ? { ...c, [campo]: valor } : c
    ))
  }

  const formatearPrecio = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor)
  }

  const renderPaso1 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Configuración Inicial</h2>
          <p className="text-slate-500 mt-1">Selecciona el tipo de escritura y configura el documento</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {tiposEscritura.map(tipo => {
            const Icon = tipo.icon
            const isSelected = tipoEscritura === tipo.id
            return (
              <button
                key={tipo.id}
                onClick={() => setTipoEscritura(tipo.id)}
                className={`
                  relative p-5 rounded-2xl border-2 text-left transition-all
                  ${isSelected 
                    ? 'border-primary bg-primary/5' 
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                  }
                `}
              >
                <div className="flex items-start gap-4">
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    ${isSelected ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}
                  `}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{tipo.titulo}</p>
                    <p className="text-sm text-slate-500 mt-1">{tipo.descripcion}</p>
                    {tipo.badge && (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700 rounded-full">
                        <CreditCard className="w-3 h-3" />
                        {tipo.badge}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <label className="flex items-start gap-4 cursor-pointer">
            <div className="pt-0.5">
              <input
                type="checkbox"
                checked={esPropiedadHorizontal}
                onChange={(e) => setEsPropiedadHorizontal(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary/20"
              />
            </div>
            <div>
              <p className="font-semibold text-slate-800">El inmueble es Propiedad Horizontal</p>
              <p className="text-sm text-slate-500 mt-1">
                Marque si pertenece a un conjunto, edificio o agrupación con régimen P.H.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Documentos de Soporte</h3>
            <p className="text-sm text-slate-500">Sube los documentos del inmueble y la transacción</p>
          </div>
        </div>

        <div className="grid gap-3">
          {documentosSoporte.map(doc => {
            const archivo = archivosSubidos[doc.id]
            return (
              <div
                key={doc.id}
                className="bg-white rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      ${archivo ? 'bg-emerald-50' : 'bg-slate-100'}
                    `}>
                      {archivo ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <FileText className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{doc.nombre}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {archivo ? archivo.name : doc.descripcion}
                      </p>
                    </div>
                  </div>
                  <label className="cursor-pointer flex-shrink-0 ml-3">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleArchivoSoporte(doc.id, file)
                      }}
                    />
                    <span className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${archivo 
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                        : 'bg-primary text-white hover:bg-primary-light'
                      }
                    `}>
                      <Upload className="w-4 h-4" />
                      {archivo ? 'Cambiar' : 'Cargar'}
                    </span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Cédulas de Vendedores</h3>
              <p className="text-sm text-slate-500">Documentos de identidad de la parte vendedora</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCantidadVendedores(Math.max(1, cantidadVendedores - 1))}
              disabled={cantidadVendedores <= 1}
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              -
            </button>
            <span className="w-8 text-center font-medium text-slate-700">{cantidadVendedores}</span>
            <button
              onClick={() => setCantidadVendedores(cantidadVendedores + 1)}
              className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {Array.from({ length: cantidadVendedores }).map((_, index) => {
            const archivo = archivosVendedores[`vendedor_${index}`]
            return (
              <div
                key={index}
                className="bg-white rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      ${archivo ? 'bg-emerald-50' : 'bg-amber-50'}
                    `}>
                      {archivo ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <User className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">Vendedor #{index + 1}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {archivo ? archivo.name : 'Cédula o Pasaporte (JPG/PDF)'}
                      </p>
                    </div>
                  </div>
                  <label className="cursor-pointer flex-shrink-0 ml-3">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleArchivoVendedor(index, file)
                      }}
                    />
                    <span className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${archivo 
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                      }
                    `}>
                      <Upload className="w-4 h-4" />
                      {archivo ? 'Cambiar' : 'Cargar'}
                    </span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                Cédulas de {tipoEscritura === 'compraventa_hipoteca' ? 'Compradores / Hipotecantes' : 'Compradores'}
              </h3>
              <p className="text-sm text-slate-500">Documentos de identidad de la parte compradora</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCantidadCompradores(Math.max(1, cantidadCompradores - 1))}
              disabled={cantidadCompradores <= 1}
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            >
              -
            </button>
            <span className="w-8 text-center font-medium text-slate-700">{cantidadCompradores}</span>
            <button
              onClick={() => setCantidadCompradores(cantidadCompradores + 1)}
              className="w-8 h-8 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {Array.from({ length: cantidadCompradores }).map((_, index) => {
            const archivo = archivosCompradores[`comprador_${index}`]
            return (
              <div
                key={index}
                className="bg-white rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      ${archivo ? 'bg-emerald-50' : 'bg-emerald-50'}
                    `}>
                      {archivo ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <User className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800">
                        {tipoEscritura === 'compraventa_hipoteca' ? 'Comprador/Hipotecante' : 'Comprador'} #{index + 1}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {archivo ? archivo.name : 'Cédula o Pasaporte (JPG/PDF)'}
                      </p>
                    </div>
                  </div>
                  <label className="cursor-pointer flex-shrink-0 ml-3">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleArchivoComprador(index, file)
                      }}
                    />
                    <span className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${archivo 
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'
                      }
                    `}>
                      <Upload className="w-4 h-4" />
                      {archivo ? 'Cambiar' : 'Cargar'}
                    </span>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-primary">Extracción automática con IA</p>
            <p className="text-sm text-slate-600 mt-1">
              Al continuar, el sistema extraerá automáticamente los datos de todos los documentos 
              usando OCR e inteligencia artificial. Podrás revisar y editar toda la información en el siguiente paso.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )

  const renderPaso2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-xl font-bold text-slate-800">Datos Extraídos</h2>
        <p className="text-slate-500 mt-1">
          Verifica y edita la información extraída de los documentos. Los campos con fondo verde tienen alta confianza.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Building className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Datos del Inmueble</h3>
              <p className="text-sm text-slate-500">Extraído del Certificado de Tradición y Libertad</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Matrícula Inmobiliaria
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={datosInmueble.matriculaInmobiliaria}
                  onChange={(e) => setDatosInmueble(prev => ({ ...prev, matriculaInmobiliaria: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Cédula Catastral
              </label>
              <input
                type="text"
                value={datosInmueble.cedulaCatastral}
                onChange={(e) => setDatosInmueble(prev => ({ ...prev, cedulaCatastral: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Dirección del Inmueble
            </label>
            <input
              type="text"
              value={datosInmueble.direccion}
              onChange={(e) => setDatosInmueble(prev => ({ ...prev, direccion: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Oficina de Registro
            </label>
            <input
              type="text"
              value={datosInmueble.oficinaRegistro}
              onChange={(e) => setDatosInmueble(prev => ({ ...prev, oficinaRegistro: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Área Privada (M²)
              </label>
              <input
                type="text"
                value={datosInmueble.areaPrivada}
                onChange={(e) => setDatosInmueble(prev => ({ ...prev, areaPrivada: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Área Construida (M²)
              </label>
              <input
                type="text"
                value={datosInmueble.areaConstruida}
                onChange={(e) => setDatosInmueble(prev => ({ ...prev, areaConstruida: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          {esPropiedadHorizontal && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  Nombre del Conjunto / Edificio
                </label>
                <input
                  type="text"
                  value={datosInmueble.nombreConjunto || ''}
                  onChange={(e) => setDatosInmueble(prev => ({ ...prev, nombreConjunto: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  Coeficiente de Copropiedad (%)
                </label>
                <input
                  type="text"
                  value={datosInmueble.coeficiente || ''}
                  onChange={(e) => setDatosInmueble(prev => ({ ...prev, coeficiente: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Linderos
            </label>
            <textarea
              value={datosInmueble.linderos}
              onChange={(e) => setDatosInmueble(prev => ({ ...prev, linderos: e.target.value }))}
              rows={5}
              className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Tradición del Inmueble</h3>
              <p className="text-sm text-slate-500">Última escritura registrada en el CTL</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Vendedor Anterior
              </label>
              <input
                type="text"
                value={datosTradicion.vendedorAnterior}
                onChange={(e) => setDatosTradicion(prev => ({ ...prev, vendedorAnterior: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                C.C. Vendedor Anterior
              </label>
              <input
                type="text"
                value={datosTradicion.vendedorAnteriorCC}
                onChange={(e) => setDatosTradicion(prev => ({ ...prev, vendedorAnteriorCC: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Comprador Anterior (Actual Propietario)
              </label>
              <input
                type="text"
                value={datosTradicion.compradorAnterior}
                onChange={(e) => setDatosTradicion(prev => ({ ...prev, compradorAnterior: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                C.C. Comprador Anterior
              </label>
              <input
                type="text"
                value={datosTradicion.compradorAnteriorCC}
                onChange={(e) => setDatosTradicion(prev => ({ ...prev, compradorAnteriorCC: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                No. Escritura
              </label>
              <input
                type="text"
                value={datosTradicion.numeroEscritura}
                onChange={(e) => setDatosTradicion(prev => ({ ...prev, numeroEscritura: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Fecha
              </label>
              <input
                type="text"
                value={datosTradicion.fechaEscritura}
                onChange={(e) => setDatosTradicion(prev => ({ ...prev, fechaEscritura: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Notaría
              </label>
              <input
                type="text"
                value={datosTradicion.notaria}
                onChange={(e) => setDatosTradicion(prev => ({ ...prev, notaria: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                Ciudad
              </label>
              <input
                type="text"
                value={datosTradicion.ciudad}
                onChange={(e) => setDatosTradicion(prev => ({ ...prev, ciudad: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Parte Vendedora</h3>
              <p className="text-sm text-slate-500">Datos extraídos de las cédulas</p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {vendedores.map((vendedor, index) => (
            <div key={vendedor.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-600">Vendedor #{index + 1}</span>
                {vendedor.confianzaOCR && vendedor.confianzaOCR > 80 && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    {vendedor.confianzaOCR}% confianza
                  </span>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Nombres</label>
                  <input
                    type="text"
                    value={vendedor.nombres}
                    onChange={(e) => actualizarVendedor(index, 'nombres', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      vendedor.confianzaOCR && vendedor.confianzaOCR > 80 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Apellidos</label>
                  <input
                    type="text"
                    value={vendedor.apellidos}
                    onChange={(e) => actualizarVendedor(index, 'apellidos', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      vendedor.confianzaOCR && vendedor.confianzaOCR > 80 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-slate-200'
                    }`}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Tipo ID</label>
                  <select
                    value={vendedor.tipoIdentificacion}
                    onChange={(e) => actualizarVendedor(index, 'tipoIdentificacion', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
                  >
                    <option value="cedula">Cédula de Ciudadanía</option>
                    <option value="cedula_extranjeria">Cédula de Extranjería</option>
                    <option value="pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Número</label>
                  <input
                    type="text"
                    value={vendedor.numeroIdentificacion}
                    onChange={(e) => actualizarVendedor(index, 'numeroIdentificacion', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      vendedor.confianzaOCR && vendedor.confianzaOCR > 80 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Lugar Expedición</label>
                  <input
                    type="text"
                    value={vendedor.lugarExpedicion}
                    onChange={(e) => actualizarVendedor(index, 'lugarExpedicion', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      vendedor.confianzaOCR && vendedor.confianzaOCR > 80 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-slate-200'
                    }`}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Estado Civil</label>
                  <select
                    value={vendedor.estadoCivil}
                    onChange={(e) => actualizarVendedor(index, 'estadoCivil', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="soltero">Soltero(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viudo">Viudo(a)</option>
                    <option value="union_libre">Unión Libre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Teléfono</label>
                  <input
                    type="text"
                    value={vendedor.telefono}
                    onChange={(e) => actualizarVendedor(index, 'telefono', e.target.value)}
                    placeholder="Diligenciar manualmente"
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={vendedor.email}
                    onChange={(e) => actualizarVendedor(index, 'email', e.target.value)}
                    placeholder="Diligenciar manualmente"
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Dirección de Residencia</label>
                <input
                  type="text"
                  value={vendedor.direccionResidencia}
                  onChange={(e) => actualizarVendedor(index, 'direccionResidencia', e.target.value)}
                  placeholder="Diligenciar manualmente"
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">
                Parte {tipoEscritura === 'compraventa_hipoteca' ? 'Compradora / Hipotecante' : 'Compradora'}
              </h3>
              <p className="text-sm text-slate-500">Datos extraídos de las cédulas</p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {compradores.map((comprador, index) => (
            <div key={comprador.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-600">
                  {tipoEscritura === 'compraventa_hipoteca' ? 'Comprador/Hipotecante' : 'Comprador'} #{index + 1}
                </span>
                {comprador.confianzaOCR && comprador.confianzaOCR > 80 && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    {comprador.confianzaOCR}% confianza
                  </span>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Nombres</label>
                  <input
                    type="text"
                    value={comprador.nombres}
                    onChange={(e) => actualizarComprador(index, 'nombres', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      comprador.confianzaOCR && comprador.confianzaOCR > 80 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Apellidos</label>
                  <input
                    type="text"
                    value={comprador.apellidos}
                    onChange={(e) => actualizarComprador(index, 'apellidos', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      comprador.confianzaOCR && comprador.confianzaOCR > 80 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-slate-200'
                    }`}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Tipo ID</label>
                  <select
                    value={comprador.tipoIdentificacion}
                    onChange={(e) => actualizarComprador(index, 'tipoIdentificacion', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all bg-white"
                  >
                    <option value="cedula">Cédula de Ciudadanía</option>
                    <option value="cedula_extranjeria">Cédula de Extranjería</option>
                    <option value="pasaporte">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Número</label>
                  <input
                    type="text"
                    value={comprador.numeroIdentificacion}
                    onChange={(e) => actualizarComprador(index, 'numeroIdentificacion', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      comprador.confianzaOCR && comprador.confianzaOCR > 80 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Lugar Expedición</label>
                  <input
                    type="text"
                    value={comprador.lugarExpedicion}
                    onChange={(e) => actualizarComprador(index, 'lugarExpedicion', e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                      comprador.confianzaOCR && comprador.confianzaOCR > 80 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-slate-200'
                    }`}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Estado Civil</label>
                  <select
                    value={comprador.estadoCivil}
                    onChange={(e) => actualizarComprador(index, 'estadoCivil', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="soltero">Soltero(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viudo">Viudo(a)</option>
                    <option value="union_libre">Unión Libre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Teléfono</label>
                  <input
                    type="text"
                    value={comprador.telefono}
                    onChange={(e) => actualizarComprador(index, 'telefono', e.target.value)}
                    placeholder="Diligenciar manualmente"
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={comprador.email}
                    onChange={(e) => actualizarComprador(index, 'email', e.target.value)}
                    placeholder="Diligenciar manualmente"
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Dirección de Residencia</label>
                <input
                  type="text"
                  value={comprador.direccionResidencia}
                  onChange={(e) => actualizarComprador(index, 'direccionResidencia', e.target.value)}
                  placeholder="Diligenciar manualmente"
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Precio de Venta</h3>
              <p className="text-sm text-slate-500">Extraído de la Promesa de Compraventa</p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Valor en Números</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="text"
                  value={precioVenta.toLocaleString('es-CO')}
                  onChange={(e) => setPrecioVenta(Number(e.target.value.replace(/\D/g, '')))}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Valor en Letras</label>
              <input
                type="text"
                value={precioVentaLetras}
                onChange={(e) => setPrecioVentaLetras(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase"
              />
            </div>
          </div>
        </div>
      </div>

      {tipoEscritura === 'compraventa_hipoteca' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-purple-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Datos del Crédito Hipotecario</h3>
                <p className="text-sm text-slate-500">Extraído de la Carta de Crédito</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Entidad Bancaria</label>
                <input
                  type="text"
                  value={datosHipoteca.entidadBancaria}
                  onChange={(e) => setDatosHipoteca(prev => ({ ...prev, entidadBancaria: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">No. Carta de Crédito</label>
                <input
                  type="text"
                  value={datosHipoteca.numeroCartaCredito}
                  onChange={(e) => setDatosHipoteca(prev => ({ ...prev, numeroCartaCredito: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Monto del Crédito</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="text"
                    value={datosHipoteca.montoCredito.toLocaleString('es-CO')}
                    onChange={(e) => setDatosHipoteca(prev => ({ ...prev, montoCredito: Number(e.target.value.replace(/\D/g, '')) }))}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Monto en Letras</label>
                <input
                  type="text"
                  value={datosHipoteca.montoCreditoLetras}
                  onChange={(e) => setDatosHipoteca(prev => ({ ...prev, montoCreditoLetras: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Tasa de Interés</label>
                <input
                  type="text"
                  value={datosHipoteca.tasaInteres}
                  onChange={(e) => setDatosHipoteca(prev => ({ ...prev, tasaInteres: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Plazo</label>
                <input
                  type="text"
                  value={datosHipoteca.plazo}
                  onChange={(e) => setDatosHipoteca(prev => ({ ...prev, plazo: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-50 rounded-xl p-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200"></div>
          <span className="text-slate-600">Extraído automáticamente (alta confianza)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200"></div>
          <span className="text-slate-600">Requiere diligenciamiento manual</span>
        </div>
      </div>
    </motion.div>
  )

  const renderPaso3 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-bold text-slate-800">Verificación Final</h2>
        <p className="text-slate-500 mt-1">
          Revisa el resumen antes de generar el documento
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        <div className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Configuración del Documento</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Tipo de Escritura</span>
              <span className="font-medium text-slate-800">
                {tipoEscritura === 'compraventa_simple' ? 'Compraventa Simple' : 'Compraventa con Hipoteca'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Propiedad Horizontal</span>
              <span className="font-medium text-slate-800">{esPropiedadHorizontal ? 'Sí' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Matrícula Inmobiliaria</span>
              <span className="font-medium text-slate-800">{datosInmueble.matriculaInmobiliaria}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Precio de Venta</span>
              <span className="font-medium text-emerald-600">{formatearPrecio(precioVenta)}</span>
            </div>
          </div>
        </div>

        <div className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Partes del Contrato</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-amber-600 mb-2">Vendedores ({vendedores.length})</p>
              <div className="space-y-2">
                {vendedores.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{v.nombres} {v.apellidos}</span>
                    <span className="text-slate-400">- C.C. {v.numeroIdentificacion}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-600 mb-2">
                {tipoEscritura === 'compraventa_hipoteca' ? 'Compradores / Hipotecantes' : 'Compradores'} ({compradores.length})
              </p>
              <div className="space-y-2">
                {compradores.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{c.nombres} {c.apellidos}</span>
                    <span className="text-slate-400">- C.C. {c.numeroIdentificacion}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Inmueble</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-slate-700">{datosInmueble.direccion}</span>
            </div>
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">
                Área privada: {datosInmueble.areaPrivada} M² | Área construida: {datosInmueble.areaConstruida} M²
              </span>
            </div>
            {esPropiedadHorizontal && datosInmueble.nombreConjunto && (
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">
                  {datosInmueble.nombreConjunto} - Coef. {datosInmueble.coeficiente}%
                </span>
              </div>
            )}
          </div>
        </div>

        {tipoEscritura === 'compraventa_hipoteca' && (
          <div className="p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Crédito Hipotecario</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Entidad</span>
                <span className="text-slate-700">{datosHipoteca.entidadBancaria}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto del Crédito</span>
                <span className="font-medium text-purple-600">{formatearPrecio(datosHipoteca.montoCredito)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tasa / Plazo</span>
                <span className="text-slate-700">{datosHipoteca.tasaInteres} / {datosHipoteca.plazo}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Verifica la información</p>
            <p className="text-sm text-amber-700 mt-1">
              Asegúrate de que todos los datos sean correctos antes de generar el documento. 
              Puedes volver al paso anterior para editar cualquier campo.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-primary">Listo para generar</p>
            <p className="text-sm text-slate-600 mt-1">
              El documento se guardará como borrador. Podrás descargarlo en formato Word (.docx) 
              desde el historial para revisión final antes de la firma.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )

  const renderModalOCR = () => (
    <AnimatePresence>
      {procesandoOCR && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl p-8 max-w-md w-full text-center"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Procesando documentos</h3>
            <p className="text-slate-500 mb-6">
              Extrayendo información con OCR e inteligencia artificial...
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
              <motion.div
                className="bg-primary h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progresoOCR}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-sm text-slate-400">{progresoOCR}% completado</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div className="max-w-4xl mx-auto">
      {renderModalOCR()}

      <button
        onClick={() => onNavigate('inicio')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </button>

      <div className="mb-8">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {pasos.map((paso, index) => {
            const isActive = paso.numero === pasoActual
            const isCompleted = paso.numero < pasoActual
            return (
              <div key={paso.numero} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all
                    ${isActive ? 'bg-primary text-white' : ''}
                    ${isCompleted ? 'bg-primary text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-slate-200 text-slate-500' : ''}
                  `}>
                    {isCompleted ? <Check className="w-5 h-5" /> : paso.numero}
                  </div>
                  <span className={`
                    text-sm mt-2 font-medium text-center
                    ${isActive ? 'text-primary' : 'text-slate-400'}
                  `}>
                    {paso.titulo}
                  </span>
                </div>
                {index < pasos.length - 1 && (
                  <div className={`
                    w-16 md:w-24 h-0.5 mx-2 transition-colors
                    ${paso.numero < pasoActual ? 'bg-primary' : 'bg-slate-200'}
                  `} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8">
        <AnimatePresence mode="wait">
          {pasoActual === 1 && renderPaso1()}
          {pasoActual === 2 && renderPaso2()}
          {pasoActual === 3 && renderPaso3()}
        </AnimatePresence>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          <button
            onClick={handleAnterior}
            disabled={pasoActual === 1}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
              ${pasoActual === 1 
                ? 'text-slate-300 cursor-not-allowed' 
                : 'text-slate-600 hover:bg-slate-100'
              }
            `}
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>
          
          {pasoActual < 3 ? (
            <button
              onClick={handleSiguiente}
              disabled={pasoActual === 1 && !puedeAvanzarPaso1()}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pasoActual === 1 ? 'Procesar con IA' : 'Siguiente'}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-light transition-all disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Guardar Documento
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
