const SESSION_TOKEN_KEY = 'gente-boa-api-token'
const PERSISTENT_TOKEN_KEY = 'gente-boa-api-token-persistent'

export function getStoredToken() {
  return sessionStorage.getItem(SESSION_TOKEN_KEY) ?? localStorage.getItem(PERSISTENT_TOKEN_KEY)
}

export function storeToken(token: string, remember: boolean) {
  clearStoredToken()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(remember ? PERSISTENT_TOKEN_KEY : SESSION_TOKEN_KEY, token)
}

export function clearStoredToken() {
  sessionStorage.removeItem(SESSION_TOKEN_KEY)
  localStorage.removeItem(PERSISTENT_TOKEN_KEY)
}
