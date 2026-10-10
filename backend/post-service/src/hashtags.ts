// Hashtags: se extraen del texto al publicar y se guardan normalizados en el
// post (campo `tags`). Normalizar (minúsculas, sin tildes) hace que #Cálculo2,
// #calculo2 y #CALCULO2 sean el mismo tema, y que buscar "calculo" lo encuentre.

export const MAX_TAGS_PER_POST = 10;
const TAG_MIN = 2;
const TAG_MAX = 40;

// # seguido de letras (con tildes/ñ), números o guion bajo; no después de una
// letra/número (así "a#b" o un ancla de URL no cuentan como hashtag).
const HASHTAG_RE = /(^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]+)/gu;

export function normalizeTag(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

export function extractTags(...texts: (string | undefined)[]): string[] {
  const tags = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(HASHTAG_RE)) {
      const tag = normalizeTag(match[2]);
      if (tag.length >= TAG_MIN && tag.length <= TAG_MAX) tags.add(tag);
      if (tags.size >= MAX_TAGS_PER_POST) return [...tags];
    }
  }
  return [...tags];
}

// Normaliza lo que escribe alguien en el buscador ("#Cálculo", "calculo 2"…).
export function normalizeQuery(q: string): string {
  return normalizeTag(q.trim().replace(/^#/, '').replace(/\s+/g, ''));
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
