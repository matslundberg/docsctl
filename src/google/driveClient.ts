import type { DriveComment } from "./types";

const BASE_URL = "https://www.googleapis.com/drive/v3";

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive API error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

export class DriveClient {
  constructor(private readonly accessToken: string) {}

  async getComment(docId: string, commentId: string): Promise<DriveComment> {
    const url = `${BASE_URL}/files/${docId}/comments/${commentId}?fields=id,content,resolved,createdTime,modifiedTime,author,anchor,quotedFileContent`;
    return fetchJson<DriveComment>(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
  }

  async listComments(docId: string): Promise<DriveComment[]> {
    const url = `${BASE_URL}/files/${docId}/comments?fields=comments(id,content,resolved,createdTime,modifiedTime,author,anchor,quotedFileContent)`;
    const data = await fetchJson<{ comments?: DriveComment[] }>(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    return data.comments ?? [];
  }

  async addComment(docId: string, payload: unknown): Promise<DriveComment> {
    const url = `${BASE_URL}/files/${docId}/comments?fields=id,content,resolved,createdTime,modifiedTime,author`;
    return fetchJson<DriveComment>(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  async replyToComment(docId: string, commentId: string, payload: unknown): Promise<unknown> {
    const url = `${BASE_URL}/files/${docId}/comments/${commentId}/replies?fields=id,content,action,createdTime,modifiedTime,author`;
    return fetchJson<unknown>(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  async updateComment(docId: string, commentId: string, payload: unknown): Promise<DriveComment> {
    const url = `${BASE_URL}/files/${docId}/comments/${commentId}?fields=id,content,resolved,createdTime,modifiedTime,author`;
    return fetchJson<DriveComment>(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }
}
