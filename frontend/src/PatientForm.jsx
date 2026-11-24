import { useEffect, useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { validatePatient, maxDate } from './validation'

const EMPTY = { name: '', age: '', gender: '', ward: '', department: '', doctor: '', admission_date: '' }

export default function PatientForm({ patient, options, onSave, onClose }) {
  const isEdit = Boolean(patient?.id)
  const [form, setForm] = useState(() =>
    patient ? { ...EMPTY, ...patient, age: String(patient.age) } : { ...EMPTY, admission_date: maxDate(options) })
  const [touched, setTouched] = useState({})
  const [serverErrors, setServerErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef(null)

  useEffect(() => {
    const d = dialogRef.current
    if (!d.open) d.showModal()
    d.querySelector('[name="name"]').focus() // showModal would otherwise focus the close button
  }, [])

  const errors = { ...validatePatient(form, options), ...serverErrors }
  const show = (f) => touched[f] && errors[f]
  const doctors = options.doctorsByDepartment[form.department] || []

  function set(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value }
      // Changing department resets a doctor who doesn't work there
      if (field === 'department' && !(options.doctorsByDepartment[value] || []).includes(f.doctor)) next.doctor = ''
      return next
    })
    // drop (not undefined-out) the keys, or the spread below would hide client errors
    setServerErrors(({ [field]: _f, form: _x, ...rest }) => rest)
    setSubmitError('')
  }
  // Skipping past an empty field isn't an error yet; "required" shows after a submit attempt
  const blur = (f) => form[f] !== '' && setTouched((t) => ({ ...t, [f]: true }))

  async function submit(e) {
    e.preventDefault()
    setTouched(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, true])))
    const clientErrors = validatePatient(form, options)
    if (Object.keys(clientErrors).length) {
      dialogRef.current.querySelector(`[name="${Object.keys(clientErrors)[0]}"]`)?.focus()
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, name: form.name.trim().replace(/\s+/g, ' '), age: Number(form.age) }
      delete payload.id; delete payload.status; delete payload.discharge_date
      await onSave(payload)
    } catch (err) {
      setServerErrors(err.errors || {})
      setSubmitError(err.message)
      setSaving(false)
    }
  }

  // `extra` always shows (e.g. date shortcuts); `hint` gives way to the error message
  const field = (name, label, input, hint, extra) => (
    <label className={`field ${show(name) ? 'has-error' : ''}`}>
      <span className="field-label">{label} <b aria-hidden>*</b></span>
      {input}
      {extra}
      {show(name)
        ? <span className="field-error" id={`${name}-err`} role="alert">{errors[name]}</span>
        : hint && <span className="field-hint">{hint}</span>}
    </label>
  )
  const common = (name) => ({
    name, value: form[name], onChange: (e) => set(name, e.target.value), onBlur: () => blur(name),
    'aria-invalid': Boolean(show(name)), 'aria-describedby': show(name) ? `${name}-err` : undefined,
  })
  const select = (name, list, placeholder, extra = {}) => (
    <select {...common(name)} {...extra}>
      <option value="">{placeholder}</option>
      {list.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <dialog ref={dialogRef} className="sheet" onCancel={(e) => { e.preventDefault(); onClose() }} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <header className="sheet-head">
          <div>
            <h2>{isEdit ? 'Edit patient' : 'Admit a new patient'}</h2>
            <p>{isEdit ? `Updating record #${patient.id}` : 'All fields are required.'}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>

        <div className="sheet-body">
          {submitError && <div className="banner error" role="alert">{submitError}</div>}
          <div className="grid">
            <div className="span-2">
              {field('name', 'Full name',
                <input {...common('name')} placeholder="e.g. Ravi Kumar" autoComplete="off" autoFocus maxLength={60} />,
                'Letters and spaces only')}
            </div>
            {field('age', 'Age',
              <input {...common('age')} type="number" inputMode="numeric" min={0} max={120} step={1} placeholder="0 – 120" />)}
            <fieldset className={`field seg-field ${show('gender') ? 'has-error' : ''}`}>
              <legend className="field-label">Gender <b aria-hidden>*</b></legend>
              <div className="seg" role="radiogroup" aria-invalid={Boolean(show('gender'))}>
                {options.genders.map((g) => (
                  <label key={g} className={form.gender === g ? 'on' : ''}>
                    <input type="radio" name="gender" value={g} checked={form.gender === g}
                      onChange={() => { set('gender', g); blur('gender') }} />
                    {g}
                  </label>
                ))}
              </div>
              {show('gender') && <span className="field-error" role="alert">{errors.gender}</span>}
            </fieldset>
            {field('ward', 'Ward', select('ward', options.wards, 'Select ward'))}
            {field('admission_date', 'Admission date',
              <input {...common('admission_date')} type="date" max={maxDate(options)} />,
              null,
              <span className="quick">
                {[['Today', 0], ['Yesterday', 1]].map(([label, back]) => {
                  const d = new Date(`${maxDate(options)}T00:00:00`); d.setDate(d.getDate() - back)
                  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  return <button key={label} type="button" className={form.admission_date === iso ? 'on' : ''}
                    onClick={() => set('admission_date', iso)}>{label}</button>
                })}
              </span>)}
            {field('department', 'Department', select('department', options.departments, 'Select department'))}
            {field('doctor', 'Doctor',
              select('doctor', doctors, form.department ? 'Select doctor' : 'Pick a department first', { disabled: !form.department }),
              form.department ? `Doctors in ${form.department}` : null)}
          </div>
          {serverErrors.form && <div className="banner error" role="alert">{serverErrors.form}</div>}
        </div>

        <footer className="sheet-foot">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving && <Loader2 size={18} className="spin" />}
            {isEdit ? 'Save changes' : 'Admit patient'}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
