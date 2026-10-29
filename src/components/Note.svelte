<script lang="ts">
  import { tick } from 'svelte';
  import type { NotePatch } from '../lib/model';
  import { textSize } from '../lib/model';
  import { atTime, formatReminder, inMinutes, nextFullHour, tomorrowAt } from '../lib/reminder';
  import { COLOR_IDS, COLORS, type Note } from '../lib/types';
  import Icon from './Icon.svelte';

  let {
    note,
    ringing = false,
    focusRequest = 0,
    draggable = false,
    onupdate,
    ondelete,
    onseen,
    onsnooze
  }: {
    note: Note;
    ringing?: boolean;
    /** Incrémenté pour placer le curseur dans le texte (nouvelle note). */
    focusRequest?: number;
    /** Dans Tauri : on déplace la fenêtre en tirant le haut de la note. */
    draggable?: boolean;
    onupdate: (patch: NotePatch) => void;
    ondelete: () => void;
    onseen: () => void;
    onsnooze: () => void;
  } = $props();

  const uid = $props.id();
  let article: HTMLElement;
  let textarea: HTMLTextAreaElement;
  let text = $state('');
  let editing = $state(false);
  let panel = $state<'color' | 'reminder' | null>(null);
  let time = $state('');
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  // Le texte reçu ne remplace pas ce qu'on est en train de taper.
  $effect(() => {
    const incoming = note.text;
    if (!editing) text = incoming;
  });

  $effect(() => {
    if (focusRequest) void tick().then(() => focusText());
  });

  const color = $derived(COLORS[note.color]);
  const size = $derived(textSize(text));
  // L'heure affichée sur le badge se recalcule chaque minute (« Demain 9:00 » devient « 9:00 »).
  let now = $state(Date.now());
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(t);
  });

  function focusText() {
    textarea?.focus();
    const end = textarea?.value.length ?? 0;
    textarea?.setSelectionRange(end, end);
  }

  function onInput() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushText, 300);
  }

  function flushText() {
    clearTimeout(saveTimer);
    if (text !== note.text) onupdate({ text });
  }

  /** On quitte la note : le texte est enregistré, et une note restée vide disparaît. */
  function leave() {
    editing = false;
    flushText();
    if (!text.trim() && !ringing && !note.remindAt) ondelete();
  }

  function onTextBlur(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && article.contains(next)) {
      flushText();
      return;
    }
    panel = null;
    leave();
  }

  function onWindowBlur() {
    panel = null;
    if (editing || !text.trim()) leave();
  }

  function togglePanel(p: 'color' | 'reminder') {
    if (p === 'reminder' && panel !== 'reminder') time = nextFullHour(Date.now());
    panel = panel === p ? null : p;
  }

  function remind(at: number | null) {
    onupdate({ remindAt: at });
    panel = null;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (panel) panel = null;
    else textarea?.blur();
  }
</script>

<svelte:window onblur={onWindowBlur} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article
  bind:this={article}
  class="note"
  class:ringing
  class:straight={editing || panel !== null}
  style:--paper={color.bg}
  style:--edge={color.edge}
  style:--rot="{note.rot}deg"
  aria-label="Note"
  onkeydown={onKey}
