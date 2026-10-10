import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { WebStorageStateStore } from 'oidc-client-ts'
import App from './App'
import './index.css'
// Initialize i18n before the first render. In Phase 0 nobody uses t() yet;
// the import only guarantees that the language dropdown has i18n ready.
import './i18n'
// DEVELOPMENT ONLY: "view as" another user (?as=email&key=...). Remove before full production.
import { installViewAs } from './devViewAs'
import ViewAsBanner from './components/ViewAsBanner'
installViewAs()


const cognitoAuthConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173',
  response_type: 'code',
  scope: 'email openid profile',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  stateStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
  accessTokenExpiringNotificationTimeInSeconds: 120,
  loadUserInfo: false,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, '/')
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <ViewAsBanner />
      <App />
    </AuthProvider>
  </React.StrictMode>
)