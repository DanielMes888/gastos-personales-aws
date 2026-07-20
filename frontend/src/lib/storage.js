const SESSION_KEY = 'mis-gastos:session'

function cleanLegacyStorage() {
  const keysToRemove = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key?.startsWith('mis-gastos:') && key !== SESSION_KEY) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))
}

export function getSession() {
  cleanLegacyStorage()
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (!stored) return null
    const session = {
      usuarioId: stored.usuarioId || stored.id,
      nombre: stored.nombre || stored.name,
      correo: stored.correo || stored.email,
    }
    if (!session.usuarioId || !session.nombre || !session.correo) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    saveSession(session)
    return session
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveSession(session) {
  const safeSession = {
    usuarioId: session.usuarioId,
    nombre: session.nombre,
    correo: session.correo,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(safeSession))
  return safeSession
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
