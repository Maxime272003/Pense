import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { pense } from './lib/pense.svelte';
import { isTauri, keepOpenOnClose, hideSelf } from './lib/platform';

// Menu clic droit du navigateur désactivé, sauf dans les champs de texte.
document.addEventListener('contextmenu', (e) => {
  const target = e.target as HTMLElement | null;
  if (!target?.closest('input, textarea')) e.preventDefault();
});

// Chaque note a sa fenêtre (index.html?note=<id>) ; la fenêtre principale, cachée, pilote tout et sert de réglages.
const noteId = isTauri ? new URLSearchParams(location.search).get('note') : null;
if (noteId) document.documentElement.classList.add('note-window');

mount(App, { target: document.getElementById('app')!, props: { noteId } });

if (!noteId) {
  keepOpenOnClose(() => void hideSelf());
  void pense.init();
}
