import { useState } from 'react'
import { FormField } from '../components/FormField'
import { CATEGORIES, localDate } from '../lib/finance'

export function RegistrarGasto({ onNavigate, onAddExpense }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    setError('')
    try {
      await onAddExpense({
        amount: Number(form.get('amount')),
        category: form.get('category'),
        description: form.get('description').trim(),
        date: form.get('date'),
      })
    } catch (saveError) {
      console.error('Error al registrar el gasto.', saveError)
      setError('No se pudo registrar el gasto. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <><header className="page-header"><div><p className="eyebrow">NUEVO MOVIMIENTO</p><h1>Registrar gasto</h1><p className="page-subtitle">Añade los detalles de tu compra o pago.</p></div></header>
      <div className="form-layout"><form className="panel expense-form" onSubmit={handleSubmit}>
        {error && <p className="form-message error amount-field" role="alert">{error}</p>}
        <label className="amount-field"><span>Monto</span><div><b>$</b><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus required /></div></label>
        <FormField label="Descripción" name="description" placeholder="Ej. compras del supermercado" maxLength="80" required />
        <label className="field"><span>Categoría</span><select name="category" defaultValue="Alimentación" required>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <FormField label="Fecha" name="date" type="date" defaultValue={localDate()} required />
        <div className="form-actions"><button type="button" className="secondary" onClick={() => onNavigate('dashboard')} disabled={loading}>Cancelar</button><button className="primary" type="submit" disabled={loading}>{loading ? 'Guardando…' : 'Guardar gasto'}</button></div>
      </form><aside className="form-aside"><span className="aside-icon">✓</span><h2>Registro rápido</h2><p>La fecha se completa automáticamente. Puedes cambiarla antes de guardar.</p><div><small>Monto actual</small><strong>${Number(amount || 0).toFixed(2)}</strong></div></aside></div></>
  )
}
