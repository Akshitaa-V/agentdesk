import { cosine, embed } from "./embeddings";

export interface Doc {
  id: string;
  title: string;
  text: string;
}

export interface SearchHit {
  id: string;
  title: string;
  text: string;
  score: number;
}

/**
 * In-memory vector index with exact (brute-force) cosine search.
 *
 * Complexity: add is O(d) per chunk; search is O(n*d) to score n chunks of
 * dimension d, plus O(n*k) to keep the top k in a small sorted buffer.
 * That beats sorting all n scores (O(n log n)) when k is small, and exact
 * search is the right call below roughly 100k chunks. Past that, an ANN index
 * (HNSW, as in pgvector or Qdrant) trades a little recall for sub-linear search.
 */
export class VectorStore {
  private entries: { doc: Doc; vector: Float32Array }[] = [];

  constructor(private readonly embedFn: (text: string) => Float32Array = embed) {}

  add(docs: Doc[]): void {
    for (const doc of docs) {
      this.entries.push({ doc, vector: this.embedFn(`${doc.title} ${doc.text}`) });
    }
  }

  get size(): number {
    return this.entries.length;
  }

  search(query: string, k = 3, minScore = 0.05): SearchHit[] {
    if (k <= 0 || this.entries.length === 0) return [];
    const q = this.embedFn(query);
    const top: SearchHit[] = []; // kept sorted, highest score first

    for (const { doc, vector } of this.entries) {
      const score = cosine(q, vector);
      if (score < minScore) continue;
      if (top.length === k && score <= top[k - 1].score) continue;

      let i = top.length;
      while (i > 0 && top[i - 1].score < score) i--;
      top.splice(i, 0, { ...doc, score: Number(score.toFixed(4)) });
      if (top.length > k) top.pop();
    }
    return top;
  }
}

/** Split text into overlapping word windows so answers that cross a boundary are still retrievable. */
export function chunkText(text: string, maxWords = 60, overlap = 15): string[] {
  if (overlap >= maxWords) throw new Error("overlap must be smaller than maxWords");
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [words.join(" ")];
  const chunks: string[] = [];
  const step = maxWords - overlap;
  for (let start = 0; start < words.length; start += step) {
    chunks.push(words.slice(start, start + maxWords).join(" "));
    if (start + maxWords >= words.length) break;
  }
  return chunks;
}
