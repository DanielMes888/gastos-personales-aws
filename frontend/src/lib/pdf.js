import { calculateSummary, currency, monthLabel } from './finance.js'

const COLORS = {
  ink: [24, 34, 30],
  muted: [105, 116, 111],
  forest: [23, 63, 52],
  green: [57, 116, 96],
  gold: [229, 173, 77],
  line: [225, 230, 226],
  soft: [243, 245, 242],
}

function money(value) {
  return currency.format(Number(value || 0))
}

export async function buildExpenseReportPdf({ user, expenses, budget, month }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)
  const summary = calculateSummary(expenses, budget)
  const period = monthLabel(month)
  let y = 0

  function addHeader() {
    doc.setFillColor(...COLORS.forest)
    doc.rect(0, 0, pageWidth, 35, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.text('Sistema de Monitoreo de Gastos Personales', margin, 16)
    doc.setTextColor(218, 235, 228)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Reporte mensual de gastos', margin, 24)
    y = 45
  }

  function addTableHeader() {
    doc.setFillColor(...COLORS.forest)
    doc.rect(margin, y, contentWidth, 9, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Fecha', margin + 2, y + 6)
    doc.text('Categoria', margin + 29, y + 6)
    doc.text('Descripcion', margin + 69, y + 6)
    doc.text('Monto', pageWidth - margin - 2, y + 6, { align: 'right' })
    y += 9
  }

  addHeader()
  doc.setTextColor(...COLORS.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Usuario', margin, y)
  doc.text('Periodo', pageWidth / 2, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.muted)
  doc.text(user?.name || 'Usuario', margin, y + 6)
  doc.text(period, pageWidth / 2, y + 6)
  y += 17

  const cardGap = 4
  const cardWidth = (contentWidth - cardGap) / 2
  const cards = [
    ['Total gastado', money(summary.total)],
    ['Presupuesto mensual', summary.limit ? money(summary.limit) : 'Sin definir'],
    ['Porcentaje usado', `${summary.percent.toFixed(1)}%`],
    ['Estado', summary.status.label],
  ]
  cards.forEach(([label, value], index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = margin + column * (cardWidth + cardGap)
    const cardY = y + row * 22
    doc.setFillColor(...COLORS.soft)
    doc.roundedRect(x, cardY, cardWidth, 18, 2, 2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text(label, x + 4, cardY + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COLORS.ink)
    doc.text(String(value), x + 4, cardY + 13)
  })
  y += 49

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COLORS.ink)
  doc.text('Detalle de gastos', margin, y)
  y += 6

  if (!expenses.length) {
    doc.setFillColor(...COLORS.soft)
    doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.muted)
    doc.text('No hay gastos registrados para este periodo.', margin + 5, y + 11)
  } else {
    addTableHeader()
    expenses.forEach((expense, index) => {
      const categoryLines = doc.splitTextToSize(expense.category || '-', 36)
      const descriptionLines = doc.splitTextToSize(expense.description || '-', 66)
      const lineCount = Math.max(categoryLines.length, descriptionLines.length, 1)
      const rowHeight = Math.max(9, (lineCount * 4) + 4)
      if (y + rowHeight > pageHeight - 18) {
        doc.addPage()
        y = 15
        addTableHeader()
      }
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 249)
        doc.rect(margin, y, contentWidth, rowHeight, 'F')
      }
      doc.setDrawColor(...COLORS.line)
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.ink)
      doc.text(expense.date || '-', margin + 2, y + 6)
      doc.text(categoryLines, margin + 29, y + 6)
      doc.text(descriptionLines, margin + 69, y + 6)
      doc.setFont('helvetica', 'bold')
      doc.text(money(expense.amount), pageWidth - margin - 2, y + 6, { align: 'right' })
      y += rowHeight
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...COLORS.line)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text(`Generado el ${new Date().toLocaleDateString('es-PA')}`, margin, pageHeight - 7)
    doc.text(`Pagina ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' })
  }

  return doc
}

export async function downloadExpenseReportPdf(data) {
  const reportMonth = data.month || new Date().toISOString().slice(0, 7)
  const doc = await buildExpenseReportPdf(data)
  doc.save(`reporte-gastos-${reportMonth}.pdf`)
}
