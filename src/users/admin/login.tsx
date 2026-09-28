import { useState } from 'react';
import { Link } from 'react-router-dom';
import './login.css';

export default function AdminLogin() {
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí irá la lógica de conexión a la base de datos en el futuro
    console.log('Intento de login con:', { codigo, password });
    alert('Funcionalidad de login en construcción');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img 
            src="/logos/web/icon-192.png" 
            alt="Unibagué Logo" 
            className="login-logo" 
          />
          <h2>Acceso Administrador</h2>
          <p>Programa Paz y Región</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="codigo">Código de Administrador</label>
            <input
              type="text"
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ingresa tu código"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              required
            />
          </div>

          <button type="submit" className="btn-primary login-btn">
            Ingresar
          </button>
        </form>

        <div className="login-footer">
          <Link to="/">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
