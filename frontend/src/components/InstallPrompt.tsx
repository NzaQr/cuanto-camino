import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download04Icon, Cancel01Icon, SmartPhone01Icon } from '@hugeicons/core-free-icons';
import { useInstallPrompt } from '../hooks/useInstallPrompt.ts';
import './InstallPrompt.css';

const DISMISS_KEY = 'cuanto-camino:install-dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function InstallPrompt() {
  const { mode, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (mode === 'none' || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage unavailable: dismiss for this render only.
    }
  }

  return (
    <div className="install-prompt" role="region" aria-label="Instalar la app">
      <div className="install-icon">
        <HugeiconsIcon icon={SmartPhone01Icon} size={18} color="currentColor" strokeWidth={1.75} />
      </div>
      <div className="install-text">
        <span className="install-title">Instalá Cuánto Camino</span>
        {mode === 'prompt' ? (
          <span className="install-subtitle">Acceso directo, pantalla completa y más rápido.</span>
        ) : (
          <span className="install-subtitle">
            En Safari: <strong>Compartir</strong> → <strong>Agregar a inicio</strong>.
          </span>
        )}
      </div>
      {mode === 'prompt' ? (
        <button type="button" className="install-btn" onClick={() => void install()}>
          <HugeiconsIcon icon={Download04Icon} size={14} color="currentColor" strokeWidth={2} />
          Instalar
        </button>
      ) : null}
      <button type="button" className="install-dismiss" onClick={dismiss} aria-label="Cerrar">
        <HugeiconsIcon icon={Cancel01Icon} size={12} color="currentColor" strokeWidth={2} />
      </button>
    </div>
  );
}

export default InstallPrompt;
