<script lang="ts">
  import { pense } from '../lib/pense.svelte';
  import { dataFilePath, openDataDir } from '../lib/platform';
  import type { Settings } from '../lib/types';
  import Icon from './Icon.svelte';
  import Switch from './Switch.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const s = $derived(pense.settings);
  const u = $derived(pense.update);

  let path = $state('');
  dataFilePath().then((p) => (path = p));

  type ShortcutKey = 'newShortcut' | 'toggleShortcut';
  const shortcuts: { key: ShortcutKey; label: string }[] = [
    { key: 'newShortcut', label: 'Nouvelle note' },
    { key: 'toggleShortcut', label: 'Afficher / masquer les notes' }
  ];

  // --- Capture d'un nouveau raccourci ---
  let capturing = $state<ShortcutKey | null>(null);
  let message = $state<{ key: ShortcutKey; text: string } | null>(null);

  // Convertit une touche du clavier en nom compris par le raccourci global (lettres, chiffres, F1–F12).
  function keyName(code: string): string | null {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^F([1-9]|1[0-2])$/.test(code)) return code;
    return null;
  }

  async function capture(e: KeyboardEvent) {
    const key = capturing;
    if (!key) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      capturing = null;
      return;
    }
    const name = keyName(e.code);
    if (!name) return;
    if (!e.ctrlKey && !e.altKey) {
      message = { key, text: 'Ajoute Ctrl ou Alt à la touche.' };
      return;
    }
    const accel = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', name].filter(Boolean).join('+');
    capturing = null;
    const ok = await pense.setShortcut(key, accel);
    message = ok ? null : { key, text: `${accel} est déjà utilisé.` };
  }

  function hint(key: ShortcutKey): string {
    if (capturing === key) return 'Appuie sur la combinaison voulue (Échap pour annuler).';
    if (message?.key === key) return message.text;
    if (pense.shortcutErrors.includes(s[key])) return 'Raccourci indisponible : choisis-en un autre.';
    return 'Fonctionne partout, même quand Pense est caché.';
  }

  const toggle = (patch: Partial<Settings>) => void pense.updateSettings(patch);
</script>

<svelte:window onkeydowncapture={capture} />

<div class="window">
  <div class="titlebar" data-tauri-drag-region>
    <span class="logo" aria-hidden="true"></span>
    <span class="title" data-tauri-drag-region>PENSE · RÉGLAGES</span>
    <button class="close" aria-label="Fermer" onclick={onclose}><Icon name="close" size={16} stroke={1.8} /></button>
  </div>

  {#if pense.loadError}
    <div class="error" role="alert">{pense.loadError}</div>
  {/if}

  <div class="content">
    <section aria-labelledby="s-notes">
      <h2 id="s-notes">NOTES</h2>
      <div class="row">
        <div class="txt">
          <span id="l-boot" class="name">Lancer Pense au démarrage de Windows</span>
          <span class="muted desc">Tes notes réapparaissent là où tu les as laissées.</span>
        </div>
        <Switch checked={s.launchAtStartup} labelledby="l-boot" onchange={(v) => toggle({ launchAtStartup: v })} />
      </div>
    </section>

    <section aria-labelledby="s-keys">
      <h2 id="s-keys">RACCOURCIS</h2>
      {#each shortcuts as sc (sc.key)}
        <div class="row">
          <div class="txt">
            <span class="name">{sc.label}</span>
            <span class="muted desc" class:warn={message?.key === sc.key || pense.shortcutErrors.includes(s[sc.key])} aria-live="polite"
              >{hint(sc.key)}</span
            >
          </div>
          <div class="keys">
            {#if capturing !== sc.key}
              {#each s[sc.key].split('+') as k (k)}<kbd>{k}</kbd>{/each}
            {/if}
            <button
              class="small-btn"
              onclick={() => {
                capturing = capturing === sc.key ? null : sc.key;
                message = null;
              }}>{capturing === sc.key ? 'Annuler' : 'Modifier'}</button
            >
          </div>
        </div>
      {/each}
    </section>

    <section aria-labelledby="s-app">
      <h2 id="s-app" class="sr-only">Application</h2>
      <div class="row">
        <div class="txt">
          <span class="name">
            Version {pense.version}
            {#if u.status === 'uptodate'}· à jour{/if}
          </span>
          <span class="muted desc" aria-live="polite">
            {#if u.status === 'checking'}
              Recherche d’une mise à jour…
            {:else if u.status === 'available'}
              La version {u.version} est disponible.
            {:else if u.status === 'installing'}
              Installation de la version {u.version}… {Math.round(u.progress * 100)} %
            {:else if u.status === 'error'}
              Recherche impossible pour l’instant (pas de connexion ?).
            {:else}
              Pense vérifie tout seul au démarrage puis toutes les 6 heures.
            {/if}
          </span>
          <code>{path}</code>
        </div>
        <div class="actions">
          <button class="btn" onclick={() => openDataDir()}><Icon name="folder" />Ouvrir le dossier</button>
          {#if u.status === 'available'}
            <button class="btn primary" onclick={() => pense.installUpdate()}>Mettre à jour</button>
          {:else}
            <button class="btn" disabled={u.status === 'checking' || u.status === 'installing'} onclick={() => pense.checkForUpdate()}>
              Rechercher une mise à jour
            </button>
          {/if}
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .window {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .titlebar {
    height: 36px;
    flex-shrink: 0;
    background: var(--bar);
    display: flex;
    align-items: center;
    gap: 10px;
    padding-left: 14px;
  }
  .logo {
    width: 15px;
    height: 15px;
    border-radius: 3px;
    background: #ffe066;
    box-shadow: 0 2px 0 #d9a900;
    transform: rotate(-6deg);
  }
  .title {
    flex: 1;
    font-family: var(--display);
    font-size: 15px;
    letter-spacing: 1px;
  }
  .close {
    width: 46px;
    height: 36px;
    border: 0;
    background: transparent;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .close:hover {
    background: #e81123;
    color: #fff;
  }
  .error {
    margin: 12px 24px 0;
    padding: 12px 16px;
    border-radius: 10px;
    background: #4a1f2b;
    color: #ffd7d3;
    font-size: 14px;
  }
  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  section {
    background: var(--surface);
    border-radius: 16px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 5px 0 var(--shadow);
  }
  h2 {
    font-size: 19px;
    letter-spacing: 1px;
    color: var(--accent);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .txt {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .name {
    font-size: 15px;
    font-weight: 600;
  }
  .desc {
    font-size: 13px;
  }
  .desc.warn {
    color: var(--danger);
  }
  .keys {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  kbd {
    min-width: 28px;
    height: 30px;
    padding: 0 8px;
    border-radius: 6px;
    background: var(--bg);
    box-shadow: 0 3px 0 var(--shadow);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .small-btn {
    margin-left: 6px;
    height: 34px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: var(--surface-3);
    font-size: 13px;
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }
  code {
    margin-top: 4px;
    font-family: Consolas, ui-monospace, monospace;
    font-size: 13px;
    color: var(--soft);
    overflow-wrap: anywhere;
    user-select: text;
  }
</style>
