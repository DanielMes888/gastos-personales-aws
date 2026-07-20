import { useEffect, useState } from 'react'
import { FormField } from '../components/FormField'
import { calculateSummary, currency, currentMonth, expensesForMonth, monthLabel } from '../lib/finance'

export function PresupuestoMensual({ expenses, onLoadBudget, onUpdateBudget }) {
  const [month, setMonth] = useState(currentMonth())
  const [limit, setLimit] = useState('')
  const [alert, setAlert] = useState(80)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasBudget, setHasBudget] = useState(false)
  const summary = calculateSummary(expensesForMonth(expenses, month), { limit, alert })

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setSaved(false)
      setError('')
      try {
        const budget = await onLoadBudget(month)
        if (active) {
          setLimit(budget?.limit || '')
          setAlert(budget?.alert || 80)
          setHasBudget(Boolean(budget))
        }
      } catch (loadError) {
        console.error('Error al cargar el presupuesto.', loadError)
        if (active) setError('No se pudo cargar el presupuesto. Intenta nuevamente.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [month, onLoadBudget])

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setSaved(false)
    setError('')
    const wasExisting = hasBudget
    try {
      await onUpdateBudget(month, { limit: Number(limit), alert: Number(alert) })
      setHasBudget(true)
      setSaved(wasExisting ? 'Presupuesto actualizado correctamente.' : 'Presupuesto guardado correctamente.')
    } catch (saveError) {
      console.error('Error al guardar el presupuesto.', saveError)
      setError('No se pudo guardar el presupuesto. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <><header className="page-header"><div><p className="eyebrow">PLANIFICACIÓN</p><h1>Presupuesto mensual</h1><p className="page-subtitle">Define límites realistas y recibe alertas a tiempo.</p></div></header>
      <section className="budget-layout"><form className="panel budget-form" onSubmit={handleSubmit}><div><p className="eyebrow">CONFIGURACIÓN</p><h2>Tu límite del mes</h2></div>{saved && <p className="form-message success" role="status">{saved}</p>}{error && <p className="form-message error" role="alert">{error}</p>}<FormField label="Mes" type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /><FormField label="Límite mensual" type="number" min="1" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="1200.00" required /><label className="field"><span>Porcentaje de alerta: {alert}%</span><input className="range" type="range" min="50" max="95" step="5" value={alert} onChange={(event) => setAlert(event.target.value)} /><small>Te avisaremos cuando tus gastos alcancen este porcentaje.</small></label><button className="primary" type="submit" disabled={loading}>{loading ? 'Cargando…' : hasBudget ? 'Actualizar presupuesto' : 'Guardar presupuesto'}</button></form>
        <article className={`panel budget-preview ${summary.status.key}`}><div className="budget-preview-head"><div><small>{monthLabel(month)}</small><h2>Progreso del presupuesto</h2></div><span className="status-badge">{summary.status.label}</span></div><div className="budget-amount"><strong>{currency.format(summary.total)}</strong><span>de {currency.format(Number(limit || 0))}</span></div><div className="progress large"><span className={summary.status.key} style={{ width: `${Math.min(summary.percent, 100)}%` }} /></div><div className="budget-numbers"><span><small>Usado</small><strong>{summary.percent.toFixed(1)}%</strong></span><span><small>Disponible</small><strong>{currency.format(Math.max(Number(limit || 0) - summary.total, 0))}</strong></span><span><small>Alerta</small><strong>{alert}%</strong></span></div><p className="budget-note">{summary.status.detail}</p></article>
      </section></>
  )
}
