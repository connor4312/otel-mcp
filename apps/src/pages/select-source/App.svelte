<script lang="ts">
  import { onMount } from 'svelte';
  import StatusMessage from '$lib/components/StatusMessage.svelte';
  import Button from '$lib/components/Button.svelte';

  let currentMode = $state<'local' | 'remote' | null>(null);
  let localPath = $state('');
  let remoteHost = $state('');
  let remoteUser = $state('');
  let remotePath = $state('');
  let submitting = $state(false);
  let status = $state<{ type: 'error' | 'success' | 'loading'; message: string } | null>(null);

  let sessionId: string | null = null;
  let elicitationId: string | null = null;

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    sessionId = params.get('session');
    elicitationId = params.get('elicitation');
  });

  function selectMode(mode: 'local' | 'remote') {
    currentMode = mode;
    status = null;
  }

  async function submit() {
    if (!currentMode) return;
    submitting = true;

    let body: Record<string, string>;
    if (currentMode === 'local') {
      if (!localPath.trim()) {
        status = { type: 'error', message: 'Please enter a file path.' };
        submitting = false;
        return;
      }
      body = { type: 'local', localPath: localPath.trim(), sessionId: sessionId!, elicitationId: elicitationId! };
    } else {
      if (!remoteHost.trim() || !remotePath.trim()) {
        status = { type: 'error', message: 'Host and remote path are required.' };
        submitting = false;
        return;
      }
      body = {
        type: 'remote',
        remoteHost: remoteHost.trim(),
        remoteUser: remoteUser.trim() || 'root',
        remotePath: remotePath.trim(),
        sessionId: sessionId!,
        elicitationId: elicitationId!
      };
    }

    status = { type: 'loading', message: 'Loading traces…' };

    try {
      const res = await fetch('/api/select-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        status = { type: 'success', message: data.message || 'Traces loaded successfully. You can close this tab.' };
      } else {
        status = { type: 'error', message: data.error || 'Something went wrong.' };
        submitting = false;
      }
    } catch (err: any) {
      status = { type: 'error', message: 'Network error: ' + err.message };
      submitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && currentMode && !submitting) {
      submit();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="container">
  <h1>Load Trace Data</h1>
  <p class="subtitle">Choose a data source to load OpenTelemetry traces from.</p>

  <div class="cards">
    <button
      class="card"
      class:active={currentMode === 'local'}
      onclick={() => selectMode('local')}
    >
      <span class="card-icon">📁</span>
      <div class="card-title">Local File</div>
      <div class="card-desc">Read a traces.jsonl file from this machine</div>
    </button>
    <button
      class="card"
      class:active={currentMode === 'remote'}
      onclick={() => selectMode('remote')}
    >
      <span class="card-icon">🌐</span>
      <div class="card-title">Remote File</div>
      <div class="card-desc">Copy a file from a remote host via SCP</div>
    </button>
  </div>

  {#if currentMode === 'local'}
    <div class="form-section visible">
      <div class="field">
        <label for="local-path">File Path</label>
        <input
          type="text"
          id="local-path"
          placeholder="/var/log/otel/traces.jsonl"
          autocomplete="off"
          spellcheck="false"
          bind:value={localPath}
        />
      </div>
    </div>
  {/if}

  {#if currentMode === 'remote'}
    <div class="form-section visible">
      <div class="row">
        <div class="field">
          <label for="remote-host">Host</label>
          <input
            type="text"
            id="remote-host"
            placeholder="prod-server.example.com"
            autocomplete="off"
            spellcheck="false"
            bind:value={remoteHost}
          />
        </div>
        <div class="field">
          <label for="remote-user">Username</label>
          <input
            type="text"
            id="remote-user"
            placeholder="ubuntu"
            autocomplete="off"
            spellcheck="false"
            bind:value={remoteUser}
          />
        </div>
      </div>
      <div class="field">
        <label for="remote-path">Remote File Path</label>
        <input
          type="text"
          id="remote-path"
          placeholder="/var/log/otel/traces.jsonl"
          autocomplete="off"
          spellcheck="false"
          bind:value={remotePath}
        />
      </div>
    </div>
  {/if}

  <div class="submit-wrap">
    <Button variant="primary" onclick={submit} disabled={!currentMode || submitting}>
      {#snippet children()}Load Traces{/snippet}
    </Button>
  </div>

  {#if status}
    <StatusMessage type={status.type} message={status.message} />
  {/if}
</div>

<style>
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface-hover: #22263a;
    --border: #2e3348;
    --border-active: #6366f1;
    --text: #e2e8f0;
    --text-muted: #94a3b8;
    --accent: #6366f1;
    --accent-hover: #818cf8;
    --danger: #ef4444;
    --success: #22c55e;
    --radius: 12px;
  }

  :global(*) { margin: 0; padding: 0; box-sizing: border-box; }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .container { max-width: 560px; width: 100%; }
  h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 4px; }
  .subtitle { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 28px; }

  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }

  .card {
    background: var(--surface);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 20px 16px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
    user-select: none;
    color: var(--text);
    font-family: inherit;
    font-size: inherit;
  }
  .card:hover { background: var(--surface-hover); }
  .card.active { border-color: var(--accent); background: var(--surface-hover); }
  .card-icon { font-size: 2rem; margin-bottom: 8px; display: block; }
  .card-title { font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; }
  .card-desc { font-size: 0.8rem; color: var(--text-muted); }

  .form-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 20px;
    animation: slideIn 0.2s ease;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .field { margin-bottom: 16px; }
  .field:last-child { margin-bottom: 0; }

  label {
    display: block;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 6px;
    letter-spacing: 0.02em;
  }

  input {
    width: 100%;
    padding: 10px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 0.9rem;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus { border-color: var(--accent); }
  input::placeholder { color: #4a5068; }

  .row { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }

  .submit-wrap { margin-bottom: 4px; }
  .submit-wrap :global(button) { width: 100%; padding: 12px; font-size: 0.95rem; font-weight: 600; border-radius: 8px; }
</style>
