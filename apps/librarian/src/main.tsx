import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BrandingGate } from '@/app/BrandingGate';
import { Providers } from '@/app/providers';
import '@/styles/global.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Élément racine #root introuvable dans index.html.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <BrandingGate />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
