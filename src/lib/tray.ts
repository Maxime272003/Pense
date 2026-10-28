// Menu de l'icône dans la zone de notification.
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { TrayIcon } from '@tauri-apps/api/tray';
import { isTauri } from './platform';

export interface TrayActions {
  newNote: () => void;
  toggle: () => void;
  restore: () => void;
  settings: () => void;
  installUpdate: () => void;
  quit: () => void;
}

export interface TrayState {
  count: number;
  hidden: boolean;
  canRestore: boolean;
  newShortcut: string;
  toggleShortcut: string;
  /** Version disponible, ou null. */
  update: string | null;
}

export interface Tray {
  refresh: (state: TrayState) => void;
}

const TRAY_ID = 'pense';

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

export async function buildTray(actions: TrayActions): Promise<Tray | null> {
  if (!isTauri) return null;
  // Après un rechargement de la page (en développement), l'ancienne icône existe encore.
  await (await TrayIcon.getById(TRAY_ID))?.close();

  const title = await MenuItem.new({ id: 'title', text: 'Pense', enabled: false });
  const newNote = await MenuItem.new({ id: 'new', text: 'Nouvelle note', action: actions.newNote });
  const toggle = await MenuItem.new({ id: 'toggle', text: 'Masquer les notes', action: actions.toggle });
  const restore = await MenuItem.new({ id: 'restore', text: 'Rouvrir la note supprimée', enabled: false, action: actions.restore });
  const update = await MenuItem.new({ id: 'update', text: 'Installer la mise à jour', action: actions.installUpdate });
  const settings = await MenuItem.new({ id: 'settings', text: 'Réglages', action: actions.settings });
  const quit = await MenuItem.new({ id: 'quit', text: 'Quitter Pense', action: actions.quit });
  const sep = () => PredefinedMenuItem.new({ item: 'Separator' });

  const menu = await Menu.new({ items: [title, await sep(), newNote, toggle, restore, await sep(), settings, quit] });
  let updateShown = false;

  const tray = await TrayIcon.new({
    id: TRAY_ID,
    icon: (await defaultWindowIcon()) ?? undefined,
    tooltip: 'Pense',
    menu,
    showMenuOnLeftClick: false,
    action: (e) => {
      if (e.type === 'Click' && e.button === 'Left' && e.buttonState === 'Up') actions.toggle();
    }
  });

  return {
    refresh(s) {
      void (async () => {
        await title.setText(`Pense · ${plural(s.count, 'note')}`);
        await newNote.setText(`Nouvelle note\t${s.newShortcut}`);
        await toggle.setText(`${s.hidden ? 'Afficher' : 'Masquer'} les notes\t${s.toggleShortcut}`);
        await restore.setEnabled(s.canRestore);
        if (s.update) await update.setText(`Installer la mise à jour ${s.update}`);
        if (!!s.update !== updateShown) {
          // Juste avant « Réglages ».
          if (s.update) await menu.insert(update, 6);
          else await menu.remove(update);
          updateShown = !!s.update;
        }
        await tray.setTooltip(`Pense · ${plural(s.count, 'note')}`);
      })();
    }
  };
}
