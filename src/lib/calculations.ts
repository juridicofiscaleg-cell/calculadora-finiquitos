import { differenceInCalendarDays, getDaysInYear, startOfYear } from 'date-fns'
import {
  AGUINALDO_DIAS,
  PRIMA_ANTIGUEDAD_DIAS,
  PRIMA_VACACIONAL_PCT,
  SMG_2026,
  SMG_ZLFN_2026,
  TERMINATION_OPTIONS,
  type ConceptLine,
  type FiniquitoFormData,
  type FiniquitoResult,
  type SeniorityInfo,
  type TerminationType,
} from './types'
import { parseLocalDate, round2 } from './format'

/** Días de vacaciones anuales según Art. 76 LFT (reforma 2023). */
export function vacationDaysBySeniority(yearsComplete: number): number {
  if (yearsComplete <= 0) return 12
  if (yearsComplete === 1) return 12
  if (yearsComplete === 2) return 14
  if (yearsComplete === 3) return 16
  if (yearsComplete === 4) return 18
  if (yearsComplete === 5) return 20
  const block = Math.floor((yearsComplete - 6) / 5)
  return 22 + block * 2
}

/** Años para prima/indemnización: fracción ≥ 6 meses cuenta como año completo. */
export function yearsWithSixMonthRule(totalDays: number): number {
  const years = Math.floor(totalDays / 365)
  const remainder = totalDays % 365
  return years + (remainder >= 183 ? 1 : 0)
}

export function resolveDailySalary(data: FiniquitoFormData): number {
  if (data.salaryMode === 'mensual') {
    return data.salarioMensual > 0 ? data.salarioMensual / 30 : 0
  }
  return data.salarioDiario > 0 ? data.salarioDiario : 0
}

export function resolveMinWage(data: FiniquitoFormData): number {
  if (data.salarioMinimoDiario > 0) return data.salarioMinimoDiario
  return data.zonaFronteriza ? SMG_ZLFN_2026 : SMG_2026
}

export function computeSeniority(
  fechaIngreso: string,
  fechaBaja: string,
): SeniorityInfo | null {
  const start = parseLocalDate(fechaIngreso)
  const end = parseLocalDate(fechaBaja)
  if (!start || !end || end < start) return null

  const totalDays = differenceInCalendarDays(end, start) + 1
  const yearsExact = totalDays / 365
  const yearsComplete = Math.floor(yearsExact)
  const yearsForPrima = yearsWithSixMonthRule(totalDays)
  const yearsForIndemnizacion = yearsForPrima

  const vacationEntitlementDays = vacationDaysBySeniority(
    yearsComplete < 1 ? 1 : yearsComplete,
  )

  const yearStart = startOfYear(end)
  const daysInCurrentYear =
    differenceInCalendarDays(end, yearStart) + 1
  const yearDays = getDaysInYear(end)

  // Días desde el último aniversario (para vacaciones proporcionales del período)
  const anniversaryThisYear = new Date(
    end.getFullYear(),
    start.getMonth(),
    start.getDate(),
  )
  let periodStart = anniversaryThisYear
  if (anniversaryThisYear > end) {
    periodStart = new Date(
      end.getFullYear() - 1,
      start.getMonth(),
      start.getDate(),
    )
  }
  if (periodStart < start) periodStart = start
  const daysSinceAnniversary = differenceInCalendarDays(end, periodStart) + 1

  return {
    totalDays,
    yearsExact,
    yearsComplete,
    yearsForPrima,
    yearsForIndemnizacion,
    vacationEntitlementDays:
      yearsComplete < 1 ? 12 : vacationEntitlementDays,
    daysInCurrentYear: Math.min(daysInCurrentYear, yearDays),
    daysSinceAnniversary,
  }
}

function push(
  list: ConceptLine[],
  line: Omit<ConceptLine, 'incluido'> & { incluido?: boolean },
) {
  list.push({ incluido: line.incluido ?? true, ...line })
}

