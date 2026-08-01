export function areCredentialsValid(username: string, password: string) {
  return username.trim().toLowerCase() === 'naty' && password === 'naty12345'
}
