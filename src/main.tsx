import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'
import './styles/components.css'
import './styles/public.css'
import './styles/workspace.css'
import './styles/modules.css'
const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el contenedor de la aplicación.')
createRoot(root).render(<StrictMode><App /></StrictMode>)