export function calculateFiniquito(
  data: FiniquitoFormData,
  terminationType: TerminationType,
): FiniquitoResult | null {
  const seniority = computeSeniority(data.fechaIngreso, data.fechaBaja)
  if (!seniority) return null

  const sd = resolveDailySalary(data)
  if (sd <= 0) return null

  const sm = resolveMinWage(data)
  const salarioParaPrima = Math.min(sd, sm * 2)
  const yearDays = 365
  const concepts: ConceptLine[] = []

  const option = TERMINATION_OPTIONS.find((o) => o.value === terminationType)
  const terminationLabel = option?.label ?? terminationType

  // 1. Salarios pendientes
  if (data.diasPendientesPago > 0) {
    push(concepts, {
      key: 'salarios',
      concepto: 'Salarios pendientes',
      fundamento: 'Art. 82 LFT',
      detalle: `${data.diasPendientesPago} día(s) × salario diario`,
      dias: data.diasPendientesPago,
      monto: round2(data.diasPendientesPago * sd),
    })
  }

  // 2. Aguinaldo proporcional
  const aguinaldoDias =
    (Math.min(seniority.daysInCurrentYear, yearDays) / yearDays) *
    AGUINALDO_DIAS
  push(concepts, {
    key: 'aguinaldo',
    concepto: 'Aguinaldo proporcional',
    fundamento: 'Art. 87 LFT',
    detalle: `(${seniority.daysInCurrentYear}/${yearDays}) × ${AGUINALDO_DIAS} días`,
    dias: round2(aguinaldoDias),
    monto: round2(aguinaldoDias * sd),
  })

  // 3. Vacaciones proporcionales del período
  const vacPropDias =
    (seniority.daysSinceAnniversary / yearDays) *
    seniority.vacationEntitlementDays
  push(concepts, {
    key: 'vacaciones_prop',
    concepto: 'Vacaciones proporcionales',
    fundamento: 'Art. 76 y 79 LFT',
    detalle: `(${seniority.daysSinceAnniversary}/${yearDays}) × ${seniority.vacationEntitlementDays} días de tabla`,
    dias: round2(vacPropDias),
    monto: round2(vacPropDias * sd),
  })

  // 4. Vacaciones no disfrutadas (años anteriores / saldo)
  if (data.vacacionesNoDisfrutadas > 0) {
    push(concepts, {
      key: 'vacaciones_pend',
      concepto: 'Vacaciones no disfrutadas',
      fundamento: 'Art. 79 LFT',
      detalle: `${data.vacacionesNoDisfrutadas} día(s) pendientes de periodos anteriores`,
      dias: data.vacacionesNoDisfrutadas,
      monto: round2(data.vacacionesNoDisfrutadas * sd),
    })
  }

  // 5. Prima vacacional (sobre proporcionales + no disfrutadas)
  const vacTotalDias = vacPropDias + (data.vacacionesNoDisfrutadas || 0)
  const primaVacMonto = vacTotalDias * sd * PRIMA_VACACIONAL_PCT
  push(concepts, {
    key: 'prima_vacacional',
    concepto: 'Prima vacacional (25%)',
    fundamento: 'Art. 80 LFT',
    detalle: `25% sobre ${round2(vacTotalDias)} día(s) de vacaciones`,
    dias: round2(vacTotalDias * PRIMA_VACACIONAL_PCT),
    monto: round2(primaVacMonto),
  })

  // 6. Prima de antigüedad
  const includePrimaAntiguedad =
    terminationType === 'despido_injustificado' ||
    (terminationType === 'renuncia_voluntaria' &&
      seniority.yearsExact >= 15) ||
    (terminationType === 'termino_contrato' && seniority.yearsForPrima > 0)

  // Para término de contrato / obra: la prima suele pagarse; la dejamos incluida
  // cuando hay antigüedad. Despido justificado: no aplica.
  if (terminationType !== 'despido_justificado') {
    const years = seniority.yearsForPrima
    const monto = round2(years * PRIMA_ANTIGUEDAD_DIAS * salarioParaPrima)
    push(concepts, {
      key: 'prima_antiguedad',
      concepto: 'Prima de antigüedad',
      fundamento: 'Art. 162 LFT',
      detalle: `${years} año(s) × ${PRIMA_ANTIGUEDAD_DIAS} días (tope 2× SM: ${salarioParaPrima.toFixed(2)})`,
      dias: years * PRIMA_ANTIGUEDAD_DIAS,
      monto,
      incluido: includePrimaAntiguedad && years > 0,
    })
  }

  // 7–8. Indemnizaciones (solo despido injustificado)
  if (terminationType === 'despido_injustificado') {
    push(concepts, {
      key: 'tres_meses',
      concepto: 'Indemnización constitucional (3 meses)',
      fundamento: 'Art. 48 / 50 LFT',
      detalle: '90 días de salario',
      dias: 90,
      monto: round2(90 * sd),
      incluido: data.incluirTresMeses,
    })

    const yearsInd = seniority.yearsForIndemnizacion
    push(concepts, {
      key: 'veinte_dias',
      concepto: '20 días por año de servicio',
      fundamento: 'Art. 50 LFT',
      detalle: `${yearsInd} año(s) × 20 días`,
      dias: yearsInd * 20,
      monto: round2(yearsInd * 20 * sd),
      incluido: data.incluirVeinteDias && yearsInd > 0,
    })
  }

  // Otros conceptos
  for (const line of data.otrosPercepciones) {
    if (!line.concepto && !line.monto) continue
    push(concepts, {
      key: `otro_${line.id}`,
      concepto: line.concepto || 'Otro concepto',
      fundamento: 'Convenio / acuerdo',
      detalle: 'Concepto adicional capturado',
      monto: round2(line.monto || 0),
      incluido: (line.monto || 0) !== 0,
    })
  }

  // Descuentos (montos negativos en el total)
  for (const line of data.descuentos) {
    if (!line.concepto && !line.monto) continue
    push(concepts, {
      key: `desc_${line.id}`,
      concepto: `Descuento: ${line.concepto || 'Sin descripción'}`,
      fundamento: 'Art. 110 LFT',
      detalle: 'Descuento autorizado / pendiente',
      monto: -round2(Math.abs(line.monto || 0)),
      incluido: (line.monto || 0) !== 0,
    })
  }

  const active = concepts.filter((c) => c.incluido)
  const totalPercepciones = round2(
    active.filter((c) => c.monto > 0).reduce((s, c) => s + c.monto, 0),
  )
  const totalDescuentos = round2(
    Math.abs(
      active.filter((c) => c.monto < 0).reduce((s, c) => s + c.monto, 0),
    ),
  )
  const totalNeto = round2(totalPercepciones - totalDescuentos)

  return {
    terminationType,
    terminationLabel,
    salarioDiario: round2(sd),
    salarioParaPrima: round2(salarioParaPrima),
    seniority,
    concepts,
    totalPercepciones,
    totalDescuentos,
    totalNeto,
    disclaimer:
      'Este documento es una estimación orientativa con base en la Ley Federal del Trabajo. No constituye asesoría jurídica definitiva ni sustituye un convenio o liquidación formal. Los montos pueden variar según contrato colectivo, políticas internas, tope de salario mínimo aplicable y criterios de autoridad.',
  }
}

export function createEmptyForm(): FiniquitoFormData {
  return {
    empresa: '',
    trabajadorNombre: '',
    puesto: '',
    rfcTrabajador: '',
    fechaIngreso: '',
    fechaBaja: new Date().toISOString().slice(0, 10),
    salaryMode: 'mensual',
    salarioMensual: 0,
    salarioDiario: 0,
    diasPendientesPago: 0,
    vacacionesNoDisfrutadas: 0,
    zonaFronteriza: false,
    salarioMinimoDiario: SMG_2026,
    incluirTresMeses: true,
    incluirVeinteDias: true,
    otrosPercepciones: [],
    descuentos: [],
    notas: '',
    elaboro: '',
  }
}

export function newLine(): { id: string; concepto: string; monto: number } {
  return {
    id: crypto.randomUUID(),
    concepto: '',
    monto: 0,
  }
}
