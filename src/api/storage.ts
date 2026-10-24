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

export function replaceStoredToken(token: string) {
  if (localStorage.getItem(PERSISTENT_TOKEN_KEY)) localStorage.setItem(PERSISTENT_TOKEN_KEY, token)
  else sessionStorage.setItem(SESSION_TOKEN_KEY, token)
}

const RETURN_PATH_KEY = 'gente-boa-return-path'

export function storeReturnPath(path: string) {
  sessionStorage.setItem(RETURN_PATH_KEY, path)
}

export function consumeReturnPath() {
  const path = sessionStorage.getItem(RETURN_PATH_KEY)
  sessionStorage.removeItem(RETURN_PATH_KEY)
  return path && path.startsWith('/') && !path.startsWith('/login') ? path : '/'
}

export function clearStoredToken() {
  sessionStorage.removeItem(SESSION_TOKEN_KEY)
  localStorage.removeItem(PERSISTENT_TOKEN_KEY)
}
