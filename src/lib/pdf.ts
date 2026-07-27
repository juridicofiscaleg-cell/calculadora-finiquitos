import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FiniquitoFormData, FiniquitoResult } from './types'
import { formatDate, formatMoney, formatNumber } from './format'

async function loadLogoDataUrl(): Promise<{
  dataUrl: string
  width: number
  height: number
} | null> {
  try {
    const res = await fetch(`/logo-eg.png?v=3`)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
    if (!dataUrl) return null

    const dims = await new Promise<{ width: number; height: number } | null>(
      (resolve) => {
        const img = new Image()
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => resolve(null)
        img.src = dataUrl
      },
    )
    if (!dims || !dims.width || !dims.height) return null
    return { dataUrl, ...dims }
  } catch {
    return null
  }
}

function money(n: number) {
  return formatMoney(n)
}

export async function downloadFiniquitoPdf(
  data: FiniquitoFormData,
  result: FiniquitoResult,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 16
  const navy: [number, number, number] = [12, 35, 64]
  const blue: [number, number, number] = [30, 90, 154]
  const muted: [number, number, number] = [90, 105, 122]
  const line: [number, number, number] = [210, 220, 230]

  const logo = await loadLogoDataUrl()

  // Header bar
  doc.setFillColor(...navy)
  doc.rect(0, 0, pageW, 3, 'F')

  if (logo) {
    const logoW = 46
    const logoH = logoW * (logo.height / logo.width)
    doc.addImage(logo.dataUrl, 'PNG', margin, 8, logoW, logoH)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...navy)
    doc.text('EG EMPRESARIAL', margin, 20)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text('Despacho jurídico · Cálculo laboral', pageW - margin, 16, {
    align: 'right',
  })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...blue)
  doc.text('ESTIMACIÓN DE FINIQUITO / LIQUIDACIÓN', pageW - margin, 23, {
    align: 'right',
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text(
    `Emitido: ${formatDate(new Date().toISOString().slice(0, 10))}`,
    pageW - margin,
    29,
    { align: 'right' },
  )

  const headerBottom = logo ? 8 + 46 * (logo.height / logo.width) + 4 : 36

  // Divider
  doc.setDrawColor(...line)
  doc.setLineWidth(0.4)
  doc.line(margin, headerBottom, pageW - margin, headerBottom)

  let y = headerBottom + 8

  // Title block
  doc.setFillColor(245, 249, 252)
  doc.roundedRect(margin, y, pageW - margin * 2, 18, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...navy)
  doc.text(result.terminationLabel.toUpperCase(), margin + 4, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...muted)
  doc.text(
    `Total neto estimado: ${money(result.totalNeto)}`,
    margin + 4,
    y + 14,
  )
  y += 26

  // Parties
  const col1 = margin
  const col2 = pageW / 2 + 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...blue)
  doc.text('EMPRESA', col1, y)
  doc.text('TRABAJADOR', col2, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...navy)
  doc.text(data.empresa || '—', col1, y, { maxWidth: pageW / 2 - margin - 4 })
  doc.text(data.trabajadorNombre || '—', col2, y, {
    maxWidth: pageW / 2 - margin - 4,
  })
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  if (data.puesto) {
    doc.text(`Puesto: ${data.puesto}`, col2, y)
  }
  if (data.rfcTrabajador) {
    doc.text(`RFC: ${data.rfcTrabajador}`, col2, y + (data.puesto ? 4 : 0))
  }
  y += data.puesto || data.rfcTrabajador ? 12 : 6

  // Labor data
  doc.setDrawColor(...line)
  doc.line(margin, y, pageW - margin, y)
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...blue)
  doc.text('DATOS LABORALES', margin, y)
  y += 5

  const laborRows: [string, string][] = [
    ['Fecha de ingreso', formatDate(data.fechaIngreso)],
    ['Fecha de baja', formatDate(data.fechaBaja)],
    [
      'Antigüedad',
      `${result.seniority.yearsComplete} año(s) · ${result.seniority.totalDays} días`,
    ],
    ['Salario diario', money(result.salarioDiario)],
    [
      'Salario para prima de antigüedad',
      `${money(result.salarioParaPrima)} (tope 2× SM)`,
    ],
    [
      'Vacaciones según tabla',
      `${result.seniority.vacationEntitlementDays} días / año`,
    ],
  ]

  doc.setFontSize(8)
  for (const [label, value] of laborRows) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...muted)
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...navy)
    doc.text(value, margin + 62, y)
    y += 4.5
  }

  y += 4

  // Concepts table
  const tableBody = result.concepts
    .filter((c) => c.incluido)
    .map((c) => [
      c.concepto,
      c.fundamento,
      c.dias != null ? formatNumber(c.dias) : '—',
      money(c.monto),
    ])

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Fundamento', 'Días', 'Importe']],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: navy,
      lineColor: line,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: navy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 42, textColor: muted },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [248, 251, 253] },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8

  // Totals box
  const boxW = 78
  const boxX = pageW - margin - boxW
  doc.setFillColor(245, 249, 252)
  doc.setDrawColor(...blue)
  doc.setLineWidth(0.5)
  doc.roundedRect(boxX, y, boxW, 28, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text('Percepciones', boxX + 4, y + 7)
  doc.text('Descuentos', boxX + 4, y + 13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navy)
  doc.text(money(result.totalPercepciones), boxX + boxW - 4, y + 7, {
    align: 'right',
  })
  doc.text(money(result.totalDescuentos), boxX + boxW - 4, y + 13, {
    align: 'right',
  })

  doc.setDrawColor(...line)
  doc.line(boxX + 4, y + 17, boxX + boxW - 4, y + 17)
  doc.setFontSize(9)
  doc.setTextColor(...blue)
  doc.text('TOTAL NETO', boxX + 4, y + 23)
  doc.setFontSize(11)
  doc.text(money(result.totalNeto), boxX + boxW - 4, y + 23.5, {
    align: 'right',
  })

  y += 36

  if (data.notas.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...blue)
    doc.text('NOTAS', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...navy)
    const notes = doc.splitTextToSize(data.notas.trim(), pageW - margin * 2)
    doc.text(notes, margin, y)
    y += notes.length * 4 + 4
  }

  if (data.elaboro.trim()) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    doc.text(`Elaboró: ${data.elaboro}`, margin, y)
    y += 6
  }

  // Disclaimer
  if (y > pageH - 42) {
    doc.addPage()
    y = 24
  }

  doc.setFillColor(250, 251, 252)
  doc.roundedRect(margin, pageH - 38, pageW - margin * 2, 22, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...muted)
  const disc = doc.splitTextToSize(result.disclaimer, pageW - margin * 2 - 6)
  doc.text(disc, margin + 3, pageH - 33)

  doc.setFontSize(7)
  doc.setTextColor(...blue)
  doc.text('EG EMPRESARIAL', margin, pageH - 10)
  doc.setTextColor(...muted)
  doc.text('Documento confidencial · Uso interno / cliente', pageW - margin, pageH - 10, {
    align: 'right',
  })

  const safeName = (data.trabajadorNombre || 'trabajador')
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ-]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
  const safeEmpresa = (data.empresa || 'empresa')
    .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ-]/gi, '')
    .trim()
    .replace(/\s+/g, '_')

  doc.save(`Finiquito_${safeEmpresa}_${safeName}.pdf`)
}
