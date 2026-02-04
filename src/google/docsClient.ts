import type { DocsBatchUpdateResponse, DocsDocument } from "./types";

const BASE_URL = "https://docs.googleapis.com/v1/documents";

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Docs API error ${response.status}: ${text}`);
  }
  return (await response.json()) as T;
}

export class DocsClient {
  constructor(private readonly accessToken: string) {}

  async getDocument(docId: string): Promise<DocsDocument> {
    return fetchJson<DocsDocument>(`${BASE_URL}/${docId}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
  }

  async batchUpdate(docId: string, requests: unknown[]): Promise<DocsBatchUpdateResponse> {
    return fetchJson<DocsBatchUpdateResponse>(`${BASE_URL}/${docId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ requests }),
    });
  }
}
