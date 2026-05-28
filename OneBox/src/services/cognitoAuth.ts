
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js'
import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts'

const AUTHORITY = import.meta.env.VITE_COGNITO_AUTHORITY as string
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string

const USER_POOL_ID = AUTHORITY.split('/').pop() as string

const pool = new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID })

const userManager = new UserManager({
  authority: AUTHORITY,
  client_id: CLIENT_ID,
  redirect_uri: (import.meta.env.VITE_REDIRECT_URI as string) || window.location.origin,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
})

function makeUser(email: string) {
  return new CognitoUser({ Username: email, Pool: pool })
}

let _pendingChallenge: { user: CognitoUser; userAttributes: any; email: string } | null = null

export class NewPasswordRequiredError extends Error {
  constructor() {
    super('NEW_PASSWORD_REQUIRED')
    this.name = 'NewPasswordRequiredError'
  }
}

export function friendlyError(err: any): string {
  const code = err?.code || err?.name || ''
  const msg = err?.message || 'Error inesperado'

  if (code === 'UserLambdaValidationException' || /PreSignUp failed with error/i.test(msg)) {
    const cleaned = msg
      .replace(/^PreSignUp failed with error\s*/i, '')
      .replace(/^PreAuthentication failed with error\s*/i, '')
      .replace(/\s*\.$/, '')
      .trim()
    return cleaned || 'No se pudo crear la cuenta.'
  }

  const map: Record<string, string> = {
    UsernameExistsException: 'Ya existe una cuenta con ese correo.',
    NotAuthorizedException: 'Correo o contraseña incorrectos.',
    UserNotConfirmedException: 'Tu correo aún no está verificado. Revisa el código.',
    CodeMismatchException: 'El código no es correcto.',
    ExpiredCodeException: 'El código expiró. Pide uno nuevo.',
    InvalidPasswordException: 'La contraseña no cumple los requisitos (mín. 8, mayúscula y número).',
    InvalidParameterException: 'Revisa los datos ingresados.',
    UserNotFoundException: 'No existe una cuenta con ese correo.',
    LimitExceededException: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  }
  return map[code] || msg
}

/** Registro: crea el usuario (Cognito enviará un código al correo). */
export function signUp(email: string, password: string, name?: string): Promise<void> {
  const attrs = [new CognitoUserAttribute({ Name: 'email', Value: email })]
  if (name) attrs.push(new CognitoUserAttribute({ Name: 'name', Value: name }))
  return new Promise((resolve, reject) => {
    pool.signUp(email, password, attrs, [], (err) => (err ? reject(err) : resolve()))
  })
}

/** Confirma el registro con el código que llegó al correo. */
export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    makeUser(email).confirmRegistration(code, true, (err) => (err ? reject(err) : resolve()))
  })
}

/** Reenvía el código de verificación. */
export function resendCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    makeUser(email).resendConfirmationCode((err) => (err ? reject(err) : resolve()))
  })
}

export function signIn(email: string, password: string): Promise<void> {
  const user = makeUser(email)
  const details = new AuthenticationDetails({ Username: email, Password: password })
  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: async (session) => {
        _pendingChallenge = null
        try {
          await bridgeToOidc(session)
          resolve()
        } catch (e) {
          reject(e)
        }
      },
      onFailure: (err) => {
        _pendingChallenge = null
        reject(err)
      },
      newPasswordRequired: (userAttributes /* , requiredAttributes */) => {
        
        _pendingChallenge = { user, userAttributes, email }
        reject(new NewPasswordRequiredError())
      },
    })
  })
}

export function completeNewPassword(newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!_pendingChallenge) {
      reject(new Error('No hay sesión pendiente. Vuelve a iniciar sesión.'))
      return
    }
    const { user, userAttributes, email } = _pendingChallenge
    // Cognito no permite reenviar email/email_verified durante el reto.
    delete userAttributes.email_verified
    delete userAttributes.email
    // Si el pool requiere "name" y el invitado no lo tiene, ponemos un default
    // (el prefijo del email). Evita errores tipo "Attribute name is required".
    if (!userAttributes.name) {
      userAttributes.name = email.split('@')[0]
    }
    user.completeNewPasswordChallenge(newPassword, userAttributes, {
      onSuccess: async (session) => {
        _pendingChallenge = null
        try {
          await bridgeToOidc(session)
          resolve()
        } catch (e) {
          reject(e)
        }
      },
      onFailure: (err) => {
        reject(err)
      },
    })
  })
}

/** Inicia el flujo "olvidé mi contraseña" (envía código al correo). */
export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    makeUser(email).forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    })
  })
}

/** Confirma la nueva contraseña con el código recibido. */
export function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    makeUser(email).confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    })
  })
}

/** Escribe la sesión de Cognito en el storage de oidc-client-ts. */
async function bridgeToOidc(session: CognitoUserSession): Promise<void> {
  const idToken = session.getIdToken()
  const accessToken = session.getAccessToken()
  const refreshToken = session.getRefreshToken()
  const profile = idToken.decodePayload() as any // claims: sub, email, name, ...

  const oidcUser = new User({
    id_token: idToken.getJwtToken(),
    access_token: accessToken.getJwtToken(),
    refresh_token: refreshToken.getToken(),
    token_type: 'Bearer',
    scope: 'email openid profile',
    profile,
    expires_at: accessToken.getExpiration(),
  })

  await userManager.storeUser(oidcUser)
}
