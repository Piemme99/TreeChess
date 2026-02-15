import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import App from './App'
import './tailwind.css'
import './overrides.css'

// In dev mode, update the page title and swap to dev-specific favicon
if (import.meta.env.DEV) {
  document.title = '[DEV] Kumquat';

  const icons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]');
  icons.forEach((link) => {
    link.href = link.href.replace(/favicon-(\d+x\d+)\.png/, 'favicon-dev-$1.png');
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
