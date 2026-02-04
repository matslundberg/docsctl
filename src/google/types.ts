export interface DocsDocument {
  documentId: string;
  revisionId?: string;
  title?: string;
  body?: {
    content?: unknown[];
  };
}

export interface DocsBatchUpdateResponse {
  documentId?: string;
  replies?: unknown[];
  writeControl?: { requiredRevisionId?: string };
}

export interface DriveComment {
  id: string;
  content?: string;
  status?: string;
  resolved?: boolean;
  createdTime?: string;
  modifiedTime?: string;
  author?: { displayName?: string; emailAddress?: string };
  anchor?: string;
  quotedFileContent?: { mimeType?: string; value?: string };
}
