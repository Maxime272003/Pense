// Tout ce qui touche au système passe par ici. Hors de Tauri (npm run dev dans un navigateur),
// les données vont dans localStorage et les fonctions de fenêtre ne font rien.
import { invoke } from '@tauri-apps/api/core';
import { emitTo } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { NOTE_SIZE } from './model';
import { availableMonitors, cursorPosition, getCurrentWindow, PhysicalPosition, primaryMonitor, type Monitor } from '@tauri-apps/api/window';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const STORAGE_KEY = 'pense';

/** Marge autour de la note dans sa fenêtre : le scotch en haut, l'ombre en bas, l'inclinaison sur les côtés. */
export const NOTE_MARGIN = { top: 14, side: 16, bottom: 34 };

/** Taille de la fenêtre pour une note de w × h pixels CSS. */
export const noteWindowSize = (w: number, h: number) => ({
  width: w + 2 * NOTE_MARGIN.side,
  height: h + NOTE_MARGIN.top + NOTE_MARGIN.bottom
});

/** Fenêtre d'une nouvelle note. */
export const NOTE_WINDOW = noteWindowSize(NOTE_SIZE.default, NOTE_SIZE.default);

export async function loadRaw(): Promise<string | null> {
  if (isTauri) return invoke<string | null>('load_data');
  return localStorage.getItem(STORAGE_KEY);
}

export async function saveRaw(contents: string): Promise<void> {
  if (isTauri) return invoke('save_data', { contents });
  localStorage.setItem(STORAGE_KEY, contents);
}

export async function dataFilePath(): Promise<string> {
  if (isTauri) return invoke<string>('data_file_path');
  return 'localStorage (mode navigateur)';
}

export async function openDataDir(): Promise<void> {
  if (isTauri) await invoke('open_data_dir');
}

export async function quit(): Promise<void> {
  if (isTauri) await invoke('quit');
}

/** Libellé de la fenêtre courante : « main » pour les réglages, « note-<id> » pour une note. */
export function windowLabel(): string {
  return isTauri ? getCurrentWindow().label : 'main';
}

export async function showSelf(): Promise<void> {
  if (!isTauri) return;
  const w = getCurrentWindow();
  await w.show();
  await w.unminimize();
  await w.setFocus();
}

export async function hideSelf(): Promise<void> {
  if (isTauri) await getCurrentWindow().hide();
}

/** Alt+F4 ou la croix : la fenêtre se cache au lieu de se fermer. */
export function keepOpenOnClose(handler: () => void): void {
  if (!isTauri) return;
  void getCurrentWindow().onCloseRequested((event) => {
    event.preventDefault();
    handler();
  });
}

export async function syncAutostart(enabled: boolean): Promise<void> {
  if (!isTauri) return;
  const autostart = await import('@tauri-apps/plugin-autostart');
  const current = await autostart.isEnabled();
  if (enabled && !current) await autostart.enable();
  if (!enabled && current) await autostart.disable();
}

/** Enregistre les raccourcis globaux. Renvoie ceux que le système refuse (déjà pris, invalides…). */
export async function registerShortcuts(bindings: [string, () => void][]): Promise<string[]> {
  if (!isTauri) return [];
  const gs = await import('@tauri-apps/plugin-global-shortcut');
  await gs.unregisterAll();
  const failed: string[] = [];
  for (const [accelerator, onPress] of bindings) {
    try {
      await gs.register(accelerator, (e) => {
        if (e.state === 'Pressed') onPress();
      });
    } catch {
      failed.push(accelerator);
    }
  }
  return failed;
}

export async function notify(title: string, body: string): Promise<void> {
  if (!isTauri) return;
  const n = await import('@tauri-apps/plugin-notification');
  let granted = await n.isPermissionGranted();
  if (!granted) granted = (await n.requestPermission()) === 'granted';
  if (granted) n.sendNotification({ title, body });
}

// --- Fenêtres des notes ---

export const noteLabel = (id: string) => `note-${id}`;

async function noteWindow(id: string): Promise<WebviewWindow | null> {
  return WebviewWindow.getByLabel(noteLabel(id));
}

/**
 * Crée la fenêtre d'une note, cachée : elle s'affiche quand la note a fini de charger
 * (voir showNote), pour éviter un carré blanc le temps du chargement.
 */
