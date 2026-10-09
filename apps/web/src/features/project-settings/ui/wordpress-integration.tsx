'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  disconnectWordpress,
  getWordpressIntegration,
  saveWordpressIntegration,
  testWordpressIntegration,
} from '@/entities/integration/api';
import type { WordpressIntegration as WordpressIntegrationView } from '@/entities/integration/model';
import { useProject } from '@/widgets/project-workspace/project-context';

export function WordpressIntegration() {
  const { project } = useProject();
  const [integration, setIntegration] = useState<WordpressIntegrationView | null>(null);
  const [siteUrl, setSiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((next: WordpressIntegrationView) => {
    setIntegration(next);
    setSiteUrl(next.siteUrl ?? '');
    setUsername(next.username ?? '');
    setPassword('');
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await getWordpressIntegration(project.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the WordPress connection.');
    }
  }, [apply, project.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  const run = async (action: () => Promise<WordpressIntegrationView>, fallback: string, done: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      apply(await action());
      setMessage(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(
      () =>
        saveWordpressIntegration(project.id, {
          siteUrl: siteUrl.trim(),
          username: username.trim(),
          ...(password.trim() ? { applicationPassword: password.trim() } : {}),
        }),
      'Failed to save the WordPress connection.',
      'WordPress connection saved.',
    );

  const test = () =>
    run(() => testWordpressIntegration(project.id), 'Connection test failed.', 'Connection test finished.');

  const disconnect = async () => {
    if (!window.confirm('Disconnect WordPress? Stored credentials are removed from SEO-STAT.')) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      apply(await disconnectWordpress(project.id));
      setMessage('WordPress disconnected.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect WordPress.');
    } finally {
      setBusy(false);
    }
  };

  const archived = project.status === 'archived';
  const encryptionMissing = integration !== null && !integration.encryptionConfigured;
  const disabled = busy || archived || encryptionMissing;

  return (
    <fieldset className="fieldset">
      <legend>WordPress</legend>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {archived && <p className="muted">This project is archived; WordPress changes are disabled.</p>}
      {encryptionMissing && (
        <p className="form-error" role="alert">
          The server integration encryption key is not configured. An administrator must set
          <code> INTEGRATION_ENCRYPTION_KEY_FILE</code> (default <code>/srv/seo-stat/config/integration.key</code>)
          before credentials can be stored.
        </p>
      )}

      <p className="muted">
        Sends article drafts to your WordPress site as <strong>WordPress drafts</strong>. A dedicated
        Application Password is used over HTTPS; it is stored encrypted and never shown again.
      </p>

      <div className="field">
        <label htmlFor="wp-site-url">WordPress site URL</label>
        <input
          id="wp-site-url"
          className="input"
          type="url"
          placeholder="https://example.com"
          value={siteUrl}
          onChange={(event) => setSiteUrl(event.target.value)}
          maxLength={2048}
          disabled={disabled}
        />
      </div>
      <div className="field">
        <label htmlFor="wp-username">Username</label>
        <input
          id="wp-username"
          className="input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          maxLength={200}
          disabled={disabled}
        />
      </div>
      <div className="field">
        <label htmlFor="wp-password">Application Password</label>
        <input
          id="wp-password"
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder={integration?.hasPassword ? 'Leave blank to keep the current password' : 'xxxx xxxx xxxx xxxx xxxx xxxx'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          maxLength={500}
          disabled={disabled}
        />
        <p className="help">
          Create a dedicated password in WordPress under <strong>Users → Profile → Application
          Passwords</strong> (or open{' '}
          {siteUrl.trim() ? (
            <a href={`${siteUrl.replace(/\/+$/, '')}/wp-admin/profile.php`} target="_blank" rel="noreferrer">
              your profile
            </a>
          ) : (
            'your profile'
          )}
          ). Name it for SEO-STAT so it can be revoked independently. Leave the field blank when saving
          other changes to keep the stored password.
        </p>
      </div>

      <div className="form-actions">
        <button type="button" className="button cursor-pointer" onClick={save} disabled={disabled}>
          {busy ? 'Working…' : 'Save connection'}
        </button>
        <button
          type="button"
          className="button cursor-pointer"
          onClick={test}
          disabled={disabled || !integration?.connected}
        >
          Test connection
        </button>
        <button
          type="button"
          className="button cursor-pointer"
          onClick={disconnect}
          disabled={busy || archived || !integration?.connected}
        >
          Disconnect
        </button>
      </div>

      {integration?.connected && (
        <p role="status" className="muted">
          Status: <strong>connected</strong> to {integration.siteUrl} as {integration.username}.
        </p>
      )}
      {integration && !integration.connected && <p className="muted">Status: not connected.</p>}
      {integration?.lastTest && (
        <p
          role="status"
          className={integration.lastTest.status === 'succeeded' ? 'status-ok' : 'status-error'}
        >
          {integration.lastTest.status === 'succeeded'
            ? `Connection verified as ${integration.lastTest.identity?.name ?? 'the account'}${
                integration.lastTest.identity?.roles?.length
                  ? ` (${integration.lastTest.identity.roles.join(', ')})`
                  : ''
              } at ${new Date(integration.lastTest.at).toLocaleString()}.`
            : `Connection test failed: ${integration.lastTest.error ?? 'unknown error'}`}
        </p>
      )}
    </fieldset>
  );
}