>
  <span class="tape" aria-hidden="true" data-tauri-drag-region={draggable || undefined}></span>
  <div class="grip" aria-hidden="true" data-tauri-drag-region={draggable || undefined}></div>

  <button
    class="tool pin"
    class:shown={editing || panel !== null}
    class:on={note.pinned}
    aria-label={note.pinned ? 'Désépingler la note' : 'Épingler au premier plan'}
    aria-pressed={note.pinned}
    title={note.pinned ? 'Désépingler' : 'Épingler au premier plan'}
    onclick={() => onupdate({ pinned: !note.pinned })}
  >
    <Icon name="pin" />
  </button>

  <div class="tools" class:shown={editing || panel !== null}>
    <button class="tool" class:on={panel === 'color'} aria-label="Couleur" aria-expanded={panel === 'color'} onclick={() => togglePanel('color')}>
      <Icon name="palette" />
    </button>
    <button
      class="tool"
      class:on={panel === 'reminder'}
      aria-label="Rappel"
      aria-expanded={panel === 'reminder'}
      onclick={() => togglePanel('reminder')}
    >
      <Icon name="bell" />
    </button>
    <button class="tool" aria-label="Supprimer la note" onclick={ondelete}>
      <Icon name="trash" stroke={2} />
    </button>
  </div>

  <textarea
    bind:this={textarea}
    bind:value={text}
    class="text {size}"
    placeholder="Écris ta note…"
    aria-label="Texte de la note"
    spellcheck="false"
    oninput={onInput}
    onfocus={() => ((editing = true), (panel = null))}
    onblur={onTextBlur}
  ></textarea>

  {#if ringing}
    <div class="ring-actions">
      <button class="seen" onclick={onseen}>Vu</button>
      <button class="snooze" onclick={onsnooze}>+10 min</button>
    </div>
  {:else if note.remindAt}
    <button class="badge" aria-label="Rappel à {formatReminder(note.remindAt, now)}, modifier" onclick={() => togglePanel('reminder')}>
      <Icon name="bell" size={14} stroke={2.4} />
      {formatReminder(note.remindAt, now)}
    </button>
  {/if}

  {#if panel === 'color'}
    <div class="pop colors" role="radiogroup" aria-label="Couleur de la note">
      {#each COLOR_IDS as id (id)}
        <button
          role="radio"
          aria-checked={note.color === id}
          aria-label={COLORS[id].name}
          class:on={note.color === id}
          style:background={COLORS[id].bg}
          onclick={() => ((panel = null), onupdate({ color: id }))}
        ></button>
      {/each}
    </div>
  {:else if panel === 'reminder'}
    <div class="pop reminder" role="dialog" aria-label="Rappel">
      <div class="head">
        <span>RAPPEL</span>
        {#if note.remindAt}
          <button class="link" onclick={() => remind(null)}>Retirer</button>
        {/if}
      </div>
      <button class="choice" onclick={() => remind(inMinutes(Date.now(), 30))}>Dans 30 min</button>
      <button class="choice" onclick={() => remind(inMinutes(Date.now(), 60))}>Dans 1 h</button>
      <button class="choice" onclick={() => remind(tomorrowAt(Date.now(), 9))}>Demain 9:00</button>
      <form
        class="at"
        onsubmit={(e) => {
          e.preventDefault();
          const at = atTime(Date.now(), time);
          if (at) remind(at);
        }}
      >
        <label for="{uid}-at">À</label>
        <input id="{uid}-at" type="time" bind:value={time} required />
        <button type="submit">OK</button>
      </form>
    </div>
  {/if}
</article>

<style>
  .note {
    position: relative;
    width: 240px;
    height: 240px;
    background: var(--paper);
    color: var(--ink);
    border-radius: 6px;
    box-shadow:
      0 5px 0 var(--edge),
      0 10px 16px rgba(0, 0, 0, 0.3);
    padding: 32px 0 14px;
    display: flex;
    flex-direction: column;
    transform: rotate(var(--rot));
    transition:
      transform 0.15s ease,
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }
  .note:hover,
  .note.straight {
    transform: translateY(-3px) rotate(0deg);
  }
  .tape {
    position: absolute;
    top: -11px;
    left: 50%;
    width: 92px;
    height: 24px;
    margin-left: -46px;
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.7);
    transform: rotate(-3deg);
    cursor: grab;
  }
  .grip {
    position: absolute;
    inset: 0 0 auto 0;
    height: 30px;
    cursor: grab;
  }
  .tools {
    position: absolute;
    top: 3px;
    right: 6px;
    display: flex;
    gap: 2px;
  }
  .tool {
    opacity: 0;
    transition: opacity 0.15s ease;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tool:hover,
  .tool.on {
    background: rgba(29, 24, 48, 0.12);
  }
  .pin {
    position: absolute;
    top: 3px;
    left: 6px;
  }
  .note:hover .tool,
  .tools.shown .tool,
  .tools:focus-within .tool,
  .tool.pin.shown,
  .tool.pin:focus-visible,
  .tool.pin.on {
    opacity: 1;
  }
  /* Une note épinglée garde son épingle visible, même sans survol. */
  .tool.pin.on {
    background: transparent;
  }
  .note:hover .tool.pin.on {
    background: rgba(29, 24, 48, 0.12);
  }
  .tool.pin.on :global(svg) {
    transform: rotate(-30deg);
  }
  .text {
    flex: 1;
    min-height: 0;
    width: 100%;
    border: 0;
    outline: none;
    resize: none;
    background: transparent;
    color: var(--ink);
    padding: 2px 20px;
    font-weight: 600;
    line-height: 1.4;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(29, 24, 48, 0.3) transparent;
  }
  .text.l {
    font-size: 17px;
  }
  .text.m {
    font-size: 15px;
  }
  .text.s {
    font-size: 13px;
  }
  .text::placeholder {
    color: rgba(29, 24, 48, 0.45);
  }
  .badge {
    margin: 8px 20px 0;
    align-self: flex-start;
    height: 28px;
    border: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--ink);
    color: var(--accent);
    border-radius: 999px;
    padding: 0 10px 0 8px;
    font-size: 13px;
    font-weight: 700;
  }
  .ring-actions {
    margin: 8px 16px 0;
    display: flex;
    gap: 6px;
  }
  .ring-actions button {
    flex: 1;
    height: 36px;
    border: 0;
    border-radius: 8px;
    font-size: 13px;
  }
  .seen {
    background: var(--ink);
    color: var(--accent);
    font-weight: 700;
  }
  .snooze {
    background: rgba(29, 24, 48, 0.12);
    color: var(--ink);
    font-weight: 600;
  }
  .ringing {
    box-shadow:
      0 0 0 4px var(--accent),
      0 0 18px rgba(255, 210, 63, 0.7),
      0 10px 16px rgba(0, 0, 0, 0.3);
    animation: wiggle 0.5s ease-in-out infinite;
  }
  .ringing:hover {
    animation: none;
  }
  @keyframes wiggle {
    0%,
    100% {
      transform: rotate(-2deg);
    }
    25% {
      transform: rotate(2.5deg);
    }
    50% {
      transform: rotate(-2.5deg);
    }
    75% {
      transform: rotate(2deg);
    }
  }
  .pop {
    position: absolute;
    z-index: 2;
    background: var(--surface);
    color: var(--text);
    border-radius: 12px;
    box-shadow:
      0 5px 0 var(--shadow),
      0 0 0 2px var(--line);
  }
  .colors {
    top: 34px;
    right: 8px;
    padding: 10px;
    display: grid;
    grid-template-columns: repeat(3, 32px);
    gap: 8px;
  }
  .colors button {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
  }
  .colors button.on {
    box-shadow:
      0 0 0 3px var(--surface),
      0 0 0 5px #fff;
  }
  .reminder {
    top: 32px;
    left: 10px;
    right: 10px;
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 24px;
  }
  .head span {
    font-family: var(--display);
    font-size: 16px;
    letter-spacing: 0.5px;
    color: var(--accent);
  }
  .link {
    border: 0;
    background: none;
    padding: 4px 2px;
    color: var(--danger);
    font-size: 12px;
    font-weight: 600;
  }
  .choice {
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: var(--surface-3);
    text-align: left;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 500;
  }
  .choice:hover {
    background: var(--line-strong);
  }
  .at {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .at label {
    font-size: 13px;
  }
  .at input {
    flex: 1;
    min-width: 0;
    height: 32px;
    border-radius: 8px;
    border: 2px solid var(--line-strong);
    background: var(--bg);
    padding: 0 6px;
    font-size: 14px;
  }
  .at button {
    height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: var(--accent);
    color: var(--ink);
    font-weight: 700;
    font-size: 13px;
  }
</style>
