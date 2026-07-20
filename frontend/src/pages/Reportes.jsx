import { useMemo, useState } from 'react'
import { CATEGORIES, currency, currentMonth, monthLabel } from '../lib/finance'

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function downloadLocalCsv(expenses, month) {
  const lines = [
    ['Fecha', 'Descripción', 'Categoría', 'Monto'],
    ...expenses.map((expense) => [expense.fecha, expense.descripcion, expense.categoria, Number(expense.monto).toFixed(2)]),
  ]
  const csv = `\ufeff${lines.map((row) => row.map(csvCell).join(',')).join('\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `gastos-${month || 'todos'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function Reportes({ expenses, apiConfigured, onGenerateReport }) {
  const [month, setMonth] = useState(currentMonth())
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const filtered = useMemo(() => expenses
    .filter((expense) => !month || expense.date.startsWith(month))
    .filter((expense) => !category || expense.category === category), [expenses, month, category])
  const total = filtered.reduce((sum, expense) => sum + Number(expense.amount), 0)

  async function handleReport() {
    setLoading(true)
    setError('')
    setResult(null)
    const [anio, mes] = month ? month.split('-') : ['', '']
    try {
      const report = await onGenerateReport({ mes, anio, categoria: category })
      if (apiConfigured) setResult(report)
      else downloadLocalCsv(report.gastos, month)
    } catch (reportError) {
      setError(reportError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <><header className="page-header"><div><p className="eyebrow">{apiConfigured ? 'REPORTE EN AWS' : 'EXPORTACIÓN LOCAL'}</p><h1>Reportes</h1><p className="page-subtitle">{apiConfigured ? 'Genera un CSV y guárdalo de forma privada en S3.' : 'Descarga tus movimientos en un archivo compatible con Excel.'}</p></div></header>
      <section className="report-layout"><article className="panel report-builder"><div className="report-icon">CSV</div><div><h2>Generar reporte de gastos</h2><p>{apiConfigured ? 'ReportesService procesa los gastos y devuelve la ubicación del archivo.' : 'Modo local: el archivo se crea temporalmente en tu navegador.'}</p></div>{error && <p className="form-message error" role="alert">{error}</p>}{result && <p className="form-message success report-result" role="status"><strong>Reporte guardado en S3</strong><span>Bucket: {result.bucket}</span><span>Key: {result.key}</span></p>}<div className="form-grid"><label className="field"><span>Mes</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label className="field"><span>Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label></div><button className="primary" onClick={handleReport} disabled={loading || (!apiConfigured && !filtered.length)}>{loading ? 'Generando…' : apiConfigured ? 'Generar en S3' : '↓ Descargar CSV'}</button></article>
        <article className="panel report-preview"><div><p className="eyebrow">RESUMEN DEL REPORTE</p><h2>{monthLabel(month)}</h2></div><div className="report-stat"><span>Total visible</span><strong>{currency.format(total)}</strong></div><div className="report-stat"><span>Movimientos visibles</span><strong>{filtered.length}</strong></div><div className="report-stat"><span>Categoría</span><strong>{category || 'Todas'}</strong></div><div className="privacy-note"><span>✓</span><p><strong>{apiConfigured ? 'Almacenamiento privado' : 'Procesamiento local'}</strong><br />{apiConfigured ? 'El CSV se guarda en el bucket configurado por SAM.' : 'No se envían datos a ningún servidor.'}</p></div></article></section></>
  )
}
