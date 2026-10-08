import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/literata/400.css';
import '@fontsource/literata/400-italic.css';
import '@fontsource/literata/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@arivo/ui/tokens.css';
import '@arivo/ui/base.css';
import '@arivo/ui/layout.css';
import '@arivo/ui/components.css';
import '@arivo/ui/objects.css';
import '@arivo/ui/lab.css';
import './src/styles/app.css';
import { App } from './src/app.tsx';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
