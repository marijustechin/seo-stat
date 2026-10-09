export interface WordpressIdentity {
  id: number;
  name: string;
  slug: string | null;
  roles: string[];
  capabilities: Record<string, boolean>;
}

export interface WordpressTest {
  status: 'succeeded' | 'failed';
  at: string;
  error: string | null;
  identity: WordpressIdentity | null;
}

export interface WordpressIntegration {
  connected: boolean;
  siteUrl: string | null;
  username: string | null;
  hasPassword: boolean;
  encryptionConfigured: boolean;
  lastTest: WordpressTest | null;
}

export interface WordpressIntegrationInput {
  siteUrl: string;
  username: string;
  /** Omit or leave blank to keep the existing stored password. */
  applicationPassword?: string | null;
}

export type WordpressExportStatus = 'in_progress' | 'succeeded' | 'failed' | 'uncertain' | 'conflict';

export interface WordpressExportAttempt {
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

export interface DraftExport {
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
  changedSinceExport: boolean;
  remoteEditDetected: boolean;
  inProgress: boolean;
  status: WordpressExportStatus | null;
  attempts: WordpressExportAttempt[];
}
