// Mises à jour via les Releases GitHub (voir .github/workflows/release.yml).
import type { Update } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from './platform';

export async function currentVersion(): Promise<string> {
  if (!isTauri) return 'dev';
  return getVersion();
}

/** La mise à jour disponible, ou null si l'app est à jour (ou hors de Tauri). */
export async function findUpdate(): Promise<Update | null> {
  if (!isTauri) return null;
  const { check } = await import('@tauri-apps/plugin-updater');
  return check();
}

/**
 * Télécharge et installe la mise à jour, puis relance Pense.
 * Sous Windows, l'installateur ferme l'app de lui-même pendant l'installation.
 */
export async function installUpdate(update: Update, onProgress: (ratio: number) => void): Promise<void> {
  let total = 0;
  let received = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') total = event.data.contentLength ?? 0;
    if (event.event === 'Progress') {
      received += event.data.chunkLength;
      if (total) onProgress(received / total);
    }
  });
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
