<script lang="ts">
  // Mode navigateur (npm run dev) : les notes sont posées dans la page, pour travailler l'interface sans Tauri.
  import { pense } from '../lib/pense.svelte';
  import Note from './Note.svelte';
  import Settings from './Settings.svelte';

  let focusId = $state('');
  let showSettings = $state(false);

  async function add() {
    focusId = (await pense.newNoteInPage()).id;
  }

  function ring(id: string) {
    pense.ringing.add(id);
  }
</script>

<div class="desk">
  <div class="bar">
    <button class="btn primary" onclick={add}>Nouvelle note</button>
    <button class="btn" disabled={!pense.data.trash.length} onclick={() => pense.restoreInPage()}>Rouvrir la note supprimée</button>
    <button class="btn" onclick={() => (showSettings = !showSettings)}>Réglages</button>
    <span class="muted">Mode navigateur : les notes sont dans la page.</span>
  </div>

  {#each pense.data.notes as note (note.id)}
    <div class="slot" style:left="{note.x ?? 40}px" style:top="{note.y ?? 80}px">
      <Note
        {note}
        ringing={pense.ringing.has(note.id)}
        focusRequest={focusId === note.id ? 1 : 0}
        onupdate={(patch) => pense.handleInPage({ type: 'update', id: note.id, patch })}
        ondelete={() => pense.handleInPage({ type: 'delete', id: note.id })}
        onseen={() => pense.handleInPage({ type: 'seen', id: note.id })}
        onsnooze={() => pense.handleInPage({ type: 'snooze', id: note.id })}
      />
      <button class="test" onclick={() => ring(note.id)}>Faire sonner</button>
    </div>
  {/each}

  {#if showSettings}
    <div class="settings-frame"><Settings onclose={() => (showSettings = false)} /></div>
  {/if}
</div>

<style>
  .desk {
    position: relative;
    height: 100%;
    background: #24324a;
    overflow: auto;
  }
  .bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(15, 11, 30, 0.85);
  }
  .bar .muted {
    font-size: 13px;
  }
  .slot {
    position: absolute;
    margin-top: 20px;
  }
  .test {
    margin-top: 16px;
    border: 0;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.3);
    color: var(--muted);
    font-size: 12px;
    padding: 4px 8px;
  }
  .settings-frame {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 10;
    width: min(760px, calc(100% - 32px));
    height: 620px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  }
</style>
