// This code runs in the TinyMCE editor context
function getTextNearCursor(range = 50) {
    const editor = tinymce.activeEditor;
    if (!editor) return '';

    const selection = editor.selection;
    const node = selection.getNode();
    const cursorOffset = selection.getRng().startOffset;

    let textContent = node.textContent || '';
    
    const start = Math.max(0, cursorOffset - range);
    const end = Math.min(textContent.length, cursorOffset + range);

    return textContent.substring(start, end);
}

function main() {
    return getTextNearCursor();
}

module.exports = {
    default: main,
};
