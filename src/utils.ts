import bible from './bibleData';
import { BibleReference, BibleVerseResult } from './types';


export function parseVerseRange(verseStr: string): number[] {
    const result: number[] = [];
    const parts = verseStr.split(',');

    for (const part of parts) {
        const range = part.trim().split('-').map(v => parseInt(v.trim(), 10));
        if (range.length === 1) {
            result.push(range[0]);
        } else if (range.length === 2) {
            for (let i = range[0]; i <= range[1]; i++) result.push(i);
        }
    }

    return result;
}

export function getVerseText(ref: BibleReference): BibleVerseResult[] {
    const { book, chapter, verses } = ref;
    const chapterData = bible[book]?.[chapter];
    if (!chapterData) return [];

    return verses
        .map(v => ({ verse: v, text: chapterData[v.toString()] }))
        .filter(v => v.text !== undefined);
}

export function findBibleReferencesInText(text: string): string {
    const bibleReferenceRegex = /\b([1-3]?\s?[A-Za-z]+)\s(\d+):(\d+)(?:-(\d+))?\b/g;
    return text.replace(bibleReferenceRegex, (match, book, chapter, verse, endVerse) => {
        const reference = `${book} ${chapter}:${verse}${endVerse ? `-${endVerse}` : ''}`;
        return `<a href="#" class="bible-reference" data-reference="${reference}">${reference}</a>`;
    });
}
