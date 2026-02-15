import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import './index.css';

// Track visual viewport height for keyboard-aware layouts (iOS)
function setupViewportHeight() {
  const update = () => {
    const vh = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--viewport-height', `${vh}px`);
  };
  update();
  window.visualViewport?.addEventListener('resize', update);
  window.addEventListener('resize', update);
}
setupViewportHeight();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          richColors
          mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
          toastOptions={{
            className: 'font-sans',
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
