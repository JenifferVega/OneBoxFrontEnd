/**
 * Componente <Logo /> — única fuente de la marca OneBox en toda la app.
 *
 * Cambiar el logo (o ajustar tamaños) se hace SOLO acá. Los callers no se
 * enteran del archivo concreto.
 *
 * Props:
 *   - variant: "dark" (logo con texto blanco, para fondos claros)
 *              "light" (logo con texto azul/negro, para fondos oscuros)
 *              "auto" (detecta vía className del contenedor)
 *   - size: "sm" | "md" | "lg" | "xl" (alturas predefinidas con Tailwind)
 *   - className: extras opcionales (margenes, etc.)
 *
 * Nota nomenclatura de assets:
 *   - onebox-logo-dark.png  → arte CON FONDO OSCURO embebido (lookea bien
 *                              sobre fondos claros, contrasta).
 *   - onebox-logo-light.png → arte CON FONDO CLARO/blanco embebido (lookea
 *                              bien sobre fondos oscuros — se ve "limpio" sobre
 *                              el tema oscuro de la app).
 *
 * Es decir: el nombre del archivo describe el FONDO del propio logo, no el
 * fondo de destino. Por eso el componente recibe `variant="light"` para usar
 * en el sidebar oscuro de la app — necesitamos un logo con fondo claro
 * encima para que destaque.
 */
import logoDark from '../assets/onebox-logo-dark.png'
import logoLight from '../assets/onebox-logo-light.png'

type LogoVariant = 'dark' | 'light'
type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: 'h-16 w-auto',   // ~64px — topbar / nav (logo cuadrado con texto interno, necesita altura)
  md: 'h-24 w-auto',   // ~96px — header
  lg: 'h-36 w-auto',   // ~144px — login
  xl: 'h-48 w-auto',   // ~192px — hero / splash
}

export default function Logo({
  variant = 'light',
  size = 'sm',
  className = '',
}: {
  variant?: LogoVariant
  size?: LogoSize
  className?: string
}) {
  const src = variant === 'dark' ? logoDark : logoLight
  return (
    <img
      src={src}
      alt="OneBox"
      className={`${SIZE_CLASSES[size]} ${className}`}
      draggable={false}
    />
  )
}
