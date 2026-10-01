/**
 * Dependency-free text embeddings using the signed hashing trick.
 *
 * Each unigram and bigram is hashed (FNV-1a) into one of DIM buckets with a
 * +1/-1 sign, then the vector is L2-normalised so a dot product equals cosine
 * similarity. It needs no API key and no model download, which keeps the demo
 * runnable anywhere. Swap `embed` for a hosted embedding model in production;
 * the VectorStore does not care where vectors come from.
 */
export const DIM = 512;

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "it",
  "my", "i", "me", "you", "your", "can", "do", "does", "how", "what", "with", "be",
  "this", "that", "at", "by", "from", "as", "if", "we", "our", "will", "not",
]);

/** Very light suffix stripping so "refund", "refunds" and "refunded" share a feature. */
export function stem(word: string): string {
  if (word.length <= 4) return word;
  if (/(ss|us|is)$/.test(word)) return word; // "access", "status", "basis"
  if (/(sh|ch|x|z|ss)es$/.test(word)) return word.slice(0, -2); // "crashes" -> "crash"
  for (const suffix of ["ing", "ed", "ly", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
  }
  return word;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem);
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function embed(text: string): Float32Array {
  const v = new Float32Array(DIM);
  const tokens = tokenize(text);
  const features = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) features.push(`${tokens[i]}_${tokens[i + 1]}`);

  for (const f of features) {
    const h = fnv1a(f);
    const sign = h & 0x80000000 ? -1 : 1;
    v[h % DIM] += sign;
  }

  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < DIM; i++) v[i] /= norm;
  return v;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already unit length
}
