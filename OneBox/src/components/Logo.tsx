/**
 * <Logo /> component — the single source of the OneBox brand across the app.
 *
 * Changing the logo (or adjusting sizes) is done ONLY here. Callers don't
 * need to know about the specific file.
 *
 * Props:
 *   - variant: "dark" (logo with white text, for light backgrounds)
 *              "light" (logo with blue/black text, for dark backgrounds)
 *              "auto" (detects via container className)
 *   - size: "sm" | "md" | "lg" | "xl" (Tailwind-predefined heights)
 *   - className: optional extras (margins, etc.)
 *
 * Asset naming convention:
 *   - onebox-logo-dark.png  → art WITH DARK BACKGROUND embedded (looks
 *                              good on light backgrounds, contrasts).
 *   - onebox-logo-light.png → art WITH LIGHT/white BACKGROUND embedded
 *                              (looks good on dark backgrounds — appears
 *                              "clean" on the app's dark theme).
 *
 * That is: the filename describes the logo's OWN BACKGROUND, not the target
 * background. That's why the component receives `variant="light"` for use in
 * the app's dark sidebar — we need a logo with a light background over it
 * to make it stand out.
 */
import logoDark from '../assets/onebox-logo-dark.png'
import logoLight from '../assets/onebox-logo-light.png'

type LogoVariant = 'dark' | 'light'
type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: 'h-16 w-auto',   // ~64px — topbar / nav (square logo with internal text, needs height)
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
