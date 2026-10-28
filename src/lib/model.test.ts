import { describe, expect, it } from 'vitest';
import { addNote, deleteNote, dueNotes, emptyData, normalize, restoreLast, TRASH_KEPT, updateNote } from './model';
import { atTime, formatReminder, inMinutes, tomorrowAt } from './reminder';

const at = (s: string) => new Date(s).getTime();

describe('notes', () => {
  it('une nouvelle note reprend la dernière couleur utilisée', () => {
    const data = emptyData();
    const a = addNote(data);
    expect(a.color).toBe('jaune');
    updateNote(data, a.id, { color: 'vert' });
    expect(addNote(data).color).toBe('vert');
  });

  it('incline légèrement les notes, par demi-degrés', () => {
    const data = emptyData();
    expect(addNote(data, 0, () => 0).rot).toBe(-2);
    expect(addNote(data, 0, () => 0.99).rot).toBe(2);
    expect(addNote(data, 0, () => 0.6).rot).toBe(0.5);
  });

  it('déplacer une note ne change pas sa date de modification', () => {
    const data = emptyData();
    const n = addNote(data, 1);
    updateNote(data, n.id, { x: 10, y: 20 }, 5);
    expect(n.updatedAt).toBe(1);
    updateNote(data, n.id, { text: 'hop' }, 6);
    expect(n.updatedAt).toBe(6);
  });

  it('une note supprimée peut être rouverte, une note vide disparaît pour de bon', () => {
    const data = emptyData();
    const a = addNote(data);
    updateNote(data, a.id, { text: 'Appeler Léa', x: 100, y: 50 });
    const vide = addNote(data);
    deleteNote(data, vide.id);
    deleteNote(data, a.id, 42);
    expect(data.notes).toHaveLength(0);
    expect(data.trash).toHaveLength(1);
    const back = restoreLast(data)!;
    expect(back).toMatchObject({ id: a.id, text: 'Appeler Léa', x: 100, y: 50 });
    expect('deletedAt' in back).toBe(false);
    expect(restoreLast(data)).toBeNull();
  });

  it(`garde les ${TRASH_KEPT} dernières notes supprimées`, () => {
    const data = emptyData();
    for (let i = 0; i < TRASH_KEPT + 3; i++) {
      const n = addNote(data);
      updateNote(data, n.id, { text: `note ${i}` });
      deleteNote(data, n.id);
    }
    expect(data.trash).toHaveLength(TRASH_KEPT);
    expect(data.trash[0].text).toBe(`note ${TRASH_KEPT + 2}`);
  });

  it('trouve les rappels arrivés', () => {
    const data = emptyData();
    const a = addNote(data);
    const b = addNote(data);
    addNote(data);
    updateNote(data, a.id, { remindAt: 100 });
    updateNote(data, b.id, { remindAt: 300 });
    expect(dueNotes(data, 200).map((n) => n.id)).toEqual([a.id]);
  });

  it('relit un fichier abîmé sans planter', () => {
    const data = normalize({
      notes: [{ id: 'a', text: 'ok', color: 'fuchsia', x: 'nope' }, { text: 'sans id' }, null],
      lastColor: 'rose',
      settings: { alwaysOnTop: true, newShortcut: '' }
    });
    expect(data.notes).toHaveLength(1);
    expect(data.notes[0]).toMatchObject({ id: 'a', color: 'jaune', x: null, remindAt: null });
    expect(data.lastColor).toBe('rose');
    expect(data.settings).toMatchObject({ alwaysOnTop: true, newShortcut: 'Ctrl+Alt+N', toggleShortcut: 'Ctrl+Alt+P' });
    expect(normalize('n’importe quoi').notes).toEqual([]);
  });
});

describe('rappels', () => {
  const now = at('2026-10-28T13:42:00');

  it('calcule les choix rapides', () => {
    expect(inMinutes(now, 30)).toBe(at('2026-10-28T14:12:00'));
    expect(tomorrowAt(now, 9)).toBe(at('2026-10-29T09:00:00'));
  });

  it('une heure déjà passée vise le lendemain', () => {
    expect(atTime(now, '14:00')).toBe(at('2026-10-28T14:00:00'));
    expect(atTime(now, '9:30')).toBe(at('2026-10-29T09:30:00'));
    expect(atTime(now, '13:42')).toBe(at('2026-10-29T13:42:00'));
    expect(atTime(now, '25:00')).toBeNull();
    expect(atTime(now, '')).toBeNull();
  });

  it('affiche l’heure du rappel simplement', () => {
    expect(formatReminder(at('2026-10-28T14:00:00'), now)).toBe('14:00');
    expect(formatReminder(at('2026-10-29T09:00:00'), now)).toBe('Demain 9:00');
    expect(formatReminder(at('2026-10-31T08:05:00'), now)).toBe('31/10 8:05');
  });
});
