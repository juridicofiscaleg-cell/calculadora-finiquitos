import { useMemo, useState, type FormEvent } from 'react'
import {
  Building2,
  Calculator,
  Download,
  FileText,
  Plus,
  Trash2,
  UserRound,
  Briefcase,
} from 'lucide-react'
import {
  calculateFiniquito,
  createEmptyForm,
  newLine,
  resolveDailySalary,
} from './lib/calculations'
import { downloadFiniquitoPdf } from './lib/pdf'
import { formatDate, formatMoney, formatNumber } from './lib/format'
import {
  SMG_2026,
  SMG_ZLFN_2026,
  TERMINATION_OPTIONS,
  type FiniquitoFormData,
  type TerminationType,
} from './lib/types'
import './App.css'

export default function App() {
  const [form, setForm] = useState<FiniquitoFormData>(createEmptyForm)
  const [terminationType, setTerminationType] =
    useState<TerminationType>('renuncia_voluntaria')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const result = useMemo(() => {
    if (!form.fechaIngreso || !form.fechaBaja) return null
    if (resolveDailySalary(form) <= 0) return null
    return calculateFiniquito(form, terminationType)
  }, [form, terminationType])

  function patch<K extends keyof FiniquitoFormData>(
    key: K,
    value: FiniquitoFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onZonaChange(frontera: boolean) {
    setForm((prev) => ({
      ...prev,
      zonaFronteriza: frontera,
      salarioMinimoDiario: frontera ? SMG_ZLFN_2026 : SMG_2026,
    }))
  }

  async function handlePdf() {
    setError(null)
    if (!result) {
      setError('Completa fechas, salario y datos mínimos para generar el PDF.')
      return
    }
    if (!form.empresa.trim() || !form.trabajadorNombre.trim()) {
      setError('Indica la empresa y el nombre del trabajador.')
      return
    }
    setPdfLoading(true)
    try {
      await downloadFiniquitoPdf(form, result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void handlePdf()
  }

  const selected = TERMINATION_OPTIONS.find((o) => o.value === terminationType)

  return (
    <div className="app">
      <div className="bg-wash" aria-hidden />

      <header className="topbar">
        <div className="brand">
          <img
            src="/logo-eg.png?v=3"
            alt="EG Empresarial"
            className="brand-logo"
            width={796}
            height={586}
          />
          <div className="brand-text">
            <p className="brand-eyebrow">EG Empresarial</p>
            <h1>Calculadora de finiquitos</h1>
          </div>
        </div>
        <p className="topbar-note">
          Estimaciones conforme a la Ley Federal del Trabajo · Listo para PDF
        </p>
      </header>

      <main className="layout">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <section className="block">
            <div className="block-head">
              <Building2 size={18} />
              <h2>Empresa y trabajador</h2>
            </div>

            <label className="field">
              <span>Empresa / patrón</span>
              <input
                required
                value={form.empresa}
                onChange={(e) => patch('empresa', e.target.value)}
                placeholder="Razón social de la empresa"
              />
            </label>

            <div className="grid-2">
              <label className="field">
                <span>Nombre del trabajador</span>
                <input
                  required
                  value={form.trabajadorNombre}
                  onChange={(e) => patch('trabajadorNombre', e.target.value)}
                  placeholder="Nombre completo"
                />
              </label>
              <label className="field">
                <span>Puesto</span>
                <input
                  value={form.puesto}
                  onChange={(e) => patch('puesto', e.target.value)}
                  placeholder="Ej. Auxiliar administrativo"
                />
              </label>
            </div>

            <div className="grid-2">
              <label className="field">
                <span>RFC del trabajador (opcional)</span>
                <input
                  value={form.rfcTrabajador}
                  onChange={(e) =>
                    patch('rfcTrabajador', e.target.value.toUpperCase())
                  }
                  placeholder="XAXX010101000"
                />
              </label>
              <label className="field">
                <span>Elaboró (opcional)</span>
                <input
                  value={form.elaboro}
                  onChange={(e) => patch('elaboro', e.target.value)}
                  placeholder="Nombre de quien calcula"
                />
              </label>
            </div>
          </section>

          <section className="block">
            <div className="block-head">
              <Briefcase size={18} />
              <h2>Tipo de terminación</h2>
            </div>

            <div className="term-grid" role="radiogroup" aria-label="Tipo de terminación">
              {TERMINATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`term-card ${terminationType === opt.value ? 'active' : ''}`}
                  onClick={() => setTerminationType(opt.value)}
                  aria-pressed={terminationType === opt.value}
                >
                  <strong>{opt.label}</strong>
                  <span>{opt.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="block">
            <div className="block-head">
              <UserRound size={18} />
              <h2>Datos para el cálculo</h2>
            </div>

            <div className="grid-2">
              <label className="field">
                <span>Fecha de ingreso</span>
                <input
                  type="date"
                  required
                  value={form.fechaIngreso}
                  onChange={(e) => patch('fechaIngreso', e.target.value)}
                />
              </label>
              <label className="field">
                <span>Fecha de baja</span>
                <input
                  type="date"
                  required
                  value={form.fechaBaja}
                  onChange={(e) => patch('fechaBaja', e.target.value)}
                />
              </label>
            </div>

            <div className="salary-mode">
              <button
                type="button"
                className={form.salaryMode === 'mensual' ? 'active' : ''}
                onClick={() => patch('salaryMode', 'mensual')}
              >
                Salario mensual
              </button>
              <button
                type="button"
                className={form.salaryMode === 'diario' ? 'active' : ''}
                onClick={() => patch('salaryMode', 'diario')}
              >
                Salario diario
              </button>
            </div>

            {form.salaryMode === 'mensual' ? (
              <label className="field">
                <span>Salario mensual (MXN)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={form.salarioMensual || ''}
                  onChange={(e) =>
                    patch('salarioMensual', Number(e.target.value) || 0)
                  }
                  placeholder="15000"
                />
                <em className="hint">
                  Se convierte a diario ÷ 30 →{' '}
                  {formatMoney(resolveDailySalary(form))}
                </em>
              </label>
            ) : (
              <label className="field">
                <span>Salario diario (MXN)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={form.salarioDiario || ''}
                  onChange={(e) =>
                    patch('salarioDiario', Number(e.target.value) || 0)
                  }
                  placeholder="500"
                />
              </label>
            )}

            <div className="grid-2">
              <label className="field">
                <span>Días de salario pendientes</span>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.diasPendientesPago || ''}
                  onChange={(e) =>
                    patch('diasPendientesPago', Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="field">
                <span>Vacaciones no disfrutadas (días)</span>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.vacacionesNoDisfrutadas || ''}
                  onChange={(e) =>
                    patch(
                      'vacacionesNoDisfrutadas',
                      Number(e.target.value) || 0,
                    )
                  }
                />
                <em className="hint">
                  Saldo de periodos anteriores (además de la proporción del año
                  en curso)
                </em>
              </label>
            </div>

            <div className="grid-2">
              <label className="field checkbox">
                <input
                  type="checkbox"
                  checked={form.zonaFronteriza}
                  onChange={(e) => onZonaChange(e.target.checked)}
                />
                <span>Zona Libre de la Frontera Norte (SM $440.87)</span>
              </label>
              <label className="field">
                <span>Salario mínimo diario (tope prima)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.salarioMinimoDiario || ''}
                  onChange={(e) =>
                    patch('salarioMinimoDiario', Number(e.target.value) || 0)
                  }
                />
              </label>
            </div>

            {terminationType === 'despido_injustificado' && (
              <div className="indemn-toggles">
                <label className="field checkbox">
                  <input
                    type="checkbox"
                    checked={form.incluirTresMeses}
                    onChange={(e) =>
                      patch('incluirTresMeses', e.target.checked)
                    }
                  />
                  <span>Incluir indemnización de 3 meses</span>
                </label>
                <label className="field checkbox">
                  <input
                    type="checkbox"
                    checked={form.incluirVeinteDias}
                    onChange={(e) =>
                      patch('incluirVeinteDias', e.target.checked)
                    }
                  />
                  <span>Incluir 20 días por año</span>
                </label>
              </div>
            )}
          </section>

          <section className="block">
            <div className="block-head">
              <FileText size={18} />
              <h2>Otros conceptos y descuentos</h2>
            </div>

            <div className="lines">
              <div className="lines-head">
                <h3>Percepciones extras</h3>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    patch('otrosPercepciones', [
                      ...form.otrosPercepciones,
                      newLine(),
                    ])
                  }
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>
              {form.otrosPercepciones.map((line, idx) => (
                <div className="line-row" key={line.id}>
                  <input
                    placeholder="Concepto"
                    value={line.concepto}
                    onChange={(e) => {
                      const next = [...form.otrosPercepciones]
                      next[idx] = { ...line, concepto: e.target.value }
                      patch('otrosPercepciones', next)
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Monto"
                    value={line.monto || ''}
                    onChange={(e) => {
                      const next = [...form.otrosPercepciones]
                      next[idx] = {
                        ...line,
                        monto: Number(e.target.value) || 0,
                      }
                      patch('otrosPercepciones', next)
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Eliminar"
                    onClick={() =>
                      patch(
                        'otrosPercepciones',
                        form.otrosPercepciones.filter((l) => l.id !== line.id),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="lines">
              <div className="lines-head">
                <h3>Descuentos</h3>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    patch('descuentos', [...form.descuentos, newLine()])
                  }
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>
              {form.descuentos.map((line, idx) => (
                <div className="line-row" key={line.id}>
                  <input
                    placeholder="Concepto"
                    value={line.concepto}
                    onChange={(e) => {
                      const next = [...form.descuentos]
                      next[idx] = { ...line, concepto: e.target.value }
                      patch('descuentos', next)
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Monto"
                    value={line.monto || ''}
                    onChange={(e) => {
                      const next = [...form.descuentos]
                      next[idx] = {
                        ...line,
                        monto: Number(e.target.value) || 0,
                      }
                      patch('descuentos', next)
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Eliminar"
                    onClick={() =>
                      patch(
                        'descuentos',
                        form.descuentos.filter((l) => l.id !== line.id),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <label className="field">
              <span>Notas para el PDF</span>
              <textarea
                rows={3}
                value={form.notas}
                onChange={(e) => patch('notas', e.target.value)}
                placeholder="Observaciones, convenio, o aclaraciones para el cliente…"
              />
            </label>
          </section>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setForm(createEmptyForm())
                setTerminationType('renuncia_voluntaria')
                setError(null)
              }}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!result || pdfLoading}
              onClick={() => void handlePdf()}
            >
              <Download size={16} />
              {pdfLoading ? 'Generando…' : 'Descargar PDF'}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </form>

        <aside className="panel results-panel">
          <div className="results-head">
            <Calculator size={18} />
            <div>
              <h2>Resultado</h2>
              <p>{selected?.label ?? '—'}</p>
            </div>
          </div>

          {!result ? (
            <div className="empty-state">
              <p>
                Completa empresa, trabajador, fechas y salario para ver el
                desglose en vivo.
              </p>
            </div>
          ) : (
            <>
              <div className="total-hero">
                <span>Total neto estimado</span>
                <strong>{formatMoney(result.totalNeto)}</strong>
                <em>
                  {form.empresa || 'Empresa'} · {form.trabajadorNombre || 'Trabajador'}
                </em>
              </div>

              <dl className="meta-grid">
                <div>
                  <dt>Ingreso</dt>
                  <dd>{formatDate(form.fechaIngreso)}</dd>
                </div>
                <div>
                  <dt>Baja</dt>
                  <dd>{formatDate(form.fechaBaja)}</dd>
                </div>
                <div>
                  <dt>Antigüedad</dt>
                  <dd>
                    {result.seniority.yearsComplete} a ·{' '}
                    {result.seniority.totalDays} d
                  </dd>
                </div>
                <div>
                  <dt>Salario diario</dt>
                  <dd>{formatMoney(result.salarioDiario)}</dd>
                </div>
              </dl>

              <ul className="concept-list">
                {result.concepts.map((c) => (
                  <li
                    key={c.key}
                    className={!c.incluido ? 'excluded' : c.monto < 0 ? 'discount' : ''}
                  >
                    <div>
                      <strong>{c.concepto}</strong>
                      <span>{c.detalle}</span>
                      <em>{c.fundamento}</em>
                    </div>
                    <div className="concept-right">
                      {c.dias != null && (
                        <span className="days">{formatNumber(c.dias)} d</span>
                      )}
                      <b>{formatMoney(c.monto)}</b>
                      {!c.incluido && <small>No aplica</small>}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="totals-foot">
                <div>
                  <span>Percepciones</span>
                  <b>{formatMoney(result.totalPercepciones)}</b>
                </div>
                <div>
                  <span>Descuentos</span>
                  <b>{formatMoney(result.totalDescuentos)}</b>
                </div>
                <div className="net">
                  <span>Neto</span>
                  <b>{formatMoney(result.totalNeto)}</b>
                </div>
              </div>

              <p className="disclaimer">{result.disclaimer}</p>
            </>
          )}
        </aside>
      </main>

      <footer className="footer">
        <span>EG Empresarial</span>
        <span>Herramienta interna de estimación laboral</span>
      </footer>
    </div>
  )
}
