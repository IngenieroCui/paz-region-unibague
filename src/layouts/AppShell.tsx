import { UnsavedChanges } from '../components/forms/UnsavedChanges'
import { useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { Sidebar } from '../components/navigation/Sidebar'
import { Topbar } from '../components/navigation/Topbar'
import { IconButton } from '../components/ui/Button'
import { Footer } from '../components/layout/Footer'
import { rolePaths } from '../config/app'
import type { Role } from '../config/app'

export function AppShell({ role, preview = false }: { role: Role; preview?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const location = useLocation()
  const basePath = (preview ? '/dev/' : '/app/') + rolePaths[role]
  function closeMenu() { dialog.current?.close() }
  return <div className="app-shell"><a className="skip-link" href="#main">Saltar al contenido</a>
    <aside className="desktop-sidebar"><Sidebar role={role} basePath={basePath} preview={preview} /></aside>
    <dialog ref={dialog} className="mobile-drawer" aria-labelledby="drawer-title">
      <div className="drawer-header"><strong id="drawer-title">Navegación</strong><IconButton label="Cerrar navegación" onClick={closeMenu}><X aria-hidden="true" size={22} /></IconButton></div>
      <Sidebar role={role} basePath={basePath} preview={preview} onNavigate={closeMenu} />
    </dialog>
    <div className="shell-body"><Topbar role={role} preview={preview} onOpenMenu={() => dialog.current?.showModal()} />
      {preview && <div className="preview-banner"><strong>Vista de desarrollo</strong><span>Datos de ejemplo. No representa una sesión ni un proceso real.</span></div>}
      <main id="main" key={location.pathname} tabIndex={-1} className="workspace"><UnsavedChanges><Outlet /></UnsavedChanges></main><Footer /></div>
  </div>
}
