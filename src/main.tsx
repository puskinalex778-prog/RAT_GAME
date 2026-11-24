import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { useGame } from './store/gameStore';
import { maybeEngine } from './ui/components/common';

if (import.meta.env.DEV) Object.assign(window, { __game: useGame, __engine: maybeEngine });

createRoot(document.getElementById('root')!).render(<App />);
