<script lang="ts">
  // Une fenêtre = une note. Elle affiche ce que la fenêtre principale lui envoie et lui renvoie chaque action.
  import { clampSize, type NotePatch } from '../lib/model';
  import { keepOpenOnClose, NOTE_MARGIN, onEvent, onSelfMoved, onSelfResized, sendToMain, startResizeSelf } from '../lib/platform';
  import type { NoteMessage } from '../lib/pense.svelte';
  import type { NoteState } from '../lib/types';
  import Note from './Note.svelte';

  let { id }: { id: string } = $props();

  let current = $state<NoteState | null>(null);
  let focusRequest = $state(0);

  const send = (m: NoteMessage) => void sendToMain('note', m);

  onEvent<NoteState>('note-state', (s) => {
    current = s;
    if (s.focus) focusRequest++;
  });
  keepOpenOnClose(() => {});

  let moveTimer: ReturnType<typeof setTimeout> | undefined;
  onSelfMoved((x, y) => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => send({ type: 'update', id, patch: { x, y } }), 400);
  });

  // La note suit sa fenêtre pendant qu'on la redimensionne ; la taille est enregistrée une fois lâchée.
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  onSelfResized((w, h) => {
    if (!current) return;
    current.note.w = w = clampSize(w);
    current.note.h = h = clampSize(h);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => send({ type: 'update', id, patch: { w, h } }), 400);
  });

  // svelte-ignore state_referenced_locally
  send({ type: 'ready', id });

  function update(patch: NotePatch) {
    if (current) Object.assign(current.note, patch);
    send({ type: 'update', id, patch });
  }
</script>

{#if current}
  <div class="spot" style:padding="{NOTE_MARGIN.top}px {NOTE_MARGIN.side}px 0">
    <Note
      note={current.note}
      ringing={current.ringing}
      {focusRequest}
      draggable
      onresizestart={startResizeSelf}
      onupdate={update}
      ondelete={() => send({ type: 'delete', id })}
      onseen={() => send({ type: 'seen', id })}
      onsnooze={() => send({ type: 'snooze', id })}
    />
  </div>
{/if}
