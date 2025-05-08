import { getVerseText, formatNumber } from "./utils";

export function generateBibleReferencesHtml(references: any[]) {
  const itemHtml = [];
  itemHtml.push(`<div class="cards-container">`);

  for (const ref of references) {
    const verseTexts = getVerseText(ref);
    const url = `https://www.jw.org/finder?srcid=jwlshare&wtlocale=E&prefer=lang&bible=${formatNumber(
      ref.bookNumber ?? 0,
      2
    )}${formatNumber(ref.chapter, 3)}${formatNumber(
      ref.verses[0],
      3
    )}-${formatNumber(ref.bookNumber ?? 0, 2)}${formatNumber(
      ref.chapter,
      3
    )}${formatNumber(ref.verses.reverse()[0], 3)}&pub=nwtsty`;

    itemHtml.push(`
        <div class="card">
            <div class="card-header">
                <span class="scripture-title">${ref.book} ${ref.chapter}:${ref.verseStr}</span>
                <span class="icon share-icon" data-url="${url}" title="Share"></span>
            </div>
            <div class="card-body">
        `);

    let priorVerse = 0;
    for (const v of verseTexts) {
      if (
        v.text.startsWith("\r\n") &&
        priorVerse + 1 != v.verse &&
        priorVerse != 0
      ) {
        itemHtml.push(`
                </p><br/><p><span class="versespan"><b>${v.verse}</b> ${v.text.slice(2).replace("\r\n",'<br/>').trim()} </span>
                `);
      } else if (v.text.startsWith("\r\n") && priorVerse > 0) {
        itemHtml.push(`
                </p><p><span class="versespan"><b>${v.verse}</b> ${v.text.slice(2).replace("\r\n",'<br/>').trim()} </span>
                `);
      } else if (v.text.startsWith("\r\n") && priorVerse == 0) {
        itemHtml.push(`
                <p><span class="versespan"><b>${v.verse}</b> ${v.text.slice(2).replace("\r\n",'<br/>').trim()} </span>
                `);
      } else if (!v.text.startsWith("\r\n") && priorVerse == 0) {
        itemHtml.push(`
                <span class="versespan"><b>${v.verse}</b> ${v.text.replace("\r\n",'<br/>').trim()} </span>
                `);
      } else if (
        !v.text.startsWith("\r\n") &&
        priorVerse + 1 != v.verse &&
        priorVerse != 0
      ) {
        itemHtml.push(`
                <span class="versespan"><b>${v.verse}</b> ${v.text.replace("\r\n",'<br/>').trim()} </span>
                `);
      } else {
        itemHtml.push(`
                <span class="versespan"><b>${v.verse}</b> ${v.text.replace("\r\n",'<br/>').trim()} </span>
                `);
      }
      priorVerse = v.verse;
    }

    itemHtml.push(`</p>`);


    itemHtml.push(`
            </div>
            <div class="card-footer">
                <span class="icon insert-icon" data-book="${ref.book}" data-chapter="${ref.chapter}" data-verses="${ref.verses.join(",")}" title="Insert Text"></span>
            </div>
        </div>
        `);
  }
  itemHtml.push(`</div>`);

  console.log(itemHtml.join("\n"));

  return `
  <div class="container">
    <div class="scrollable-body">
      ${itemHtml.join("\n")}
    </div>
  </div>
`;
}
