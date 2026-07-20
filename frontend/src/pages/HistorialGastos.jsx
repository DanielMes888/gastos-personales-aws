import { useEffect, useState } from 'react'
import { CATEGORIES, currency, currentMonth, formatDate } from '../lib/finance'

export function HistorialGastos({ expenses, onNavigate, onQueryExpenses }) {
  const [category, setCategory] = useState('')
  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows] = useState(expenses)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      const [anio, mes] = month ? month.split('-') : ['', '']
      try {
        const result = await onQueryExpenses({ mes, anio, categoria: category })
        if (active) setRows(result)
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [category, month, onQueryExpenses])

  const total = rows.reduce((sum, expense) => sum + Number(expense.amount), 0)

  return (
    <><header className="page-header"><div><p className="eyebrow">MOVIMIENTOS</p><h1>Historial de gastos</h1><p className="page-subtitle">Consulta y filtra todos tus registros.</p></div><button className="primary" onClick={() => onNavigate('registrar')}>+ Nuevo gasto</button></header>
      <section className="panel history-panel"><div className="history-toolbar"><div className="filters"><label><span>Mes</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label><span>Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><button className="filter-clear" onClick={() => { setMonth(''); setCategory('') }}>Limpiar</button></div><div className="history-total"><small>Total filtrado</small><strong>{currency.format(total)}</strong></div></div>
        {error && <p className="form-message error panel-message" role="alert">{error}</p>}
        {loading ? <div className="empty-state"><span>…</span><h3>Cargando gastos</h3></div> : rows.length ? <div className="table-wrap"><table><thead><tr><th>Descripción</th><th>Categoría</th><th>Fecha</th><th>Monto</th></tr></thead><tbody>{rows.map((expense) => <tr key={expense.id}><td data-label="Descripción"><strong>{expense.description}</strong></td><td data-label="Categoría"><span className="category-pill">{expense.category}</span></td><td data-label="Fecha">{formatDate(expense.date)}</td><td data-label="Monto">{currency.format(expense.amount)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><span>⌕</span><h3>No encontramos gastos</h3><p>Cambia los filtros o registra un movimiento nuevo.</p></div>}
      </section></>
  )
}
