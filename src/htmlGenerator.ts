import { getVerseText, formatNumber } from "./utils";

function replaceNewlines(text: string) {
  return text.replace(/\r\n/g, '<br/>').trim();
}

export function generateBibleReferencesHtml(references: any[]) {
  const itemHtml: string[] = [];
  itemHtml.push(`<div class="cards-container">`);

  for (const ref of references) {
    const verseTexts = getVerseText(ref);

    // Avoid mutating ref.verses by using a temporary reversed array
    const reversedVerses = [...ref.verses].reverse();
    const url = `https://www.jw.org/finder?srcid=jwlshare&wtlocale=E&prefer=lang&bible=${formatNumber(
      ref.bookNumber ?? 0, 2
    )}${formatNumber(ref.chapter, 3)}${formatNumber(
      ref.verses[0], 3
    )}-${formatNumber(ref.bookNumber ?? 0, 2)}${formatNumber(
      ref.chapter, 3
    )}${formatNumber(reversedVerses[0], 3)}&pub=nwtsty`;

    itemHtml.push([
      `<div class="card">`,
      `  <div class="card-header">`,
      `    <div class="left-section">`,
      `      <span class="bible-icon" title="Bible Icon"></span>`,
      `      <span class="scripture-title">${ref.book} ${ref.chapter}:${ref.verseStr}</span>`,
      `    </div>`,
      `    <div class="right-section">`,
      `      <a href="${url}" target="_blank" class="icon share-icon" title="Open in JW Library"></a>`,
      `      <span class="icon insert-icon" data-book="${ref.book}" data-chapter="${ref.chapter}" data-verses="${ref.verses.join(",")}" title="Insert text to note"></span>`,
      `    </div>`,
      `  </div>`,
      `  <div class="card-body">`
    ].join('\n'));

    let priorVerse = 0;
    for (const v of verseTexts) {
      const verseHtml = `<span class="versespan"><b>${v.verse}</b> ${replaceNewlines(v.text.startsWith("\r\n") ? v.text.slice(2) : v.text)} </span>`;
      if (v.text.startsWith("\r\n") && priorVerse + 1 != v.verse && priorVerse != 0) {
        itemHtml.push(`</p><br/><p>${verseHtml}`);
      } else if (v.text.startsWith("\r\n") && priorVerse > 0) {
        itemHtml.push(`</p><p>${verseHtml}`);
      } else if (v.text.startsWith("\r\n") && priorVerse == 0) {
        itemHtml.push(`<p>${verseHtml}`);
      } else if (!v.text.startsWith("\r\n") && priorVerse == 0) {
        itemHtml.push(`<p>${verseHtml}`);
      } else if (!v.text.startsWith("\r\n") && priorVerse + 1 != v.verse && priorVerse != 0) {
        itemHtml.push(`</p><br/><p>${verseHtml}`);
      } else {
        itemHtml.push(verseHtml);
      }
      priorVerse = v.verse;
    }

    itemHtml.push(`</p>`);
    itemHtml.push([
      `  </div>`,
      `</div>`
    ].join('\n'));
  }
  itemHtml.push(`</div>`);

  return [
    `<div class="container">`,
    `  <div class="scrollable-body">`,
    itemHtml.join("\n"),
    `  </div>`,
    `</div>`
  ].join('\n');
}
