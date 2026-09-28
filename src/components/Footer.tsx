'use client';

import './Footer.css';

const Footer = () => {
  const handleWhatsAppClick = () => {
    const message = encodeURIComponent('Me gustaría que me ayudaras con la creación de mi app web');
    const whatsappUrl = `https://wa.me/573025091063?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleIngNavsClick = () => {
    window.open('https://ingnavs.vercel.app/', '_blank');
  };

  return (
    <footer className="footer-container">
      <div className="footer-top">
        {/* Columna 1: Enlaces Rápidos */}
        <div className="footer-col">
          <h4 className="footer-col-title">Enlaces rápidos</h4>
          <ul className="footer-links">
            <li><a href="#">Bienestar Universitario</a></li>
            <li><a href="#">Centro de Servicios</a></li>
            <li><a href="#">Centro de conciliación privado</a></li>
            <li><a href="#">Consultorio Jurídico</a></li>
            <li><a href="#">Consultorios de Psicología</a></li>
            <li><a href="#">Escuela de Verano</a></li>
            <li><a href="#">Gestión Curricular</a></li>
            <li><a href="#">Intranet</a></li>
            <li><a href="#">Pregúntale a la U</a></li>
            <li><a href="#">Unidad de Filantropía</a></li>
            <li><a href="#">Unidad de Emprendimiento</a></li>
            <li><a href="mailto:secretariageneral@unibague.edu.co">Notificaciones judiciales: secretariageneral@unibague.edu.co</a></li>
            <li><a href="mailto:registroacademico@unibague.edu.co">Validación de títulos y certificados académicos: registroacademico@unibague.edu.co</a></li>
          </ul>
        </div>

        {/* Columna 2: Universidad de Ibagué */}
        <div className="footer-col">
          <h4 className="footer-col-title">Universidad de Ibagué</h4>
          <ul className="footer-info">
            <li>Carrera 22 - Calle 67</li>
            <li>Barrio Ambalá</li>
            <li>NIT: 890704382-1</li>
            <li>Resolución 1867 de febrero 27 de 1981</li>
            <li>PBX: (57+) 608 2795225</li>
            <li>Línea gratuita nacional: 01 8000 91 0277</li>
            <li>Ibagué, Tolima - Colombia</li>
            <li><a href="mailto:ventanilla@unibague.edu.co">Recepción correspondencia virtual: ventanilla@unibague.edu.co</a></li>
          </ul>
          <div className="footer-map-buttons">
            <a href="https://www.google.com/maps/place/Universidad+de+Ibagu%C3%A9/@4.4537702,-75.1964406,21z/data=!4m5!3m4!1s0x0:0x9af91f037e28b32!8m2!3d4.450222!4d-75.1994068" target="_blank" rel="noreferrer" className="map-btn map-btn-google">
              Google maps
            </a>
            <a href="https://www.google.com/maps/place/Universidad+de+Ibagu%C3%A9/@4.4537702,-75.1964406,21z/data=!4m6!3m5!1s0x8e38c501c29ca757:0x9af91f037e28b32!8m2!3d4.4491415!4d-75.200056!16s%2Fg%2F122whpvr?entry=ttu&g_ep=EgoyMDI2MDkyMy4wIKXMDSoASAFQAw%3D%3D" target="_blank" rel="noreferrer" className="map-btn map-btn-waze">
              Waze
            </a>
          </div>
        </div>

        {/* Columna 3: Redes Sociales */}
        <div className="footer-col">
          <h4 className="footer-col-title">Redes sociales</h4>
          <div className="social-icons">
            <a href="https://www.facebook.com/SoyUnibague/" target="_blank" rel="noreferrer" aria-label="Facebook">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.312h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
            </a>
            <a href="https://www.youtube.com/user/universidadeibague" target="_blank" rel="noreferrer" aria-label="YouTube">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21.582 6.186a2.651 2.651 0 00-1.874-1.88C18.053 3.86 12 3.86 12 3.86s-6.053 0-7.708.446a2.651 2.651 0 00-1.874 1.88C2 7.842 2 12 2 12s0 4.158.418 5.814a2.651 2.651 0 001.874 1.88c1.655.446 7.708.446 7.708.446s6.053 0 7.708-.446a2.651 2.651 0 001.874-1.88C22 16.158 22 12 22 12s0-4.158-.418-5.814zM9.99 15.112V8.888L15.362 12l-5.372 3.112z"/></svg>
            </a>
            <a href="https://www.instagram.com/soyunibague/" target="_blank" rel="noreferrer" aria-label="Instagram">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </div>
          <p className="vigilancia-text">
            <em>Sujeto a inspección y vigilancia por el Ministerio de Educación Nacional</em>
          </p>
        </div>
      </div>

      <div className="footer-bottom-bar">
        <div className="footer-content-bottom">
          {/* Izquierda - Brand */}
          <div className="footer-section footer-brand">
            <div className="brand-logo">
              <img src="/logos/web/icon-192.png" alt="Universidad de Ibagué Logo" className="brand-img" />
            </div>
            <div className="brand-text">
              <h3 style={{ fontSize: '14px', maxWidth: '300px', whiteSpace: 'normal', lineHeight: '1.2' }}>
                UNIVERSIDAD DE IBAGUÉ
              </h3>
              <p>PROGRAMA DE PAZ Y REGIÓN</p>
            </div>
          </div>

          {/* Centro - Card de desarrollo */}
          <div className="footer-section footer-developer">
            <div className="developer-card">
              {/* Logo IngNavs */}
              <div className="developer-logo">
                <img
                  src="/IngNavs.png"
                  alt="IngNavs Logo"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.parentElement) {
                      target.parentElement.innerHTML = '<div class="developer-logo-fallback">IN</div>';
                    }
                  }}
                />
              </div>

              {/* Información de desarrollo */}
              <div className="developer-info">
                <button
                  onClick={handleIngNavsClick}
                  className="developer-link"
                >
                  <p className="developer-text">
                    Desarrollado por:{' '}
                    <span className="developer-name">Ing Navs</span>
                  </p>
                </button>
                <p className="developer-version">
                  <span className="status-dot"></span>
                  Versión 1.0.0
                </p>
              </div>

              {/* WhatsApp */}
              <button
                onClick={handleWhatsAppClick}
                className="whatsapp-button"
                aria-label="Contactar por WhatsApp"
                title="Contactar por WhatsApp"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.484 3.085"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Derecha - Derechos reservados */}
          <div className="footer-section footer-rights">
            <p className="footer-copyright">
              © {new Date().getFullYear()} Todos los derechos reservados
            </p>
            <p className="footer-entity">
              Universidad de Ibagué - Paz y Región
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

