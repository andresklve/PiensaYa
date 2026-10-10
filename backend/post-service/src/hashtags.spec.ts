import { MAX_TAGS_PER_POST, extractTags, normalizeQuery, normalizeTag } from './hashtags';

describe('hashtags', () => {
  it('normaliza mayúsculas y tildes al mismo tema', () => {
    expect(normalizeTag('Cálculo2')).toBe('calculo2');
    expect(normalizeTag('CALCULO2')).toBe('calculo2');
    expect(normalizeTag('Señales')).toBe('senales');
  });

  it('extrae hashtags del final y del medio del texto, sin duplicados', () => {
    expect(extractTags('La regla de la cadena #Cálculo2 y #calculo2 otra vez, #fisica_1.')).toEqual([
      'calculo2',
      'fisica_1',
    ]);
  });

  it('incluye los del título', () => {
    expect(extractTags('Repaso #parcial', 'texto #calculo2')).toEqual(['parcial', 'calculo2']);
  });

  it('ignora # que no son hashtags (anclas, correos, sueltos o muy cortos)', () => {
    expect(extractTags('ver https://x.com/a#seccion, mail a#b, # solo, #a')).toEqual([]);
  });

  it(`guarda como máximo ${MAX_TAGS_PER_POST} hashtags`, () => {
    const text = Array.from({ length: 15 }, (_, i) => `#tema${i}`).join(' ');
    expect(extractTags(text)).toHaveLength(MAX_TAGS_PER_POST);
  });

  it('normaliza lo que se escribe en el buscador', () => {
    expect(normalizeQuery('#Cálculo')).toBe('calculo');
    expect(normalizeQuery('  calculo 2 ')).toBe('calculo2');
  });
});
