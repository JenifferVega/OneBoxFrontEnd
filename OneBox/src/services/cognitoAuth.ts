
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
  const msg = err?.message || 'Unexpected error'

  if (code === 'UserLambdaValidationException' || /PreSignUp failed with error/i.test(msg)) {
    const cleaned = msg
      .replace(/^PreSignUp failed with error\s*/i, '')
      .replace(/^PreAuthentication failed with error\s*/i, '')
      .replace(/\s*\.$/, '')
      .trim()
    return cleaned || 'Could not create the account.'
  }

  const map: Record<string, string> = {
    UsernameExistsException: 'An account with that email already exists.',
    NotAuthorizedException: 'Incorrect email or password.',
    UserNotConfirmedException: 'Your email is not verified yet. Check the code.',
    CodeMismatchException: 'The code is incorrect.',
    ExpiredCodeException: 'The code expired. Request a new one.',
    InvalidPasswordException: 'The password does not meet the requirements (min. 8 characters, uppercase and number).',
    InvalidParameterException: 'Please review the entered data.',
    UserNotFoundException: 'No account exists with that email.',
    LimitExceededException: 'Too many attempts. Please wait a moment and try again.',
  }
  return map[code] || msg
}

/** Sign-up: creates the user (Cognito will send a code to the email). */
export function signUp(email: string, password: string, name?: string): Promise<void> {
  const attrs = [new CognitoUserAttribute({ Name: 'email', Value: email })]
  if (name) attrs.push(new CognitoUserAttribute({ Name: 'name', Value: name }))
  return new Promise((resolve, reject) => {
    pool.signUp(email, password, attrs, [], (err) => (err ? reject(err) : resolve()))
  })
}

/** Confirms the sign-up with the code that arrived by email. */
export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    makeUser(email).confirmRegistration(code, true, (err) => (err ? reject(err) : resolve()))
  })
}

/** Resends the verification code. */
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
      reject(new Error('No pending session. Please sign in again.'))
      return
    }
    const { user, userAttributes, email } = _pendingChallenge
    // Cognito does not allow resending email/email_verified during the challenge.
    delete userAttributes.email_verified
    delete userAttributes.email
    // If the pool requires "name" and the invitee does not have one, we set a default
    // (the email prefix). Avoids errors like "Attribute name is required".
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

/** Starts the "forgot my password" flow (sends a code to the email). */
export function forgotPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    makeUser(email).forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    })
  })
}

/** Confirms the new password with the received code. */
export function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    makeUser(email).confirmPassword(code, newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    })
  })
}

/** Writes the Cognito session to the oidc-client-ts storage. */
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
