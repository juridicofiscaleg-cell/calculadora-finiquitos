export type TerminationType =
  | 'renuncia_voluntaria'
  | 'despido_injustificado'
  | 'despido_justificado'
  | 'termino_contrato'

export type SalaryInputMode = 'diario' | 'mensual'

export interface OtherLine {
  id: string
  concepto: string
  monto: number
}

export interface FiniquitoFormData {
  empresa: string
  trabajadorNombre: string
  puesto: string
  rfcTrabajador: string
  fechaIngreso: string
  fechaBaja: string
  salaryMode: SalaryInputMode
  salarioMensual: number
  salarioDiario: number
  diasPendientesPago: number
  vacacionesNoDisfrutadas: number
  zonaFronteriza: boolean
  salarioMinimoDiario: number
  incluirTresMeses: boolean
  incluirVeinteDias: boolean
  otrosPercepciones: OtherLine[]
  descuentos: OtherLine[]
  notas: string
  elaboro: string
}

export interface ConceptLine {
  key: string
  concepto: string
  fundamento: string
  detalle: string
  dias?: number
  monto: number
  incluido: boolean
}

export interface SeniorityInfo {
  totalDays: number
  yearsExact: number
  yearsComplete: number
  yearsForPrima: number
  yearsForIndemnizacion: number
  vacationEntitlementDays: number
  daysInCurrentYear: number
  daysSinceAnniversary: number
}

export interface FiniquitoResult {
  terminationType: TerminationType
  terminationLabel: string
  salarioDiario: number
  salarioParaPrima: number
  seniority: SeniorityInfo
  concepts: ConceptLine[]
  totalPercepciones: number
  totalDescuentos: number
  totalNeto: number
  disclaimer: string
}

export const TERMINATION_OPTIONS: {
  value: TerminationType
  label: string
  short: string
  description: string
}[] = [
  {
    value: 'renuncia_voluntaria',
    label: 'Renuncia voluntaria',
    short: 'Renuncia',
    description:
      'Finiquito: salarios, aguinaldo, vacaciones y prima vacacional. Prima de antigüedad solo con 15 años o más.',
  },
  {
    value: 'despido_injustificado',
    label: 'Despido injustificado',
    short: 'Injustificado',
    description:
      'Liquidación completa: finiquito + 3 meses + 20 días por año + prima de antigüedad.',
  },
  {
    value: 'despido_justificado',
    label: 'Despido justificado',
    short: 'Justificado',
    description:
      'Solo finiquito (salarios, aguinaldo, vacaciones y prima vacacional). Sin indemnización.',
  },
  {
    value: 'termino_contrato',
    label: 'Término de contrato / obra',
    short: 'Término',
    description:
      'Finiquito por conclusión de la relación laboral sin responsabilidad para las partes.',
  },
]

export const SMG_2026 = 315.04
export const SMG_ZLFN_2026 = 440.87
export const AGUINALDO_DIAS = 15
export const PRIMA_VACACIONAL_PCT = 0.25
export const PRIMA_ANTIGUEDAD_DIAS = 12
