// Thin fetch wrapper. Throws an Error with .errors = {field: message} on 4xx/5xx.
async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`)
    err.errors = data.errors || {}
    throw err
  }
  return data
}

export const api = {
  options: () => request('/options'),
  list: (params) => request(`/patients?${new URLSearchParams(params)}`),
  create: (p) => request('/patients', { method: 'POST', body: JSON.stringify(p) }),
  update: (id, p) => request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  setStatus: (id, status) => request(`/patients/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id) => request(`/patients/${id}`, { method: 'DELETE' }),
}
