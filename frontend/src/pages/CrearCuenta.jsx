import { useState } from 'react'
import { FormField } from '../components/FormField'

export function CrearCuenta({ onCreate, onNavigate, apiConfigured }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = form.get('password')
    if (String(password).length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== form.get('confirmation')) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await onCreate({ name: form.get('name'), email: form.get('email'), password })
    } catch (createError) {
      console.error('Error al crear la cuenta.', createError)
      setError(createError.code === 'API_NOT_CONFIGURED'
        ? 'La conexión con la API no está configurada.'
        : 'No se pudo crear la cuenta. Verifica los datos e intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <div className="auth-brand"><span className="brand-mark">M</span> Mis Gastos</div>
        <div><p className="eyebrow">EMPIEZA HOY</p><h1>Sistema de Monitoreo de Gastos Personales</h1><p>Controla tus gastos, presupuesto y reportes desde una aplicación distribuida en AWS.</p></div>
        <div className="auth-metric"><span>{apiConfigured ? 'Conectado a AWS' : 'API no configurada'}</span><strong>{apiConfigured ? 'Tus finanzas disponibles desde la API' : 'Define VITE_API_URL para crear una cuenta'}</strong></div>
      </section>
      <form className="auth-card" onSubmit={handleSubmit}>
        <div><p className="eyebrow">NUEVA CUENTA</p><h2>Crea tu espacio</h2><p>Solo toma un minuto.</p></div>
        {error && <p className="form-message error" role="alert">{error}</p>}
        <FormField label="Nombre completo" name="name" type="text" placeholder="Tu nombre" autoComplete="name" required />
        <FormField label="Correo electrónico" name="email" type="email" placeholder="tu@correo.com" autoComplete="email" required />
        <FormField label="Contraseña" name="password" type="password" autoComplete="new-password" required />
        <FormField label="Confirmar contraseña" name="confirmation" type="password" autoComplete="new-password" required />
        <button className="primary" type="submit" disabled={loading}>{loading ? 'Creando cuenta…' : 'Crear mi cuenta'}</button>
        <p className="auth-switch">¿Ya tienes una cuenta? <button className="text-button" type="button" onClick={() => onNavigate('login')}>Inicia sesión</button></p>
      </form>
    </main>
  )
}
