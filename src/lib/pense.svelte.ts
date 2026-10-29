// Le chef d'orchestre : il vit dans la fenêtre principale (cachée, elle sert aussi d'écran de réglages).
// Il garde les données, ouvre une fenêtre par note, gère les raccourcis, le menu de l'icône et les rappels.
// Les fenêtres des notes ne font que de l'affichage et lui envoient ce que l'utilisateur fait.
import type { Update } from '@tauri-apps/plugin-updater';
import { SvelteSet } from 'svelte/reactivity';
import { addNote, deleteNote, dueNotes, emptyData, normalize, restoreLast, updateNote, type NotePatch } from './model';
import {
  closeNoteWindow,
  createNoteWindow,
  hideNote,
  isNoteFocused,
  isOnScreen,
  isTauri,
  loadRaw,
  notify,
  onEvent,
  quit as quitApp,
  registerShortcuts,
  saveRaw,
  sendToNote,
  setNoteOnTop,
  showNote,
  showSelf,
  spotForNewNote,
  syncAutostart
} from './platform';
import { formatReminder, inMinutes } from './reminder';
import { buildTray, type Tray } from './tray';
import type { Data, Note, NoteState, Settings } from './types';
import { currentVersion, findUpdate, installUpdate } from './updater';

const SAVE_DELAY = 200;
const TICK = 5_000;
const UPDATE_EVERY = 6 * 60 * 60 * 1000;
export const SNOOZE_MINUTES = 10;

export type UpdateState =
  | { status: 'idle' | 'checking' | 'uptodate' | 'error' }
  | { status: 'available'; version: string }
  | { status: 'installing'; version: string; progress: number };

/** Messages des fenêtres de notes vers la fenêtre principale. */
export type NoteMessage =
  | { type: 'ready'; id: string }
  | { type: 'update'; id: string; patch: NotePatch }
  | { type: 'delete'; id: string }
  | { type: 'seen'; id: string }
  | { type: 'snooze'; id: string };

class Pense {
  data = $state<Data>(emptyData());
  loaded = $state(false);
  loadError = $state('');
  hidden = $state(false);
  /** Notes dont le rappel sonne en ce moment. */
  ringing = new SvelteSet<string>();
  /** Raccourcis refusés par le système. */
  shortcutErrors = $state<string[]>([]);
  version = $state('');
  update = $state<UpdateState>({ status: 'idle' });

  /** Note tout juste créée : sa fenêtre prendra le focus pour écrire directement. */
  private fresh = new Set<string>();
  private pendingUpdate: Update | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private tray: Tray | null = null;

  get settings(): Settings {
    return this.data.settings;
  }

  async init(): Promise<void> {
    try {
      const raw = await loadRaw();
      this.data = normalize(raw ? JSON.parse(raw) : null);
    } catch (e) {
      // Fichier illisible : on ne l'écrase pas, on travaille en mémoire.
      this.loadError = `Impossible de lire tes notes (${e}). Rien ne sera enregistré tant que ce n'est pas réglé.`;
    }
    // Une note vide laissée là (app coupée pendant l'écriture) ne sert à rien.
    for (const n of this.data.notes.filter((n) => !n.text.trim() && n.remindAt === null)) deleteNote(this.data, n.id);
    this.loaded = true;
    this.version = await currentVersion();

    onEvent<NoteMessage>('note', (m) => void this.onNoteMessage(m));
    onEvent('second-instance', () => void this.showAll());
    this.tray = await buildTray({
      newNote: () => void this.newNote(),
      toggle: () => void this.toggle(),
      restore: () => void this.restore(),
      settings: () => void showSelf(),
      installUpdate: () => void this.installUpdate(),
      quit: () => void this.quit()
    });
    await this.applyShortcuts();
    void syncAutostart(this.settings.launchAtStartup).catch(() => {});

    for (const note of this.data.notes) await this.openWindow(note);
    this.refreshTray();

    this.tick();
    setInterval(() => this.tick(), TICK);
    void this.checkForUpdate();
    setInterval(() => void this.checkForUpdate(), UPDATE_EVERY);
  }

  // --- Données ---

