// Mirrors backend/main.py PatientIn rules so users get instant feedback.
const NAME_RE = /^[A-Za-z]+(?: [A-Za-z]+)*$/

export function todayLocal() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// The hospital's "today" comes from the server (IST) so both sides agree.
export const maxDate = (options) => options.today || todayLocal()

export function validatePatient(p, options) {
  const e = {}
  const name = p.name.trim().replace(/\s+/g, ' ')
  if (!name) e.name = 'Name is required'
  else if (name.length > 60) e.name = 'Name must be 60 characters or fewer'
  else if (!NAME_RE.test(name)) e.name = 'Name can contain letters and spaces only'

  if (p.age === '' || p.age === null) e.age = 'Age is required'
  else if (!Number.isInteger(Number(p.age))) e.age = 'Age must be a whole number'
  else if (Number(p.age) < 0 || Number(p.age) > 120) e.age = 'Age must be between 0 and 120'

  const lists = { gender: options.genders, ward: options.wards, department: options.departments }
  for (const [field, list] of Object.entries(lists)) {
    const label = field[0].toUpperCase() + field.slice(1)
    if (!p[field]) e[field] = `${label} is required`
    else if (!list.includes(p[field])) e[field] = `Choose a valid ${field}`
  }
  const doctors = options.doctorsByDepartment[p.department] || []
  if (!p.doctor) e.doctor = 'Doctor is required'
  else if (!doctors.includes(p.doctor)) e.doctor = 'Choose a doctor from this department'

  if (!p.admission_date) e.admission_date = 'Admission date is required'
  else if (p.admission_date > maxDate(options)) e.admission_date = 'Admission date cannot be in the future'
  return e
}
