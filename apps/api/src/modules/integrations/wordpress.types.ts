export const WORDPRESS_EXPORT_STATUSES = [
  'in_progress',
  'succeeded',
  'failed',
  'uncertain',
  'conflict',
] as const;
export type WordpressExportStatus = (typeof WORDPRESS_EXPORT_STATUSES)[number];

export interface WordpressIdentityView {
  id: number;
  name: string;
  slug: string | null;
  roles: string[];
  capabilities: Record<string, boolean>;
}

export interface WordpressTestView {
  status: 'succeeded' | 'failed';
  at: string;
  error: string | null;
  identity: WordpressIdentityView | null;
}

export interface WordpressIntegrationView {
  connected: boolean;
  siteUrl: string | null;
  username: string | null;
  hasPassword: boolean;
  /** Whether the deployment encryption key is present (credentials can be stored/read). */
  encryptionConfigured: boolean;
  lastTest: WordpressTestView | null;
}

export interface WordpressExportAttemptView {
  id: string;
  status: WordpressExportStatus;
  draftVersion: number;
  createdAt: string;
  finishedAt: string | null;
  remotePostId: number | null;
  remoteMediaId: number | null;
  remoteLink: string | null;
  error: string | null;
}

export interface DraftExportView {
  configured: boolean;
  encryptionConfigured: boolean;
  siteUrl: string | null;
  eligible: boolean;
  ineligibleReason: string | null;
  draft: { id: string; version: number; title: string | null; updatedAt: string };
  cover: {
    id: string;
    url: string;
    fileName: string | null;
    hasAlt: boolean;
    reusedRemoteMediaId: number | null;
  } | null;
  remotePostId: number | null;
  remoteLink: string | null;
  lastExportedVersion: number | null;
  lastExportedAt: string | null;
  /** The persisted draft differs from the last successful export. */
  changedSinceExport: boolean;
  /** The latest attempt detected a remote edit or a non-draft remote status. */
  remoteEditDetected: boolean;
  inProgress: boolean;
  status: WordpressExportStatus | null;
  attempts: WordpressExportAttemptView[];
}
