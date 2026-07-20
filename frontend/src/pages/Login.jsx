import { useState } from 'react'
import { FormField } from '../components/FormField'

export function Login({ onLogin, onNavigate, apiConfigured, initialError = '' }) {
  const [error, setError] = useState(initialError)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    setLoading(true)
    try {
      await onLogin({ email: form.get('email'), password: form.get('password') })
    } catch (loginError) {
      console.error('Error al iniciar sesión.', loginError)
      setError(loginError.code === 'API_NOT_CONFIGURED'
        ? 'La conexión con la API no está configurada.'
        : 'No se pudo iniciar sesión. Verifica tu correo y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <div className="auth-brand"><span className="brand-mark">M</span> Mis Gastos</div>
        <div><p className="eyebrow">FINANZAS PERSONALES EN AWS</p><h1>Sistema de Monitoreo de Gastos Personales</h1><p>Controla tus gastos, presupuesto y reportes desde una aplicación distribuida en AWS.</p></div>
        <div className="auth-metric"><span>Control simple</span><strong>Una vista completa de tu mes</strong></div>
      </section>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div><p className="eyebrow">BIENVENIDO</p><h2>Inicia sesión</h2><p>Continúa organizando tus finanzas.</p></div>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <FormField label="Correo electrónico" name="email" type="email" placeholder="tu@correo.com" autoComplete="email" required />
        <FormField label="Contraseña" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
        <button className="primary" type="submit" disabled={loading}>{loading ? 'Conectando…' : 'Iniciar sesión'}</button>
        <p className="auth-switch">¿Aún no tienes cuenta? <button className="text-button" type="button" onClick={() => onNavigate('cuenta')}>Créala gratis</button></p>
        {!apiConfigured && <div className="demo-credentials"><strong>API no configurada</strong><span>Define VITE_API_URL para iniciar sesión.</span></div>}
      </form>
    </main>
  )
}
