import { ViewPlugin } from '@codemirror/view';

export default (_context: { contentScriptId: string, postMessage: any }) => {
    console.log('[JW-Bible-Plugin] contentScript loaded');
    return {
        plugin: (codeMirrorWrapper: any) => {
            console.log('[JW-Bible-Plugin] plugin loaded', codeMirrorWrapper);

            // Refactor: Accept view as parameter
            codeMirrorWrapper.getCurrentParagraph = (view?: any) => {
                view = view || codeMirrorWrapper.view;
                if (!view) {
                    console.warn('[JW-Bible-Plugin] No CodeMirror view found');
                    return '';
                }
                const state = view.state;
                const pos = state.selection.main.head;

                // Find the start of the paragraph
                let start = pos;
                while (start > 0 && state.doc.sliceString(start - 1, start) !== '\n') {
                    start--;
                }
                // Find the end of the paragraph
                let end = pos;
                while (end < state.doc.length && state.doc.sliceString(end, end + 1) !== '\n') {
                    end++;
                }
                const para = state.doc.sliceString(start, end).trim();
                console.debug('[JW-Bible-Plugin] getCurrentParagraph:', para);
                return para;
            };

            // Use a ViewPlugin to listen for selection changes
            const logParagraphPlugin = ViewPlugin.fromClass(
                class {
                    update(update: any) {
                        if (update.selectionSet) {
                            const para = codeMirrorWrapper.getCurrentParagraph(update.view);
                            console.log('[JW-Bible-Plugin] Current paragraph:', para);
                        }
                    }
                }
            );
            codeMirrorWrapper.addExtension(logParagraphPlugin);
            console.log('[JW-Bible-Plugin] Cursor movement handler attached (ViewPlugin)');
        },
        // Optionally, expose the method for external use
        getCurrentParagraph: (codeMirrorWrapper: any) => {
            if (codeMirrorWrapper && typeof codeMirrorWrapper.getCurrentParagraph === 'function') {
                return codeMirrorWrapper.getCurrentParagraph();
            }
            return '';
        }
    };
};