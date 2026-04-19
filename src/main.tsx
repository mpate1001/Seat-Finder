import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// ErrorBoundary wraps the entire tree so any uncaught render throw — from
// either the guest <App /> or the lazy <SetupApp /> — falls back to a
// friendly card with a Reload button instead of the blank-#root div React
// leaves behind on tree-wide failure. Critical for live event reliability:
// a guest staring at a frozen blank screen during check-in has no path
// back to "ask staff for directions" without this surface.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
