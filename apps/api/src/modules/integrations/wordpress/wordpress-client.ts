export interface WordpressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface WordpressIdentity {
  id: number;
  name: string;
  slug: string | null;
  capabilities: Record<string, boolean>;
  roles: string[];
}

export interface WordpressPost {
  id: number;
  status: string;
  link: string;
  slug: string;
  modified: string;
  contentRendered: string;
}

export interface WordpressDraftInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  featuredMedia?: number;
}

export interface WordpressMediaInput {
  fileName: string;
  mimeType: string;
  data: Buffer;
  altText?: string;
}

export interface WordpressMedia {
  id: number;
  sourceUrl: string;
}

/** A sanitized error for a non-2xx WordPress REST response. */
export class WordpressRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'WordpressRequestError';
  }
}

/**
 * Small boundary over the WordPress REST API. Tests provide a stub
 * implementation instead of network access (mirroring the analysis provider).
 * The application implements exactly one WordPress client.
 */
export abstract class WordpressClient {
  abstract verify(credentials: WordpressCredentials): Promise<WordpressIdentity>;
  abstract createDraft(credentials: WordpressCredentials, input: WordpressDraftInput): Promise<WordpressPost>;
  abstract updateDraft(
    credentials: WordpressCredentials,
    postId: number,
    input: WordpressDraftInput,
  ): Promise<WordpressPost>;
  abstract getPost(credentials: WordpressCredentials, postId: number): Promise<WordpressPost>;
  abstract findPostBySlug(credentials: WordpressCredentials, slug: string): Promise<WordpressPost | null>;
  abstract uploadMedia(credentials: WordpressCredentials, input: WordpressMediaInput): Promise<WordpressMedia>;
}
