import { appConfig } from '../../config/app'
export function Footer() {
  return (
    <footer className="footer">
      <span>
        {appConfig.name} <span aria-hidden="true">/</span> {appConfig.institution}
      </span>
      <span>
        Conocimiento que conecta con el territorio. <span aria-hidden="true">/</span> Desarrollado por{' '}
        <a href="https://ingnavs.vercel.app/" target="_blank" rel="noopener noreferrer">
          IngNavs
        </a>
      </span>
    </footer>
  )
}
