export interface ArticleImageView {
  id: string;
  projectId: string;
  draftId: string | null;
  version: number;
  kind: 'generated' | 'uploaded';
  status: 'ready' | 'failed' | 'unavailable';
  prompt: string | null;
  altText: string | null;
  provider: string | null;
  model: string | null;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  usage: unknown;
  selected: boolean;
  error: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImageProviderStatus {
  provider: string;
  model: string;
  configured: boolean;
}
