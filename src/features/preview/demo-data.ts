// Development-only fixtures. Never import from real repositories/services.
export const studentDemo = {
  completion: 60,
  steps: [
    { title: 'Información básica', description: 'Primer punto de partida de tu perfil.', completed: true },
    { title: 'Perfil académico', description: 'Una mirada a tu formación y tus intereses.', completed: false },
    { title: 'Preparación del proceso', description: 'El siguiente paso se definirá con el programa.', completed: false },
  ],
}
export const organizationDemo = { projects: '02', requests: '04', pending: '01' }
export const adminDemo = {
  metrics: { students: '128', organizations: '24', projects: '36', positions: '52' },
  queue: [
    { id: 'example-01', name: 'Organización de ejemplo A', kind: 'Organización', state: 'Por revisar', tone: 'warning' },
    { id: 'example-02', name: 'Proyecto de ejemplo B', kind: 'Proyecto', state: 'En preparación', tone: 'info' },
    { id: 'example-03', name: 'Organización de ejemplo C', kind: 'Organización', state: 'Por revisar', tone: 'warning' },
  ],
} as const
