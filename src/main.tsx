import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'meoweo-shared/styles.css';

import { App } from './app';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root element not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
