import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BrandingGate } from '@/app/BrandingGate';
import { Toaster } from '@/components/ui/Toast/Toast';
import { Providers } from '@/app/providers';
import { initTheme } from '@/utils/theme';
import '@/styles/global.css';
import { startPushLifecycle } from '@/services/push/bootstrap';

startPushLifecycle();

initTheme();

const container = document.getElementById('root');

if (!container) {
  throw new Error('Élément racine #root introuvable dans index.html.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <BrandingGate />
        <Toaster />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
