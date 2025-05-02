export interface BibleReference {
    raw: string;
    book: string;
    bookNumber: number | null;
    chapter: number;
    verses: number[];
    verseStr: string;
    index?: number;  // <-- Add this line
}
export interface BibleVerseResult {
    verse: number;
    text: string;
}

export interface BibleJSON {
	[book: string]: {
		[chapter: string]: {
			[verse: string]: string;
		};
	};
}
