import './App.css'
import Footer from './components/Footer'

function App() {
  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <img src="/logos/web/icon-192.png" alt="Unibagué Logo" className="logo" />
          <div className="logo-text">
            <span className="brand-title">Paz y Región</span>
            <span className="brand-subtitle">Universidad de Ibagué</span>
          </div>
        </div>
        <nav className="nav-menu">
          <button className="nav-link">Inicio</button>
          <button className="nav-link">Convocatorias</button>
          <button className="nav-link">Noticias</button>
          <div style={{ display: 'flex', gap: '0.75rem', marginLeft: '1rem' }}>
            <button className="btn-primary">Ingreso Estudiantes</button>
            <button className="btn-secondary">Ingreso Empresas</button>
          </div>
        </nav>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              Construyendo <span className="highlight">Paz</span> y{' '}
              <span className="highlight">Región</span>
            </h1>
            <p className="hero-description">
              Un programa de la Universidad de Ibagué comprometido con el
              desarrollo, la paz y la transformación social de nuestro territorio.
            </p>
            <div className="hero-actions">
              <button className="btn-primary large">Descubre el Programa</button>
              <button className="btn-secondary large">Dona aquí</button>
            </div>
          </div>
          <div className="hero-image-container">
            <div className="hero-image-placeholder">
              <div className="hero-shape"></div>
            </div>
          </div>
        </section>

        <section className="roles-section">
          <h2>Información por perfiles</h2>
          <div className="roles-grid">
            <div className="role-card" style={{ '--role-color': '#6F42C1' } as React.CSSProperties}>
              <div className="role-icon">🎓</div>
              <h3>Futuros Estudiantes</h3>
              <p>Descubre cómo ser parte de Paz y Región.</p>
            </div>
            <div className="role-card" style={{ '--role-color': '#DC3545' } as React.CSSProperties}>
              <div className="role-icon">📝</div>
              <h3>Estudiantes Actuales</h3>
              <p>Información, fechas y recursos importantes.</p>
            </div>
            <div className="role-card" style={{ '--role-color': '#FFC107' } as React.CSSProperties}>
              <div className="role-icon">👩‍🏫</div>
              <h3>Profesores</h3>
              <p>Convocatorias y guías para docentes.</p>
            </div>
            <div className="role-card" style={{ '--role-color': '#0D6EFD' } as React.CSSProperties}>
              <div className="role-icon">🎓</div>
              <h3>Graduados</h3>
              <p>Mantente conectado con nuestra red.</p>
            </div>
            <div className="role-card" style={{ '--role-color': '#198754' } as React.CSSProperties}>
              <div className="role-icon">💼</div>
              <h3>Empresarios</h3>
              <p>Alianzas y proyectos conjuntos.</p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

export default App
