import React from 'react';
import ReactDOM from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
// Custom elements for the mobile bottom sheet. Their CSS goes before ours so
// the --bs-* tokens in index.css win.
import '@magic-spells/dialog-panel';
import '@magic-spells/bottom-sheet';
import '@magic-spells/dialog-panel/css';
import '@magic-spells/bottom-sheet/css';
import './index.css';
import App from './App.tsx';
import { registerSW } from 'virtual:pwa-register';

// Fix Leaflet default marker icons with Vite bundler
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Service worker: precaches the app shell and auto-updates on new deploys.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
