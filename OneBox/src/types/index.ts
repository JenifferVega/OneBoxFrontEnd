export type TipoEscritura = 'compraventa_simple' | 'compraventa_hipoteca'

export type EstadoDocumento = 'borrador' | 'verificado' | 'descargado'

export type TipoIdentificacion = 'cedula' | 'pasaporte' | 'cedula_extranjeria'

export interface Persona {
  id: string
  nombres: string
  apellidos: string
  tipoIdentificacion: TipoIdentificacion
  numeroIdentificacion: string
  lugarExpedicion: string
  estadoCivil: string
  direccionResidencia: string
  telefono: string
  email: string
  archivoNombre?: string
  confianzaOCR?: number
}

export interface ArchivoAdjunto {
  id: string
  nombre: string
  tipo: 'pdf' | 'jpg' | 'png'
  url: string
  fechaCarga: Date
}

export interface DatosInmueble {
  direccion: string
  matriculaInmobiliaria: string
  cedulaCatastral: string
  oficinaRegistro: string
  zona: string
  linderos: string
  areaPrivada: string
  areaConstruida: string
  esPropiedadHorizontal: boolean
  coeficiente?: string
  nombreConjunto?: string
}

export interface DatosTradicion {
  vendedorAnterior: string
  vendedorAnteriorCC: string
  compradorAnterior: string
  compradorAnteriorCC: string
  numeroEscritura: string
  fechaEscritura: string
  notaria: string
  ciudad: string
}

export interface DatosHipoteca {
  entidadBancaria: string
  numeroCartaCredito: string
  montoCredito: number
  montoCreditoLetras: string
  tasaInteres: string
  plazo: string
}

export interface ConfiguracionDocumento {
  tipoEscritura: TipoEscritura
  esPropiedadHorizontal: boolean
}

export interface DocumentoEscritura {
  id: string
  titulo: string
  tipoEscritura: TipoEscritura
  estado: EstadoDocumento
  fechaCreacion: Date
  fechaModificacion: Date
  configuracion: ConfiguracionDocumento
  vendedores: Persona[]
  compradores: Persona[]
  datosInmueble: DatosInmueble
  datosTradicion: DatosTradicion
  datosHipoteca?: DatosHipoteca
  precioVenta: number
  precioVentaLetras: string
  documentosAdjuntos: {
    certificadoTradicion?: ArchivoAdjunto
    promesaCompraventa?: ArchivoAdjunto
    pazYSalvoPredial?: ArchivoAdjunto
    pazYSalvoAdministracion?: ArchivoAdjunto
    cartaCredito?: ArchivoAdjunto
  }
  tiempoGeneracion?: number
}

export interface EstadisticasDashboard {
  totalDocumentos: number
  verificados: number
  borradores: number
  tiempoPromedio: number
}

export interface DatosExtraidosOCR {
  vendedores: Persona[]
  compradores: Persona[]
  datosInmueble: DatosInmueble
  datosTradicion: DatosTradicion
  datosHipoteca?: DatosHipoteca
  precioVenta: number
  precioVentaLetras: string
}
