import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Search, X, Pencil, Trash2, LogOut, RotateCcw, BedDouble, Stethoscope,
  Building2, CalendarDays, Users, UserCheck, UserMinus, SlidersHorizontal, Loader2, AlertTriangle,
} from 'lucide-react'
import { api } from './api'
import PatientForm from './PatientForm'

const NO_FILTERS = { search: '', ward: '', department: '', doctor: '', status: '' }

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
const daysSince = (iso, until) => {
  const end = until ? new Date(`${until}T00:00:00`) : new Date()
  return Math.max(0, Math.floor((end - new Date(`${iso}T00:00:00`)) / 86400000))
}

export default function App() {
  const [options, setOptions] = useState(null)
  const [patients, setPatients] = useState([])
  const [allCounts, setAllCounts] = useState({ total: 0, admitted: 0, discharged: 0 })
  const [filters, setFilters] = useState(NO_FILTERS)
  const [query, setQuery] = useState('') // debounced copy of filters.search
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(null) // null | {} (new) | patient
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const toastTimer = useRef()

  const notify = useCallback((msg, action) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, action, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 3500)
  }, [])

  useEffect(() => {
    api.options().then(setOptions).catch((e) => setLoadError(e.message))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setQuery(filters.search), 250)
    return () => clearTimeout(t)
  }, [filters.search])

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, search: query }).filter(([, v]) => v))
      const [rows, all] = await Promise.all([api.list(params), api.list({})])
      setPatients(rows)
      setAllCounts({
        total: all.length,
        admitted: all.filter((p) => p.status === 'Admitted').length,
        discharged: all.filter((p) => p.status === 'Discharged').length,
      })
      setLoadError('')
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters.ward, filters.department, filters.doctor, filters.status, query]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const setFilter = (key, value) =>
    setFilters((f) => {
      const next = { ...f, [key]: value }
      // keep the doctor filter consistent with the chosen department
      if (key === 'department' && value && options && !options.doctorsByDepartment[value].includes(f.doctor)) next.doctor = ''
      return next
    })
  const activeFilterCount = ['ward', 'department', 'doctor'].filter((k) => filters[k]).length
  const anyFilter = activeFilterCount > 0 || filters.search || filters.status

  const doctorOptions = useMemo(() => {
    if (!options) return []
    return filters.department ? options.doctorsByDepartment[filters.department] : Object.values(options.doctorsByDepartment).flat()
  }, [options, filters.department])

  async function save(payload) {
    if (editing?.id) {
      await api.update(editing.id, payload)
      notify(`${payload.name}'s record updated`)
    } else {
      await api.create(payload)
      notify(`${payload.name} admitted`)
    }
    setEditing(null)
    load()
  }

  async function changeStatus(p, status) {
    try {
      await api.setStatus(p.id, status)
      load()
      if (status === 'Discharged') notify(`${p.name} discharged`, { label: 'Undo', run: () => changeStatus(p, 'Admitted') })
      else notify(`${p.name} re-admitted`)
    } catch (e) { notify(e.message) }
  }

  async function confirmDelete() {
    const p = deleting
    try {
      await api.remove(p.id)
      setDeleting(null)
      notify(`${p.name}'s record deleted`)
      load()
    } catch (e) { setDeleting(null); notify(e.message) }
  }

  const stats = [
    { key: '', label: 'Total', value: allCounts.total, icon: Users },
    { key: 'Admitted', label: 'Admitted', value: allCounts.admitted, icon: UserCheck },
    { key: 'Discharged', label: 'Discharged', value: allCounts.discharged, icon: UserMinus },
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Wardbook<span className="dot">.</span></h1>
          <span className="brand-sub">Patient admissions</span>
        </div>
        <button className="btn primary desktop-only" onClick={() => setEditing({})} disabled={!options}>
          <Plus size={18} /> Add patient
        </button>
      </header>

      <main className="content">
        <section className="hero">
          <p className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h2>{allCounts.admitted} patient{allCounts.admitted === 1 ? '' : 's'} on the wards<span className="dot">.</span></h2>
        </section>

        <section className="stats" aria-label="Filter by status">
          {stats.map(({ key, label, value, icon: Icon }) => (
            <button key={label} className={`stat ${filters.status === key ? 'active' : ''} stat-${key || 'all'}`}
              onClick={() => setFilter('status', key)} aria-pressed={filters.status === key}>
              <span className="stat-label"><Icon size={15} aria-hidden /> {label}</span>
              <strong>{value}</strong>
            </button>
          ))}
        </section>

        <section className="toolbar">
          <div className="search">
            <Search size={18} aria-hidden />
            <input type="search" placeholder="Search by name…" value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)} aria-label="Search patients by name" />
            {filters.search && (
              <button className="icon-btn small" onClick={() => setFilter('search', '')} aria-label="Clear search"><X size={16} /></button>
            )}
          </div>
          <button className={`btn outline filter-toggle ${showFilters ? 'on' : ''}`} onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}>
            <SlidersHorizontal size={18} /> Filters{activeFilterCount > 0 && <span className="pill">{activeFilterCount}</span>}
          </button>
          <div className={`filters ${showFilters ? 'open' : ''}`}>
            <FilterSelect icon={BedDouble} label="Ward" value={filters.ward} list={options?.wards} onChange={(v) => setFilter('ward', v)} />
            <FilterSelect icon={Building2} label="Department" value={filters.department} list={options?.departments} onChange={(v) => setFilter('department', v)} />
            <FilterSelect icon={Stethoscope} label="Doctor" value={filters.doctor} list={doctorOptions} onChange={(v) => setFilter('doctor', v)} />
            {anyFilter && <button className="btn ghost clear" onClick={() => setFilters(NO_FILTERS)}><X size={16} /> Clear all</button>}
          </div>
        </section>

        <div className="result-line" aria-live="polite">
          {!loading && !loadError && (
            <>Showing <b>{patients.length}</b> of {allCounts.total} patient{allCounts.total === 1 ? '' : 's'}</>
          )}
        </div>

        {loadError ? (
          <div className="empty">
            <AlertTriangle size={36} />
            <h3>Couldn’t load patients</h3>
            <p>{loadError}</p>
            <button className="btn primary" onClick={() => { setLoading(true); load(); api.options().then(setOptions).catch(() => {}) }}>Try again</button>
          </div>
        ) : loading ? (
          <div className="list">{[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton" />)}</div>
        ) : patients.length === 0 ? (
          <div className="empty">
            <Users size={36} />
            <h3>{anyFilter ? 'No patients match' : 'No patients yet'}</h3>
            <p>{anyFilter ? 'Try a different name or clear the filters.' : 'Admit your first patient to get started.'}</p>
            {anyFilter
              ? <button className="btn outline" onClick={() => setFilters(NO_FILTERS)}>Clear filters</button>
              : <button className="btn primary" onClick={() => setEditing({})}><Plus size={18} /> Add patient</button>}
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th><th>Ward</th><th>Department &amp; doctor</th><th>Admitted</th><th>Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p, i) => (
                  <tr key={p.id} style={{ '--i': i }}>
                    <td><PatientCell p={p} /></td>
                    <td>{p.ward}</td>
                    <td><div className="two-line"><span>{p.department}</span><small>{p.doctor}</small></div></td>
                    <td><div className="two-line"><span>{fmtDate(p.admission_date)}</span><small>{stayLabel(p)}</small></div></td>
                    <td><StatusBadge p={p} /></td>
                    <td className="right"><Actions p={p} onEdit={setEditing} onDelete={setDeleting} onStatus={changeStatus} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="list cards">
              {patients.map((p, i) => (
                <li key={p.id} className="card" style={{ '--i': i }}>
                  <div className="card-top">
                    <PatientCell p={p} />
                    <StatusBadge p={p} />
                  </div>
                  <dl className="meta">
                    <div><dt><BedDouble size={15} /> Ward</dt><dd>{p.ward}</dd></div>
                    <div><dt><Building2 size={15} /> Department</dt><dd>{p.department}</dd></div>
                    <div><dt><Stethoscope size={15} /> Doctor</dt><dd>{p.doctor}</dd></div>
                    <div><dt><CalendarDays size={15} /> Admitted</dt><dd>{fmtDate(p.admission_date)} · {stayLabel(p)}</dd></div>
                  </dl>
                  <Actions p={p} onEdit={setEditing} onDelete={setDeleting} onStatus={changeStatus} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <button className="fab" onClick={() => setEditing({})} disabled={!options} aria-label="Add patient">
        <Plus size={26} />
      </button>

      {editing && options && (
        <PatientForm patient={editing.id ? editing : null} options={options} onSave={save} onClose={() => setEditing(null)} />
      )}
      {deleting && <ConfirmDelete patient={deleting} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />}

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.msg}</span>
          {toast.action && (
            <button onClick={() => { toast.action.run(); setToast(null) }}><RotateCcw size={15} /> {toast.action.label}</button>
          )}
        </div>
      )}
    </div>
  )
}

function stayLabel(p) {
  const d = daysSince(p.admission_date, p.status === 'Discharged' ? p.discharge_date : null)
  const span = d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'}`
  return p.status === 'Discharged' ? `stayed ${d === 0 ? '< 1 day' : span}` : d === 0 ? 'admitted today' : span
}

function PatientCell({ p }) {
  return (
    <div className="patient">
      <span className={`avatar g-${p.gender.toLowerCase()}`} aria-hidden>{initials(p.name)}</span>
      <div className="two-line">
        <span className="pname">{p.name}</span>
        <small>{p.age} yrs · {p.gender} · #{p.id}</small>
      </div>
    </div>
  )
}

function StatusBadge({ p }) {
  return (
    <span className={`badge ${p.status.toLowerCase()}`}>
      <i aria-hidden />{p.status}
      {p.status === 'Discharged' && p.discharge_date && <em> {fmtDate(p.discharge_date)}</em>}
    </span>
  )
}

function Actions({ p, onEdit, onDelete, onStatus, compact }) {
  const admitted = p.status === 'Admitted'
  return (
    <div className={`actions ${compact ? 'compact' : ''}`}>
      {admitted
        ? <button className="btn soft success" onClick={() => onStatus(p, 'Discharged')} title="Mark as discharged">
            <LogOut size={16} /> Discharge
          </button>
        : <button className="btn soft" onClick={() => onStatus(p, 'Admitted')} title="Re-admit patient">
            <RotateCcw size={16} /> Re-admit
          </button>}
      <button className="btn soft" onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`} title="Edit">
        <Pencil size={16} /><span className="lbl">Edit</span>
      </button>
      <button className="btn soft danger" onClick={() => onDelete(p)} aria-label={`Delete ${p.name}`} title="Delete">
        <Trash2 size={16} /><span className="lbl">Delete</span>
      </button>
    </div>
  )
}

function FilterSelect({ icon: Icon, label, value, list = [], onChange }) {
  return (
    <label className={`filter ${value ? 'set' : ''}`}>
      <Icon size={16} aria-hidden />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Filter by ${label}`}>
        <option value="">All {label === 'Ward' ? 'wards' : label === 'Doctor' ? 'doctors' : 'departments'}</option>
        {list.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function ConfirmDelete({ patient, onConfirm, onClose }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const d = ref.current
    if (!d.open) d.showModal()
  }, [])
  return (
    <dialog ref={ref} className="confirm" onCancel={(e) => { e.preventDefault(); onClose() }} onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}>
      <div className="confirm-body">
        <span className="confirm-icon"><Trash2 size={24} /></span>
        <h2>Delete {patient.name}?</h2>
        <p>This permanently removes the patient’s admission record. This can’t be undone.</p>
      </div>
      <div className="confirm-actions">
        <button className="btn ghost" onClick={onClose} autoFocus>Keep record</button>
        <button className="btn danger-solid" disabled={busy} onClick={async () => { setBusy(true); await onConfirm() }}>
          {busy && <Loader2 size={18} className="spin" />} Delete
        </button>
      </div>
    </dialog>
  )
}
