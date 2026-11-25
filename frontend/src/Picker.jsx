import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'

/**
 * Accessible dropdown (combobox + listbox) used for the filters and the patient form.
 *
 * options: [{ value, label?, count?, group? }]  (plain strings work too)
 * allLabel: adds a first row that clears the value ("All wards"); used by filters
 * clearable: shows an × on the trigger when a value is set
 * Keyboard: ↑ ↓ Home End to move, Enter to pick, Esc to close, type to search.
 */
export default function Picker({
  value, onChange, options = [], placeholder = 'Select', icon: Icon, allLabel, allCount, clearable,
  name, invalid, disabled, onClose, labelledBy, ariaLabel, describedBy, variant = 'field', emptyText = 'No matches',
}) {
  const id = useId()
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState(null)

  const items = useMemo(() => options.map((o) => (typeof o === 'string' ? { value: o } : o)), [options])
  const searchable = items.length > 7
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? items.filter((o) => (o.label || o.value).toLowerCase().includes(q)) : items
    return allLabel && !q ? [{ value: '', label: allLabel, count: allCount, all: true }, ...list] : list
  }, [items, query, allLabel, allCount])
  const selected = items.find((o) => o.value === value)

  // Place the menu under the trigger (or above it when there's no room), in viewport coordinates
  // so it is never clipped by a scrolling container such as the form sheet.
  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(Math.max(r.width, 240), window.innerWidth - 24)
    const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12)
    const below = window.innerHeight - r.bottom - 12
    const up = below < 260 && r.top > below
    const maxHeight = Math.min(340, (up ? r.top : below) - 8)
    setPos({ left, width, maxHeight, ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) })
  }
  useLayoutEffect(() => { if (open) place() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) close(false)
    }
    const onMove = () => place()
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    document.addEventListener('animationend', onMove, true) // e.g. the form sheet finishing its open animation
    return () => {
      document.removeEventListener('animationend', onMove, true)
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }) // re-binds each render so close() sees fresh state

  // Keep the highlighted row in view
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function openMenu(seed = '') {
    if (disabled) return
    setQuery(seed)
    const i = shown.findIndex((o) => o.value === value)
    setActive(seed ? 0 : Math.max(0, i))
    setOpen(true)
  }
  // Long lists open with the search box focused, so typing filters right away
  useEffect(() => { if (open && searchable) searchRef.current?.focus() }, [open, searchable])
  function close(refocus = true) {
    setOpen(false)
    setQuery('')
    if (refocus) triggerRef.current?.focus()
    onClose?.()
  }
  function pick(o) {
    onChange(o.value)
    close()
  }

  function onKeyDown(e) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu() }
      else if (searchable && e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openMenu(e.key) }
      else if ((e.key === 'Backspace' || e.key === 'Delete') && clearable && value) { e.preventDefault(); onChange('') }
      return
    }
    const last = shown.length - 1
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(last) }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) pick(shown[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() } // preventDefault keeps a parent <dialog> open
    else if (e.key === 'Tab') close(false)
  }

  let lastGroup
  const listId = `${id}-list`
  return (
    <div className={`picker picker-${variant} ${open ? 'is-open' : ''} ${value ? 'has-value' : ''} ${invalid ? 'is-invalid' : ''}`} onKeyDown={onKeyDown}
      // Close when focus moves anywhere outside this picker (Tab away, another picker, etc.)
      onBlur={(e) => { if (open && !e.currentTarget.contains(e.relatedTarget) && !listRef.current?.contains(e.relatedTarget)) close(false) }}>
      <button
        ref={triggerRef} type="button" name={name} className="picker-trigger" disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : ariaLabel}
        aria-invalid={invalid || undefined} aria-describedby={describedBy}
        aria-activedescendant={open && !searchable && shown[active] ? `${id}-o${active}` : undefined}
        onClick={() => (open ? close() : openMenu())}
      >
        {Icon && <Icon size={16} className="picker-icon" aria-hidden />}
        <span className={`picker-value ${selected ? '' : 'is-placeholder'}`}>{selected ? (selected.label || selected.value) : placeholder}</span>
        <ChevronDown size={16} className="picker-chevron" aria-hidden />
      </button>
      {clearable && value && !disabled && (
        <button type="button" className="picker-clear" aria-label={`Clear ${ariaLabel || 'selection'}`}
          onClick={() => { onChange(''); triggerRef.current?.focus() }}>
          <X size={14} />
        </button>
      )}

      {open && pos && createPortal(
        // Rendered at the top level (or inside the open <dialog>, which sits in the top layer) so no
        // animated/transformed parent can clip it, offset it, or paint over it
        <div className="picker-menu" ref={listRef} style={{ ...pos, maxHeight: undefined }}
          // Keep focus where it is while clicking options (Safari doesn't focus buttons on click)
          onPointerDown={(e) => { if (e.target.tagName !== 'INPUT') e.preventDefault() }}>
          {searchable && (
            <div className="picker-search">
              <Search size={15} aria-hidden />
              <input ref={searchRef} value={query} placeholder="Type to search…" aria-label="Search options"
                aria-controls={listId} aria-activedescendant={shown[active] ? `${id}-o${active}` : undefined}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }} />
            </div>
          )}
          <div className="picker-list" id={listId} role="listbox" aria-label={ariaLabel} style={{ maxHeight: pos.maxHeight - (searchable ? 52 : 0) }}>
            {shown.length === 0 && <div className="picker-empty">{emptyText}</div>}
            {shown.map((o, i) => {
              const header = o.group && o.group !== lastGroup ? (lastGroup = o.group) : null
              const isSel = o.all ? !value : o.value === value
              return (
                <div key={o.all ? '__all' : o.value} role="presentation">
                  {header && <div className="picker-group" role="presentation">{header}</div>}
                  <button
                    type="button" id={`${id}-o${i}`} data-i={i} role="option" aria-selected={isSel} tabIndex={-1}
                    className={`picker-option ${i === active ? 'is-active' : ''} ${o.all ? 'is-all' : ''} ${o.count === 0 ? 'is-zero' : ''}`}
                    onPointerMove={() => setActive(i)} onClick={() => pick(o)}
                  >
                    <span className="picker-check" aria-hidden>{isSel && <Check size={15} />}</span>
                    <span className="picker-label">{o.label || o.value}</span>
                    {o.count !== undefined && <span className="picker-count">{o.count}</span>}
                  </button>
                </div>
              )
            })}
          </div>
        </div>,
        triggerRef.current?.closest('dialog') || document.body,
      )}
    </div>
  )
}
