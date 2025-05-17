import { getVerseText, formatNumber } from "./utils";

export function generateBibleReferencesHtml(references: any[]) {
  const itemHtml = [];
  itemHtml.push(`<div class="cards-container">`);
  console.log("references:", references);

  for (const ref of references) {
    console.log("ref:", ref);
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

    ref.verses.reverse(); //Return to original order
    
    itemHtml.push(`
        <div class="card">
            <div class="card-header">
                <div class="left-section">
                    <span class="bible-icon" title="Bible Icon"></span>
                    <span class="scripture-title">${ref.book} ${ref.chapter}:${ref.verseStr}</span>
                </div>
                <div class="right-section">
                    <a href="${url}" target="_blank" class="icon share-icon" title="Open in JW Library"></a>
                    <span class="icon insert-icon" data-book="${ref.book}" data-chapter="${ref.chapter}" data-verses="${ref.verses.join(",")}" title="Insert text to note"></span>
                </div>
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
                </p><br/><p><span class="versespan"><b>${v.verse}</b> ${v.text.slice(2).replace(/\r\n/g, '<br/>').trim()} </span>
                `);
      } else if (v.text.startsWith("\r\n") && priorVerse > 0) {
        itemHtml.push(`
                </p><p><span class="versespan"><b>${v.verse}</b> ${v.text.slice(2).replace(/\r\n/g, '<br/>').trim()} </span>
                `);
      } else if (v.text.startsWith("\r\n") && priorVerse == 0) {
        itemHtml.push(`
                <p><span class="versespan"><b>${v.verse}</b> ${v.text.slice(2).replace(/\r\n/g, '<br/>').trim()} </span>
                `);
      } else if (!v.text.startsWith("\r\n") && priorVerse == 0) {
        itemHtml.push(`
                <p><span class="versespan"><b>${v.verse}</b> ${v.text.replace(/\r\n/g, '<br/>').trim()} </span>
                `);
      } else if (
        !v.text.startsWith("\r\n") &&
        priorVerse + 1 != v.verse &&
        priorVerse != 0
      ) {
        itemHtml.push(`
                </p><br/><p><span class="versespan"><b>${v.verse}</b> ${v.text.replace(/\r\n/g, '<br/>').trim()} </span>
                `);
      } else {
        itemHtml.push(`
                <span class="versespan"><b>${v.verse}</b> ${v.text.replace(/\r\n/g, '<br/>').trim()} </span>
                `);
      }
      priorVerse = v.verse;
    }

    itemHtml.push(`</p>`);


    itemHtml.push(`
            </div>
        </div>
        `);
  }
  itemHtml.push(`</div>`);

  return `
  <div class="container">
    <div class="scrollable-body">
      ${itemHtml.join("\n")}
    </div>
  </div>
`;
}
