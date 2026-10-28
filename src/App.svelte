<script lang="ts">
  import Desk from './components/Desk.svelte';
  import NoteWindow from './components/NoteWindow.svelte';
  import Settings from './components/Settings.svelte';
  import { pense } from './lib/pense.svelte';
  import { hideSelf, isTauri } from './lib/platform';

  let { noteId }: { noteId: string | null } = $props();
</script>

{#if noteId}
  <NoteWindow id={noteId} />
{:else if !isTauri}
  {#if pense.loaded}<Desk />{/if}
{:else if pense.loaded}
  <Settings onclose={() => hideSelf()} />
{/if}
