import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, UserPlus, ListChecks, SlidersHorizontal, Search, Pencil, Trash2, LogOut, MonitorSmartphone,
  ShieldCheck, Server, Database, CodeXml,
} from 'lucide-react'
import { api } from './api'
import ThemeToggle from './ThemeToggle'

const REPO = 'https://github.com/mdayan8/wardbook-patient-admission'

const FEATURES = [
  { icon: UserPlus, title: 'Admit a patient', text: 'One short form. Doctors are filtered to the department you pick.' },
  { icon: ListChecks, title: 'See every patient', text: 'A table on desktop, readable cards on phones and tablets.' },
  { icon: SlidersHorizontal, title: 'Filter the wards', text: 'Narrow by ward, department and doctor, all at once.' },
  { icon: Search, title: 'Find by name', text: 'Type a few letters. Matches are highlighted as you go.' },
  { icon: Pencil, title: 'Edit records', text: 'Fix a ward or a doctor in seconds, with the same checks.' },
  { icon: Trash2, title: 'Delete safely', text: 'A clear confirmation step before anything is removed.' },
  { icon: LogOut, title: 'Discharge in one tap', text: 'Marks the date automatically, with Undo if you slip.' },
  { icon: MonitorSmartphone, title: 'Any screen', text: 'Built for phones at the bedside and desktops at the desk.' },
]

const RULES = [
  ['Name', 'Required, letters only'],
  ['Age', 'Required, 0 to 120'],
  ['Gender, Ward, Department, Doctor', 'Required, from the list'],
  ['Admission date', 'Required, never in the future'],
]

// Fades sections in as they scroll into view
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
    }), { threshold: 0.15 })
    els.forEach((e) => io.observe(e))
    // Safety net: never leave content hidden if the observer doesn't fire (old browsers, print, background tabs)
    const t = setTimeout(() => els.forEach((e) => e.classList.add('in')), 2500)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [])
}

export default function Landing() {
  const [patients, setPatients] = useState(null)
  const navRef = useRef(null)
  useReveal()

  useEffect(() => {
    api.list({}).then(setPatients).catch(() => setPatients([]))
    const onScroll = () => navRef.current?.classList.toggle('scrolled', window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const admitted = patients?.filter((p) => p.status === 'Admitted').length
  const preview = (patients || []).slice(0, 4)

  return (
    <div className="landing">
      <nav className="l-nav" ref={navRef}>
        <a href="/" className="l-brand">Wardbook<span className="dot">.</span></a>
        <div className="l-links">
          <a href="#features">Features</a>
          <a href="#checks">Validation</a>
          <a href="#stack">Stack</a>
        </div>
        <span className="l-toggle"><ThemeToggle /></span>
        <a href="/app" className="btn primary l-cta-sm">Open app <ArrowRight size={16} /></a>
      </nav>

      <header className="l-hero">
        <p className="l-live hero-in">
          <i aria-hidden />
          {patients === null ? 'Connecting to the wards…' : `Live: ${admitted} patient${admitted === 1 ? '' : 's'} admitted right now`}
        </p>
        <h1 className="hero-in">Every admission,<br />on one calm page<span className="dot">.</span></h1>
        <p className="l-sub hero-in">
          Wardbook helps hospital staff admit, find, update and discharge patients without the paperwork shuffle.
          It works the same on a bedside phone and a nursing-station desktop.
        </p>
        <div className="l-ctas hero-in">
          <a href="/app" className="btn primary l-cta">Open the ward board <ArrowRight size={18} /></a>
          <a href={REPO} className="btn outline l-cta" target="_blank" rel="noreferrer"><CodeXml size={18} /> View the code</a>
        </div>

        <div className="l-preview hero-in" aria-label="Live preview of the patient list">
          <div className="l-window">
            <div className="l-window-bar"><span /><span /><span /><em>wardbook / ward board</em></div>
            <div className="l-rows">
              {patients === null
                ? [0, 1, 2, 3].map((i) => <div key={i} className="l-row sk-line" />)
                : preview.map((p, i) => (
                  <div key={p.id} className="l-row" style={{ '--i': i }}>
                    <span className="avatar">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                    <span className="l-row-name"><b>{p.name}</b><small>{p.age} yrs · {p.ward}</small></span>
                    <span className="l-row-doc">{p.department}<small>{p.doctor}</small></span>
                    <span className={`badge ${p.status.toLowerCase()}`}><i />{p.status}</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="l-float l-float-a"><LogOut size={15} /> Patient discharged <b>Undo</b></div>
          <div className="l-float l-float-b"><ShieldCheck size={15} /> Age must be between 0 and 120</div>
        </div>
      </header>

      <section id="features" className="l-section">
        <p className="eyebrow reveal">What it does</p>
        <h2 className="reveal">Everything the ward desk needs<span className="dot">.</span></h2>
        <div className="l-grid">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <article key={title} className="l-card reveal" style={{ '--i': i % 4 }}>
              <span className="l-icon"><Icon size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="checks" className="l-section l-checks">
        <div className="reveal">
          <p className="eyebrow">Checked twice</p>
          <h2>Bad data never reaches the record<span className="dot">.</span></h2>
          <p className="l-lead">
            Every rule runs in the browser for instant feedback, then again on the server.
            If anything slips through, the API rejects it with a plain-English message.
          </p>
        </div>
        <div className="l-rules reveal">
          {RULES.map(([field, rule]) => (
            <div key={field} className="l-rule">
              <span>{field}</span><b>{rule}</b>
              <em><ShieldCheck size={14} /> Browser</em><em><Server size={14} /> Server</em>
            </div>
          ))}
          <pre className="l-code">{'POST /api/patients  →  422\n{ "message": "Admission date cannot be in the future" }'}</pre>
        </div>
      </section>

      <section id="stack" className="l-section">
        <p className="eyebrow reveal">Under the hood</p>
        <h2 className="reveal">Simple parts, chosen on purpose<span className="dot">.</span></h2>
        <div className="l-stack">
          {[
            ['React', 'The interface: fast, no UI kit, plain CSS'],
            ['FastAPI · Python', 'The API, with typed validation'],
            ['PostgreSQL', 'Records survive restarts and redeploys'],
            ['Vercel', 'One URL for the app and its API'],
          ].map(([name, text], i) => (
            <div key={name} className="l-stack-item reveal" style={{ '--i': i }}>
              {i === 2 ? <Database size={18} /> : i === 1 ? <Server size={18} /> : <span className="l-dot" />}
              <b>{name}</b><span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="l-final reveal">
        <h2>Ready for the next admission<span className="dot">.</span></h2>
        <p>No sign-up needed. Open the board and add a patient.</p>
        <a href="/app" className="btn primary l-cta">Open the ward board <ArrowRight size={18} /></a>
      </section>

      <footer className="l-foot">
        <span>Wardbook<span className="dot">.</span> Patient admission management</span>
        <a href={REPO} target="_blank" rel="noreferrer"><CodeXml size={15} /> Source on GitHub</a>
      </footer>
    </div>
  )
}
