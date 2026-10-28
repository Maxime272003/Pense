<script lang="ts">
  let { checked, labelledby, onchange }: { checked: boolean; labelledby: string; onchange: (v: boolean) => void } = $props();
</script>

<button role="switch" aria-checked={checked} aria-labelledby={labelledby} class:on={checked} onclick={() => onchange(!checked)}>
  <span></span>
</button>

<style>
  button {
    flex-shrink: 0;
    width: 56px;
    height: 32px;
    border: 0;
    border-radius: 16px;
    background: var(--line-strong);
    padding: 4px;
    display: flex;
    transition: background-color 0.18s ease;
  }
  button.on {
    background: var(--ok);
  }
  span {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
    transition: transform 0.18s cubic-bezier(0.3, 0.7, 0.4, 1);
  }
  .on span {
    transform: translateX(24px);
  }
</style>
