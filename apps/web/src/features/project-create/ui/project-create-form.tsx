'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createProject } from '@/entities/project/api';

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ProjectCreateForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const project = await createProject({
        name: name.trim(),
        description: clean(description),
        websiteUrl: clean(websiteUrl),
      });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="field">
        <label htmlFor="project-name">Name</label>
        <input
          id="project-name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="project-description">Description</label>
        <textarea
          id="project-description"
          className="textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="field">
        <label htmlFor="project-website">Website URL</label>
        <input
          id="project-website"
          className="input"
          type="url"
          placeholder="https://example.com"
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          maxLength={2048}
        />
        <p className="help">Optional during initial setup.</p>
      </div>

      <div className="form-actions">
        <button type="submit" className="button cursor-pointer" disabled={saving}>
          {saving ? 'Creating…' : 'Create project'}
        </button>
        <Link className="button cursor-pointer" href="/">
          Cancel
        </Link>
      </div>
    </form>
  );
}
