export type ColorId = 'jaune' | 'rose' | 'bleu' | 'vert' | 'violet' | 'orange';

export const COLORS: Record<ColorId, { name: string; bg: string; edge: string }> = {
  jaune: { name: 'Jaune', bg: '#FFE066', edge: '#D9A900' },
  rose: { name: 'Rose', bg: '#FF9ECF', edge: '#E0569B' },
  bleu: { name: 'Bleu', bg: '#9EC1FF', edge: '#4F7FE0' },
  vert: { name: 'Vert', bg: '#86E5BD', edge: '#2FAE7C' },
  violet: { name: 'Violet', bg: '#C9B0FF', edge: '#8A63E6' },
  orange: { name: 'Orange', bg: '#FFC27A', edge: '#E08A1C' }
};

export const COLOR_IDS = Object.keys(COLORS) as ColorId[];

export interface Note {
  id: string;
  text: string;
  color: ColorId;
  /** Position de la fenêtre en pixels physiques ; null tant que la note n'a jamais été placée. */
  x: number | null;
  y: number | null;
  /** Légère inclinaison en degrés, tirée à la création. */
  rot: number;
  /** Heure du rappel (ms depuis 1970), null sans rappel. */
  remindAt: number | null;
  /** Épinglée : la note reste au-dessus des autres fenêtres. */
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TrashedNote extends Note {
  deletedAt: number;
}

export interface Settings {
  launchAtStartup: boolean;
  newShortcut: string;
  toggleShortcut: string;
}

export interface Data {
  version: 1;
  notes: Note[];
  /** Notes supprimées, la plus récente en premier : « Rouvrir la note supprimée » les rend une à une. */
  trash: TrashedNote[];
  lastColor: ColorId;
  settings: Settings;
}

/** Ce que la fenêtre principale envoie à la fenêtre d'une note. */
export interface NoteState {
  note: Note;
  ringing: boolean;
  /** Vrai à la création : le curseur se place directement dans le texte. */
  focus: boolean;
}
