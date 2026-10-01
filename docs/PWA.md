# PWA

vite-plugin-pwa/Workbox generan manifest y SW: Paz y Región — Universidad de Ibagué, display standalone, theme navy, fondo claro e iconos any/maskable 192/512 existentes. Favicon/apple-touch-icon apuntan a assets reales.

Actualizaciones con prompt voluntario, sin recargar formularios silenciosamente. SW deshabilitado en desarrollo para previews/HMR.

Precache HTML/JS/CSS e iconos web. Se conservan assets Android/iOS, sin cachearlos redundantemente. Sin runtimeCaching de Auth/DB/Storage. Fallback excluye /dev, /auth, /reset-password y /api; nunca cachea archivos privados ni callbacks.

El shell público permite recarga offline después del primer registro. **No hay datos ni operaciones offline.** HTTPS requerido en hosting (localhost es excepción).

InstallPWA escucha beforeinstallprompt/appinstalled con cleanup. Respeta standalone y dismiss siete días. Preferencia versionada localStorage tolera almacenamiento bloqueado y no autoriza usuarios. Instalación depende del navegador.

Desplegar dist con fallback SPA y caches prudentes para sw.js/manifest/index.html. No se realiza despliegue en esta fase. E2E comprueba manifest, iconos, control del SW y recarga offline pública.
