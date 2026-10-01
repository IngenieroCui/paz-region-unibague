import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { appConfig } from '../config/app'
const titles: Record<string, string> = { '/': 'Inicio', '/login': 'Ingresar', '/forgot-password': 'Recuperar acceso', '/unauthorized': 'Acceso restringido' }
export function RouteEffects() {
  const { pathname, hash } = useLocation()
  const previousPath = useRef(pathname)
  useEffect(() => {
    const changed = previousPath.current !== pathname
    previousPath.current = pathname
    document.title = (titles[pathname] ?? 'Mi espacio') + ' · ' + appConfig.name + ' · ' + appConfig.institution
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else {
      window.scrollTo({ top: 0, behavior: 'instant' })
      if (changed) document.getElementById('main')?.focus({ preventScroll: true })
    }
  }, [pathname, hash])
  return null
}