export async function createNoteWindow(
  id: string,
  x: number,
  y: number,
  size: { w: number; h: number },
  alwaysOnTop: boolean
): Promise<void> {
  if (!isTauri || (await noteWindow(id))) return;
  const min = noteWindowSize(NOTE_SIZE.min, NOTE_SIZE.min);
  const max = noteWindowSize(NOTE_SIZE.max, NOTE_SIZE.max);
  const w = new WebviewWindow(noteLabel(id), {
    url: `index.html?note=${encodeURIComponent(id)}`,
    title: 'Pense',
    ...noteWindowSize(size.w, size.h),
    minWidth: min.width,
    minHeight: min.height,
    maxWidth: max.width,
    maxHeight: max.height,
    resizable: true,
    maximizable: false,
    minimizable: false,
    decorations: false,
    transparent: true,
    shadow: false,
    skipTaskbar: true,
    alwaysOnTop,
    visible: false,
    focus: false
  });
  await new Promise<void>((resolve, reject) => {
    void w.once('tauri://created', () => resolve());
    void w.once('tauri://error', (e) => reject(e.payload));
  });
  await w.setPosition(new PhysicalPosition(x, y));
}

export async function showNote(id: string, focus: boolean): Promise<void> {
  const w = await noteWindow(id);
  if (!w) return;
  await w.show();
  if (focus) await w.setFocus();
}

export async function hideNote(id: string): Promise<void> {
  await (await noteWindow(id))?.hide();
}

export async function closeNoteWindow(id: string): Promise<void> {
  await (await noteWindow(id))?.destroy();
}

export async function setNoteOnTop(id: string, on: boolean): Promise<void> {
  await (await noteWindow(id))?.setAlwaysOnTop(on);
}

export async function isNoteFocused(id: string): Promise<boolean> {
  return (await (await noteWindow(id))?.isFocused()) ?? false;
}

export async function sendToNote<T>(id: string, event: string, payload: T): Promise<void> {
  if (isTauri) await emitTo(noteLabel(id), event, payload);
}

export async function sendToMain<T>(event: string, payload: T): Promise<void> {
  if (isTauri) await emitTo('main', event, payload);
}

/** Écoute les événements adressés à cette fenêtre. */
export function onEvent<T>(event: string, handler: (payload: T) => void): void {
  if (!isTauri) return;
  void getCurrentWebviewWindow().listen<T>(event, (e) => handler(e.payload));
}

/** Position physique de la fenêtre de note courante, à chaque déplacement. */
export function onSelfMoved(handler: (x: number, y: number) => void): void {
  if (!isTauri) return;
  void getCurrentWindow().onMoved((e) => handler(e.payload.x, e.payload.y));
}

/** Taille de la note courante (pixels CSS, sans la marge), à chaque redimensionnement de sa fenêtre. */
export function onSelfResized(handler: (w: number, h: number) => void): void {
  if (!isTauri) return;
  const win = getCurrentWindow();
  void win.onResized(async (e) => {
    const size = e.payload.toLogical(await win.scaleFactor());
    handler(size.width - 2 * NOTE_MARGIN.side, size.height - NOTE_MARGIN.top - NOTE_MARGIN.bottom);
  });
}

/** Le système prend la main pour agrandir la fenêtre courante par son coin bas-droit. */
export async function startResizeSelf(): Promise<void> {
  if (isTauri) await getCurrentWindow().startResizeDragging('SouthEast');
}

export function onSelfFocusChanged(handler: (focused: boolean) => void): void {
  if (!isTauri) return;
  void getCurrentWindow().onFocusChanged((e) => handler(e.payload));
}

// --- Placement ---

const contains = (m: Monitor, x: number, y: number) =>
  x >= m.position.x && x < m.position.x + m.size.width && y >= m.position.y && y < m.position.y + m.size.height;

/** Le haut de la note est-il sur un écran branché ? (évite une note perdue hors champ) */
export async function isOnScreen(x: number, y: number): Promise<boolean> {
  if (!isTauri) return true;
  return (await availableMonitors()).some((m) => contains(m, x + 120, y + 30));
}

/**
 * Où poser une nouvelle note : près de la souris, entièrement dans la zone de travail de l'écran,
 * en décalant si une autre note occupe déjà la place.
 */
export async function spotForNewNote(taken: { x: number; y: number }[]): Promise<{ x: number; y: number }> {
  if (!isTauri) return { x: 0, y: 0 };
  const cursor = await cursorPosition();
  const monitors = await availableMonitors();
  const m = monitors.find((mon) => contains(mon, cursor.x, cursor.y)) ?? (await primaryMonitor()) ?? monitors[0];
  if (!m) return { x: 100, y: 100 };
  const s = m.scaleFactor;
  const w = Math.round(NOTE_WINDOW.width * s);
  const h = Math.round(NOTE_WINDOW.height * s);
  const area = m.workArea;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  let x = Math.round(cursor.x - w / 2);
  let y = Math.round(cursor.y - 40 * s);
  const step = Math.round(28 * s);
  for (let i = 0; i < 12 && taken.some((t) => Math.abs(t.x - x) < step && Math.abs(t.y - y) < step); i++) {
    x += step;
    y += step;
  }
  return {
    x: clamp(x, area.position.x, area.position.x + area.size.width - w),
    y: clamp(y, area.position.y, area.position.y + area.size.height - h)
  };
}