  private save(): void {
    if (this.loadError) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DELAY);
  }

  async flush(): Promise<void> {
    clearTimeout(this.saveTimer);
    if (this.loadError) return;
    await saveRaw(JSON.stringify($state.snapshot(this.data), null, 2));
  }

  private note(id: string): Note | undefined {
    return this.data.notes.find((n) => n.id === id);
  }

  private state(note: Note): NoteState {
    return { note: $state.snapshot(note), ringing: this.ringing.has(note.id), focus: this.fresh.has(note.id) };
  }

  /** Renvoie à la fenêtre d'une note son état à jour. */
  private push(id: string): void {
    const note = this.note(id);
    if (note) void sendToNote(id, 'note-state', this.state(note));
  }

  // --- Fenêtres ---

  private async openWindow(note: Note): Promise<void> {
    if (note.x === null || note.y === null || !(await isOnScreen(note.x, note.y))) {
      const spot = await spotForNewNote(this.data.notes.filter((n) => n.id !== note.id && n.x !== null) as { x: number; y: number }[]);
      updateNote(this.data, note.id, spot);
      this.save();
    }
    await createNoteWindow(note.id, note.x!, note.y!, note.pinned);
  }

  private async onNoteMessage(m: NoteMessage): Promise<void> {
    const note = this.note(m.id);
    if (!note) return;
    switch (m.type) {
      case 'ready': {
        this.push(m.id);
        if (!this.hidden || this.ringing.has(m.id)) await showNote(m.id, this.fresh.has(m.id) || this.ringing.has(m.id));
        this.fresh.delete(m.id);
        break;
      }
      case 'update': {
        updateNote(this.data, m.id, m.patch);
        if ('remindAt' in m.patch) this.stopRinging(m.id);
        if ('pinned' in m.patch) await setNoteOnTop(m.id, note.pinned || this.ringing.has(m.id));
        this.save();
        // Le texte et la position viennent de la note elle-même : inutile de les lui renvoyer.
        if ('color' in m.patch || 'remindAt' in m.patch || 'pinned' in m.patch) this.push(m.id);
        break;
      }
      case 'delete':
        await this.remove(m.id);
        break;
      case 'seen':
        updateNote(this.data, m.id, { remindAt: null });
        this.stopRinging(m.id);
        this.save();
        this.push(m.id);
        break;
      case 'snooze':
        updateNote(this.data, m.id, { remindAt: inMinutes(Date.now(), SNOOZE_MINUTES) });
        this.stopRinging(m.id);
        this.save();
        this.push(m.id);
        break;
    }
  }

  // --- Actions ---

  async newNote(): Promise<void> {
    if (this.hidden) await this.showAll();
    // On repasse par this.note() : c'est la version suivie par Svelte, celle que les modifications touchent.
    const id = addNote(this.data).id;
    this.fresh.add(id);
    this.save();
    await this.openWindow(this.note(id)!);
    this.refreshTray();
  }

  async remove(id: string): Promise<void> {
    deleteNote(this.data, id);
    this.ringing.delete(id);
    this.save();
    await closeNoteWindow(id);
    this.refreshTray();
  }

  async restore(): Promise<void> {
    const id = restoreLast(this.data)?.id;
    if (!id) return;
    if (this.hidden) await this.showAll();
    this.fresh.add(id);
    this.save();
    await this.openWindow(this.note(id)!);
    this.refreshTray();
  }

  async showAll(): Promise<void> {
    this.hidden = false;
    for (const n of this.data.notes) await showNote(n.id, true);
    this.refreshTray();
  }

  async hideAll(): Promise<void> {
    this.hidden = true;
    // Une note qui sonne reste à l'écran.
    for (const n of this.data.notes) if (!this.ringing.has(n.id)) await hideNote(n.id);
    this.refreshTray();
  }

  /**
   * Ctrl+Alt+P et clic sur l'icône : notes cachées → on les montre ; notes visibles mais derrière
   * d'autres fenêtres → on les ramène devant ; une note déjà au premier plan → on les cache.
   */
  async toggle(): Promise<void> {
    if (this.hidden) return this.showAll();
    for (const n of this.data.notes) if (await isNoteFocused(n.id)) return this.hideAll();
    return this.showAll();
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    Object.assign(this.data.settings, patch);
    this.save();
    if ('launchAtStartup' in patch) await syncAutostart(this.settings.launchAtStartup).catch(() => {});
    if ('newShortcut' in patch || 'toggleShortcut' in patch) await this.applyShortcuts();
  }

  /** Change un raccourci ; renvoie false si le système le refuse (l'ancien est alors gardé). */
  async setShortcut(which: 'newShortcut' | 'toggleShortcut', accel: string): Promise<boolean> {
    const other = which === 'newShortcut' ? this.settings.toggleShortcut : this.settings.newShortcut;
    if (accel === other) return false;
    const previous = this.settings[which];
    await this.updateSettings({ [which]: accel });
    if (this.shortcutErrors.includes(accel)) {
      await this.updateSettings({ [which]: previous });
      return false;
    }
    return true;
  }

  private async applyShortcuts(): Promise<void> {
    this.shortcutErrors = await registerShortcuts([
      [this.settings.newShortcut, () => void this.newNote()],
      [this.settings.toggleShortcut, () => void this.toggle()]
    ]);
    this.refreshTray();
  }

  async quit(): Promise<void> {
    await this.flush();
    await quitApp();
  }

  // --- Rappels ---

  private tick(): void {
    const now = Date.now();
    for (const note of dueNotes(this.data, now)) {
      if (this.ringing.has(note.id)) continue;
      this.ringing.add(note.id);
      void this.ring(note);
    }
  }

  private async ring(note: Note): Promise<void> {
    this.push(note.id);
    await setNoteOnTop(note.id, true);
    await showNote(note.id, true);
    const first = note.text.trim().split('\n')[0] || 'Note sans texte';
    void notify(`Rappel · ${formatReminder(note.remindAt ?? Date.now())}`, first.length > 120 ? first.slice(0, 119) + '…' : first);
  }

  private stopRinging(id: string): void {
    if (!this.ringing.delete(id)) return;
    void setNoteOnTop(id, this.note(id)?.pinned ?? false);
    if (this.hidden) void hideNote(id);
  }

  // --- Icône de notification ---

  private refreshTray(): void {
    this.tray?.refresh({
      count: this.data.notes.length,
      hidden: this.hidden,
      canRestore: this.data.trash.length > 0,
      newShortcut: this.settings.newShortcut,
      toggleShortcut: this.settings.toggleShortcut,
      update: this.update.status === 'available' ? this.update.version : null
    });
  }

  // --- Mises à jour ---

  async checkForUpdate(): Promise<void> {
    if (!isTauri || this.update.status === 'installing') return;
    this.update = { status: 'checking' };
    try {
      this.pendingUpdate = await findUpdate();
      this.update = this.pendingUpdate ? { status: 'available', version: this.pendingUpdate.version } : { status: 'uptodate' };
    } catch {
      this.update = { status: 'error' };
    }
    this.refreshTray();
  }

  async installUpdate(): Promise<void> {
    const update = this.pendingUpdate;
    if (!update) return;
    this.update = { status: 'installing', version: update.version, progress: 0 };
    await this.flush();
    try {
      await installUpdate(update, (progress) => (this.update = { status: 'installing', version: update.version, progress }));
    } catch {
      this.update = { status: 'error' };
    }
  }

  // --- Mode navigateur (npm run dev) : les notes sont dessinées dans la page, sans fenêtres ---

  async newNoteInPage(): Promise<Note> {
    const note = addNote(this.data);
    const i = this.data.notes.length - 1;
    updateNote(this.data, note.id, { x: 40 + (i % 4) * 280, y: 60 + Math.floor(i / 4) * 300 });
    this.save();
    return note;
  }

  handleInPage(m: NoteMessage): void {
    if (m.type === 'delete') {
      deleteNote(this.data, m.id);
      this.ringing.delete(m.id);
      this.save();
    } else if (m.type === 'update') {
      updateNote(this.data, m.id, m.patch);
      if ('remindAt' in m.patch) this.ringing.delete(m.id);
      this.save();
    } else if (m.type === 'seen' || m.type === 'snooze') {
      updateNote(this.data, m.id, { remindAt: m.type === 'seen' ? null : inMinutes(Date.now(), SNOOZE_MINUTES) });
      this.ringing.delete(m.id);
      this.save();
    }
  }

  restoreInPage(): void {
    restoreLast(this.data);
    this.save();
  }
}

export const pense = new Pense();
