import { useState } from 'react';
import { Link } from 'react-router-dom';
import './empresa_login.css';

export default function EmpresaLogin() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Estado para Login
  const [codigoLogin, setCodigoLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');

  // Estado para Registro
  const [formData, setFormData] = useState({
    nombreEmpresa: '',
    nit: '',
    representanteLegal: '',
    cedulaRepresentante: '',
    email: '',
    telefono: '',
    sectorEconomico: 'Servicios',
    ubicacion: '',
    perfilRequerido: '',
    numeroVacantes: '1',
    password: '',
    confirmPassword: '',
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Intento de login empresa con:', { codigoLogin, passwordLogin });
    alert('Funcionalidad de login de empresas en construcción');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }
    console.log('Registro de empresa:', formData);
    alert('Solicitud de registro enviada exitosamente. Queda pendiente de aprobación.');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="login-container">
      <div className={`login-card ${activeTab === 'register' ? 'wide' : ''}`}>
        <div className="login-header">
          <img
            src="/logos/web/icon-192.png"
            alt="Unibagué Logo"
            className="login-logo"
          />
          <h2>Portal de Empresas</h2>
          <p>Programa Paz y Región - Universidad de Ibagué</p>
        </div>

        {/* Pestanas Iniciar Sesion / Registro */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Registrar Empresa
          </button>
        </div>

        {/* Formulario de Login */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="codigo">Código de Empresa / NIT</label>
              <input
                type="text"
                id="codigo"
                value={codigoLogin}
                onChange={(e) => setCodigoLogin(e.target.value)}
                placeholder="Ingresa tu NIT o Código de Empresa"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
              />
            </div>

            <button type="submit" className="btn-primary login-btn">
              Ingresar
            </button>
          </form>
        ) : (
          /* Formulario de Registro */
          <form onSubmit={handleRegisterSubmit} className="login-form form-grid">
            <div className="input-group">
              <label htmlFor="nombreEmpresa">Nombre / Razón Social</label>
              <input
                type="text"
                id="nombreEmpresa"
                name="nombreEmpresa"
                value={formData.nombreEmpresa}
                onChange={handleInputChange}
                placeholder="Ej. Alimentos del Tolima S.A.S."
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="nit">NIT (con dígito de verificación)</label>
              <input
                type="text"
                id="nit"
                name="nit"
                value={formData.nit}
                onChange={handleInputChange}
                placeholder="Ej. 900.123.456-7"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="representanteLegal">Representante Legal</label>
              <input
                type="text"
                id="representanteLegal"
                name="representanteLegal"
                value={formData.representanteLegal}
                onChange={handleInputChange}
                placeholder="Nombre completo"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="cedulaRepresentante">Cédula del Representante</label>
              <input
                type="text"
                id="cedulaRepresentante"
                name="cedulaRepresentante"
                value={formData.cedulaRepresentante}
                onChange={handleInputChange}
                placeholder="Número de documento"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="email">Correo Electrónico Corporativo</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="contacto@empresa.com"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="telefono">Teléfono / Celular de Contacto</label>
              <input
                type="tel"
                id="telefono"
                name="telefono"
                value={formData.telefono}
                onChange={handleInputChange}
                placeholder="Ej. 300 123 4567"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="sectorEconomico">Sector Económico</label>
              <select
                id="sectorEconomico"
                name="sectorEconomico"
                value={formData.sectorEconomico}
                onChange={handleInputChange}
              >
                <option value="Agroindustria">Agroindustria</option>
                <option value="Tecnología">Tecnología y Software</option>
                <option value="Educación">Educación y Social</option>
                <option value="Comercio">Comercio y Retail</option>
                <option value="Servicios">Servicios Generales</option>
                <option value="Salud">Salud y Bienestar</option>
                <option value="Construcción">Construcción e Infraestructura</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="numeroVacantes">Número de Plazas/Vacantes Estimadas</label>
              <input
                type="number"
                id="numeroVacantes"
                name="numeroVacantes"
                min="1"
                value={formData.numeroVacantes}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="input-group full-width">
              <label htmlFor="ubicacion">Ubicación (Municipio y Dirección)</label>
              <input
                type="text"
                id="ubicacion"
                name="ubicacion"
                value={formData.ubicacion}
                onChange={handleInputChange}
                placeholder="Ej. Ibagué - Cra 5 # 12-34, Barrio Centro"
                required
              />
            </div>

            <div className="input-group full-width">
              <label htmlFor="perfilRequerido">Perfil Requerido / A qué se dedica la Empresa</label>
              <textarea
                id="perfilRequerido"
                name="perfilRequerido"
                rows={3}
                value={formData.perfilRequerido}
                onChange={handleInputChange}
                placeholder="Describe la actividad de la empresa y qué tipo de estudiantes o profesionales buscas para el proyecto..."
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Crea una contraseña"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="confirmPassword">Confirmar Contraseña</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Repite tu contraseña"
                required
              />
            </div>

            <div className="full-width">
              <button type="submit" className="btn-primary login-btn">
                Enviar Registro de Empresa
              </button>
            </div>
          </form>
        )}

        <div className="login-footer">
          <Link to="/">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
