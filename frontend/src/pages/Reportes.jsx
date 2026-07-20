import { useMemo, useState } from 'react'
import { CATEGORIES, currency, currentMonth, monthLabel } from '../lib/finance'
import { downloadExpenseReportPdf } from '../lib/pdf'

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

function openDownload(url) {
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function Reportes({ user, expenses, budgets, apiConfigured, onGenerateReport, onLoadBudget }) {
  const [month, setMonth] = useState(currentMonth())
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [pdfReady, setPdfReady] = useState(false)
  const filtered = useMemo(() => expenses
    .filter((expense) => !month || expense.date.startsWith(month))
    .filter((expense) => !category || expense.category === category), [expenses, month, category])
  const total = filtered.reduce((sum, expense) => sum + Number(expense.amount), 0)

  async function handleCsvReport() {
    setLoading(true)
    setError('')
    setResult(null)
    setPdfReady(false)
    const [anio, mes] = month ? month.split('-') : ['', '']
    try {
      const report = await onGenerateReport({ mes, anio, categoria: category })
      if (apiConfigured) {
        if (!report.downloadUrl) throw new Error('La API no devolvió una URL de descarga.')
        openDownload(report.downloadUrl)
      } else {
        downloadLocalCsv(report.gastos, month)
      }
      setResult(report)
    } catch (reportError) {
      console.error('Error al generar el reporte.', reportError)
      setError('No se pudo generar el reporte. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePdfReport() {
    setPdfLoading(true)
    setError('')
    setPdfReady(false)
    try {
      let selectedBudget = budgets[month] || null
      if (month && !selectedBudget) selectedBudget = await onLoadBudget(month)
      await downloadExpenseReportPdf({ user, expenses: filtered, budget: selectedBudget || {}, month })
      setPdfReady(true)
    } catch (pdfError) {
      console.error('Error al generar el PDF.', pdfError)
      setError('No se pudo generar el reporte PDF. Intenta nuevamente.')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <><header className="page-header"><div><p className="eyebrow">{apiConfigured ? 'REPORTE EN AWS' : 'EXPORTACIÓN LOCAL'}</p><h1>Reportes</h1><p className="page-subtitle">{apiConfigured ? 'Genera un CSV y guárdalo de forma privada en S3.' : 'Descarga tus movimientos en un archivo compatible con Excel.'}</p></div></header>
      <section className="report-layout"><article className="panel report-builder"><div className="report-icon">CSV</div><div><h2>Descargar reportes de gastos</h2><p>{apiConfigured ? 'El CSV se guarda de forma privada en S3. El PDF se genera directamente en tu navegador.' : 'Los archivos se generan temporalmente en tu navegador.'}</p></div>{error && <p className="form-message error" role="alert">{error}</p>}{result && <div className="form-message success report-result" role="status"><strong>Reporte CSV generado correctamente.</strong><span>{result.cantidadRegistros} {result.cantidadRegistros === 1 ? 'registro incluido' : 'registros incluidos'}.</span></div>}{pdfReady && <p className="form-message success" role="status">Reporte PDF generado correctamente.</p>}<div className="form-grid"><label className="field"><span>Mes</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label className="field"><span>Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="report-actions"><button className="primary" onClick={handleCsvReport} disabled={loading || pdfLoading}>{loading ? 'Generando CSV…' : 'Descargar CSV'}</button><button className="secondary" onClick={handlePdfReport} disabled={loading || pdfLoading}>{pdfLoading ? 'Generando PDF…' : 'Descargar PDF'}</button></div></article>
        <article className="panel report-preview"><div><p className="eyebrow">RESUMEN DEL REPORTE</p><h2>{monthLabel(month)}</h2></div><div className="report-stat"><span>Total visible</span><strong>{currency.format(total)}</strong></div><div className="report-stat"><span>Movimientos visibles</span><strong>{filtered.length}</strong></div><div className="report-stat"><span>Categoría</span><strong>{category || 'Todas'}</strong></div><div className="privacy-note"><span>✓</span><p><strong>{apiConfigured ? 'Almacenamiento privado' : 'Procesamiento local'}</strong><br />{apiConfigured ? 'El CSV se guarda en el bucket configurado por SAM.' : 'No se envían datos a ningún servidor.'}</p></div></article></section></>
  )
}
