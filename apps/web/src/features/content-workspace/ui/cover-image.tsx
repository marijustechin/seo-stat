'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateImage, listImages, selectImage, updateImage, uploadImage } from '@/entities/content/api';
import type { ArticleImage } from '@/entities/content/model';
import { ApiError } from '@/shared/api/client';
import { apiUrl } from '@/shared/config/app';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

function explain(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 503) return 'Image generation is not configured on the server.';
    if (err.status === 413) return 'The image is larger than the allowed size.';
    if (err.status === 400) return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

function usageSummary(usage: unknown): string {
  if (!usage || typeof usage !== 'object') return '';
  return Object.entries(usage as Record<string, unknown>)
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

export function CoverImage({ projectId, draftId }: { projectId: string; draftId: string }) {
  const [images, setImages] = useState<ArticleImage[] | null>(null);
  const [visualBrief, setVisualBrief] = useState('');
  const [altText, setAltText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      setImages(await listImages(projectId, draftId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images.');
    }
  }, [projectId, draftId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    void load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await generateImage(projectId, draftId, { prompt: visualBrief || undefined, altText: altText || undefined });
      setNotice('New cover generated. Previous images are kept.');
      await load();
    } catch (err) {
      setError(explain(err, 'Failed to generate the cover image.'));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      setError('Use a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('The image is larger than the allowed size.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const dataBase64 = await fileToBase64(file);
      await uploadImage(projectId, draftId, { dataBase64, fileName: file.name, mimeType: file.type, altText: altText || undefined });
      setNotice('Image uploaded.');
      await load();
    } catch (err) {
      setError(explain(err, 'Failed to upload the image.'));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const markSelected = async (image: ArticleImage) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await selectImage(projectId, image.id);
      await load();
    } catch (err) {
      setError(explain(err, 'Failed to select the image.'));
    } finally {
      setBusy(false);
    }
  };

  const selected = images?.find((image) => image.selected) ?? null;

  return (
    <div className="card">
      <h3>Cover image</h3>
      <p className="muted">
        A generated image is a draft visual, not an editorially verified asset. Only the selected image is
        published. Previous images are preserved when you regenerate.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-success" role="status">
          {notice}
        </p>
      )}

      {selected && selected.status === 'ready' && (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin project-scoped API asset (no authentication) */}
          <img src={apiUrl(selected.url)} alt={selected.altText ?? 'Article cover image'} className="cover-preview" />
          <figcaption className="muted">Selected cover</figcaption>
        </figure>
      )}

      <div className="field">
        <label htmlFor="cover-brief">Visual brief (what the image should show)</label>
        <textarea id="cover-brief" className="textarea" rows={2} value={visualBrief} onChange={(e) => setVisualBrief(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="cover-alt">Alt text (accessibility)</label>
        <input id="cover-alt" className="input" value={altText} onChange={(e) => setAltText(e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="button" className="button cursor-pointer" onClick={generate} disabled={busy}>
          {busy ? 'Working…' : 'Generate cover image'}
        </button>
        <button
          type="button"
          className="button cursor-pointer"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          Upload image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      {images && images.length > 0 && (
        <ul className="run-list">
          {images.map((image) => (
            <ImageRow
              key={`${image.id}:${image.updatedAt}`}
              projectId={projectId}
              draftId={draftId}
              image={image}
              busy={busy}
              onReload={load}
              onSelect={markSelected}
              onError={setError}
              onNotice={setNotice}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ImageRow({
  projectId,
  draftId,
  image,
  busy,
  onReload,
  onSelect,
  onError,
  onNotice,
}: {
  projectId: string;
  draftId: string;
  image: ArticleImage;
  busy: boolean;
  onReload: () => Promise<void>;
  onSelect: (image: ArticleImage) => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string | null) => void;
}) {
  const [prompt, setPrompt] = useState(image.prompt ?? '');
  const [alt, setAlt] = useState(image.altText ?? '');
  const [working, setWorking] = useState(false);
  const usage = usageSummary(image.usage);

  const run = async (action: () => Promise<unknown>, fallback: string, done?: string) => {
    setWorking(true);
    onError('');
    onNotice(null);
    try {
      await action();
      await onReload();
      if (done) onNotice(done);
    } catch (err) {
      onError(explain(err, fallback));
    } finally {
      setWorking(false);
    }
  };

  const disabled = working || busy;

  return (
    <li className="run-item">
      <div className="run-head">
        <strong>
          {image.kind} · v{image.version}
        </strong>
        <span className="badge">{image.selected ? 'selected' : image.status}</span>
      </div>
      <p className="muted">
        {image.provider ? `${image.provider}${image.model ? ` / ${image.model}` : ''}` : 'uploaded'}
        {image.width && image.height ? ` · ${image.width}×${image.height}` : ''}
        {image.bytes ? ` · ${Math.round(image.bytes / 1024)} KB` : ''}
        {usage ? ` · usage ${usage}` : ''}
      </p>
      {image.error && <p className="status-error">{image.error}</p>}
      {image.kind === 'generated' && (
        <div className="field">
          <label htmlFor={`prompt-${image.id}`}>Visual prompt (editable)</label>
          <textarea
            id={`prompt-${image.id}`}
            className="textarea"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor={`alt-${image.id}`}>Alt text</label>
        <input
          id={`alt-${image.id}`}
          className="input"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() => {
            if (alt !== (image.altText ?? '')) {
              void run(() => updateImage(projectId, image.id, { altText: alt }), 'Failed to update the alt text.', 'Alt text saved.');
            }
          }}
        />
      </div>
      <div className="form-actions">
        {image.kind === 'generated' && (
          <>
            <button
              type="button"
              className="button cursor-pointer"
              onClick={() => void run(() => updateImage(projectId, image.id, { prompt }), 'Failed to save the prompt.', 'Prompt saved.')}
              disabled={disabled || prompt === (image.prompt ?? '')}
            >
              Save prompt
            </button>
            <button
              type="button"
              className="button cursor-pointer"
              onClick={() =>
                void run(
                  () => generateImage(projectId, draftId, { prompt: prompt || undefined, altText: alt || undefined }),
                  'Failed to regenerate the cover image.',
                  'Regenerated. The previous image is kept.',
                )
              }
              disabled={disabled}
            >
              Regenerate
            </button>
          </>
        )}
        <button
          type="button"
          className="button cursor-pointer"
          onClick={() => void onSelect(image)}
          disabled={disabled || image.selected || image.status !== 'ready'}
        >
          {image.selected ? 'Selected' : 'Use as cover'}
        </button>
      </div>
    </li>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read the file.'));
        return;
      }
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsDataURL(file);
  });
}
