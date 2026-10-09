'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateImage, listImages, selectImage, updateImage, uploadImage } from '@/entities/content/api';
import type { ArticleImage } from '@/entities/content/model';
import { ApiError } from '@/shared/api/client';
import { apiUrl } from '@/shared/config/app';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export function CoverImage({ projectId, draftId }: { projectId: string; draftId: string }) {
  const [images, setImages] = useState<ArticleImage[] | null>(null);
  const [visualBrief, setVisualBrief] = useState('');
  const [altText, setAltText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const explain = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      if (err.status === 503) return 'Image generation is not configured on the server.';
      if (err.status === 413) return 'The image is larger than the allowed size.';
      if (err.status === 400) return err.message;
    }
    return err instanceof Error ? err.message : fallback;
  };

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      await generateImage(projectId, draftId, { prompt: visualBrief || undefined, altText: altText || undefined });
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
    try {
      const dataBase64 = await fileToBase64(file);
      await uploadImage(projectId, draftId, { dataBase64, fileName: file.name, mimeType: file.type, altText: altText || undefined });
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
    try {
      await selectImage(projectId, image.id);
      await load();
    } catch (err) {
      setError(explain(err, 'Failed to select the image.'));
    } finally {
      setBusy(false);
    }
  };

  const updateAlt = async (image: ArticleImage, value: string) => {
    try {
      await updateImage(projectId, image.id, { altText: value });
      setImages((current) => current?.map((item) => (item.id === image.id ? { ...item, altText: value } : item)) ?? null);
    } catch (err) {
      setError(explain(err, 'Failed to update the alt text.'));
    }
  };

  const selected = images?.find((image) => image.selected) ?? null;

  return (
    <div className="card">
      <h3>Cover image</h3>
      <p className="muted">
        A generated image is a draft visual, not an editorially verified asset. Only the selected image is
        published.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {selected && selected.status === 'ready' && (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API asset */}
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
            <li key={image.id} className="run-item">
              <div className="run-head">
                <strong>
                  {image.kind} · v{image.version}
                </strong>
                <span className="badge">{image.selected ? 'selected' : image.status}</span>
              </div>
              {image.prompt && <p className="muted">{image.prompt}</p>}
              {image.error && <p className="status-error">{image.error}</p>}
              <div className="field">
                <label htmlFor={`alt-${image.id}`}>Alt text</label>
                <input
                  id={`alt-${image.id}`}
                  className="input"
                  value={image.altText ?? ''}
                  onChange={(e) => void updateAlt(image, e.target.value)}
                />
              </div>
              <button
                type="button"
                className="button cursor-pointer"
                onClick={() => void markSelected(image)}
                disabled={busy || image.selected || image.status !== 'ready'}
              >
                {image.selected ? 'Selected' : 'Use as cover'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
