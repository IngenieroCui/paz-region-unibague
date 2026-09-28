'use client';

import { useState, useEffect } from 'react';
import './InstallPWA.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Escuchar el evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Escuchar el evento de instalación exitosa
    window.addEventListener('appinstalled', () => {
      setShowInstallButton(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      // Mostrar el prompt de instalación
      await deferredPrompt.prompt();
      
      // Esperar la respuesta del usuario
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log(`User response to install prompt: ${outcome}`);
      
      if (outcome === 'accepted') {
        setShowInstallButton(false);
      }
      
      // Limpiar el prompt
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error installing PWA:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
    // Ocultar por 7 días
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Verificar si fue cerrado recientemente
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      
      if (daysSinceDismissed < 7) {
        setShowInstallButton(false);
      }
    }
  }, []);

  if (isInstalled || !showInstallButton) return null;

  return (
    <div className="install-pwa-banner">
      <div className="install-pwa-content">
        <div className="install-pwa-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path 
              d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" 
              fill="var(--color-primary-main)"
              opacity="0.2"
            />
            <path 
              d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" 
              stroke="var(--color-primary-main)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path 
              d="M12 8v8m-4-4h8" 
              stroke="var(--color-primary-main)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        
        <div className="install-pwa-text">
          <h3>📱 Instalar aplicación</h3>
          <p>Instala esta plantilla en tu dispositivo para acceso rápido y trabajar sin conexión</p>
        </div>
        
        <div className="install-pwa-actions">
          <button 
            onClick={handleInstallClick}
            className="install-pwa-button install-primary"
          >
            Instalar
          </button>
          <button 
            onClick={handleDismiss}
            className="install-pwa-button install-dismiss"
            aria-label="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path 
                d="M18 6L6 18M6 6l12 12" 
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
