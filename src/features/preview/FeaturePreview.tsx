import { useLocation } from 'react-router-dom'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/feedback/States'
import { navigation } from '../../config/navigation'
import type { Role } from '../../config/app'
export default function FeaturePreview({ role }: { role: Role }) {
  const location = useLocation()
  const segment = location.pathname.split('/').at(-1)
  const feature = navigation[role].find(item => item.path === segment)
  return <><PageHeader eyebrow="ESPACIO PREPARADO" title={feature?.label ?? 'Próximamente'} description="Este módulo se completará en las siguientes fases." />
    <Card><EmptyState title="El siguiente capítulo está por comenzar">La estructura de navegación ya está preparada. Esta vista de desarrollo no almacena información ni realiza operaciones institucionales.</EmptyState></Card></>
}
