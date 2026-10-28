// Calcul et affichage des heures de rappel (heure locale).

const MINUTE = 60_000;

export function inMinutes(now: number, minutes: number): number {
  return now + minutes * MINUTE;
}

export function tomorrowAt(now: number, hours: number, minutes = 0): number {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

/** « HH:MM » → aujourd'hui à cette heure, ou demain si elle est déjà passée. null si l'heure est invalide. */
export function atTime(now: number, value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const d = new Date(now);
  d.setHours(h, min, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

function dayDiff(now: number, at: number): number {
  const a = new Date(now);
  a.setHours(0, 0, 0, 0);
  const b = new Date(at);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** « 14:00 » aujourd'hui, « Demain 9:00 », sinon « 30/10 9:00 ». */
export function formatReminder(at: number, now = Date.now()): string {
  const d = new Date(at);
  const diff = dayDiff(now, at);
  if (diff <= 0) return hm(d);
  if (diff === 1) return `Demain ${hm(d)}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${hm(d)}`;
}

/** Valeur par défaut du champ « À » : l'heure pleine suivante. */
export function nextFullHour(now: number): string {
  const d = new Date(now);
  return `${String((d.getHours() + 1) % 24).padStart(2, '0')}:00`;
}
