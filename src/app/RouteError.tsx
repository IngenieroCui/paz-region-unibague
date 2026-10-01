import { Link } from 'react-router-dom'
import { ErrorState } from '../components/feedback/States'
export default function RouteError() {
  return <main className="status-page"><ErrorState title="No pudimos abrir este espacio" onRetry={() => window.location.reload()} />
    <Link to="/" className="text-link">Volver al inicio</Link></main>
}
