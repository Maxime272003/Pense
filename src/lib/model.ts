import { COLOR_IDS, type ColorId, type Data, type Note, type Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  launchAtStartup: false,
  alwaysOnTop: false,
  newShortcut: 'Ctrl+Alt+N',
  toggleShortcut: 'Ctrl+Alt+P'
};

/** Nombre de notes supprimées qu'on peut encore rouvrir. */
export const TRASH_KEPT = 10;

export function emptyData(): Data {
  return { version: 1, notes: [], trash: [], lastColor: 'jaune', settings: { ...DEFAULT_SETTINGS } };
}

const isColor = (c: unknown): c is ColorId => COLOR_IDS.includes(c as ColorId);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function normalizeNote(raw: any, now: number): Note | null {
  if (!raw || typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    text: typeof raw.text === 'string' ? raw.text : '',
    color: isColor(raw.color) ? raw.color : 'jaune',
    x: num(raw.x),
    y: num(raw.y),
    rot: num(raw.rot) ?? 0,
    remindAt: num(raw.remindAt),
    createdAt: num(raw.createdAt) ?? now,
    updatedAt: num(raw.updatedAt) ?? now
  };
}

/** Relit un pense.json en tolérant les champs manquants ou abîmés. */
export function normalize(raw: unknown, now = Date.now()): Data {
  const data = emptyData();
  if (!raw || typeof raw !== 'object') return data;
  const r = raw as any;
  if (Array.isArray(r.notes)) data.notes = r.notes.map((n: any) => normalizeNote(n, now)).filter(Boolean) as Note[];
  if (Array.isArray(r.trash)) {
    data.trash = r.trash
      .map((n: any) => {
        const note = normalizeNote(n, now);
        return note && { ...note, deletedAt: num(n.deletedAt) ?? now };
      })
      .filter(Boolean)
      .slice(0, TRASH_KEPT);
  }
  if (isColor(r.lastColor)) data.lastColor = r.lastColor;
  if (r.settings && typeof r.settings === 'object') {
    const s = r.settings;
    if (typeof s.launchAtStartup === 'boolean') data.settings.launchAtStartup = s.launchAtStartup;
    if (typeof s.alwaysOnTop === 'boolean') data.settings.alwaysOnTop = s.alwaysOnTop;
    if (typeof s.newShortcut === 'string' && s.newShortcut) data.settings.newShortcut = s.newShortcut;
    if (typeof s.toggleShortcut === 'string' && s.toggleShortcut) data.settings.toggleShortcut = s.toggleShortcut;
  }
  return data;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Nouvelle note vide, dans la dernière couleur utilisée, légèrement penchée. */
export function addNote(data: Data, now = Date.now(), random = Math.random): Note {
  const note: Note = {
    id: newId(),
    text: '',
    color: data.lastColor,
    x: null,
    y: null,
    rot: Math.round((random() * 4 - 2) * 2) / 2,
    remindAt: null,
    createdAt: now,
    updatedAt: now
  };
  data.notes.push(note);
  return note;
}

export type NotePatch = Partial<Pick<Note, 'text' | 'color' | 'x' | 'y' | 'remindAt'>>;

export function updateNote(data: Data, id: string, patch: NotePatch, now = Date.now()): Note | null {
  const note = data.notes.find((n) => n.id === id);
  if (!note) return null;
  Object.assign(note, patch);
  // Déplacer une note ne compte pas comme une modification.
  if ('text' in patch || 'color' in patch || 'remindAt' in patch) note.updatedAt = now;
  if (patch.color) data.lastColor = patch.color;
  return note;
}

/** Supprime une note. Une note vide disparaît pour de bon, les autres peuvent être rouvertes. */
export function deleteNote(data: Data, id: string, now = Date.now()): Note | null {
  const i = data.notes.findIndex((n) => n.id === id);
  if (i < 0) return null;
  const [note] = data.notes.splice(i, 1);
  if (note.text.trim()) data.trash = [{ ...note, deletedAt: now }, ...data.trash].slice(0, TRASH_KEPT);
  return note;
}

/** Rouvre la dernière note supprimée, à sa place d'avant. */
export function restoreLast(data: Data): Note | null {
  const last = data.trash.shift();
  if (!last) return null;
  const { deletedAt: _, ...note } = last;
  data.notes.push(note);
  return note;
}

/** Notes dont le rappel est arrivé. */
export function dueNotes(data: Data, now = Date.now()): Note[] {
  return data.notes.filter((n) => n.remindAt !== null && n.remindAt <= now);
}

/** Taille du texte selon sa longueur, pour que la note reste lisible sans défiler. */
export function textSize(text: string): 'l' | 'm' | 's' {
  const n = text.trim().length + (text.match(/\n/g)?.length ?? 0) * 20;
  if (n <= 80) return 'l';
  if (n <= 150) return 'm';
  return 's';
}
