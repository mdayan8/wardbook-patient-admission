import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Landing from './Landing.jsx'
import './landing.css'

// Two pages, no router needed: "/" is the landing page, anything else (e.g. /app) is the ward board
const Page = window.location.pathname === '/' ? Landing : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
