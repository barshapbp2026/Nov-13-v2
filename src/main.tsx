import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {FontSizeProvider} from './context/FontSizeContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <FontSizeProvider>
    <App />
  </FontSizeProvider>
);
