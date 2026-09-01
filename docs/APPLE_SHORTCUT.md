# Apple Share Sheet shortcut

Family Wishlist ships `public/Wishlist.shortcut` so an iPhone or iPad member does not
have to assemble a Shortcut by hand. Apple validates the exported file for import by anyone.

The shortcut contains no account credentials, family data or fixed deployment hostname. Its one-time
import question asks the member to paste the deployment-specific `/add?url=` address copied from the
authenticated **Add from anywhere** page. That address is stored locally in Apple Shortcuts. Its
default Share Sheet name is the intentionally compact **Wishlist**.

## Workflow

The shortcut:

1. receives only **Safari Web Pages** and **URLs** from the Share Sheet;
2. gets URLs from an explicitly selected **Shortcut Input** variable;
3. URL-encodes the shared product link;
4. places the deployment-specific `/add?url=` address supplied during import into a plain **Text**
   action;
5. joins that Text output and the **URL Encoded Text** output in a second **Text** action; and
6. opens the resulting Family Wishlist draft.

The shared value is only a product URL. Authentication, product lookup, list selection and saving all
remain inside the protected Worker.

## Maintaining the file

The source of truth for behaviour is the workflow above and the matching manual recipe in
`app/routes/bookmarklet.tsx`. If the shortcut needs to change:

1. rebuild it in Apple Shortcuts using the documented workflow;
2. keep **Show in Share Sheet** enabled and limit its input to **Safari Web Pages** and **URLs**;
3. explicitly replace the first action's generic **Input** token with **Shortcut Input**; automatic
   input inference is not preserved reliably in an exported shortcut;
4. attach the import question only to the first **Text** action containing the deployment address;
5. use a second **Text** action to join the first **Text** output to **URL Encoded Text**—putting the
   question and variables in one action lets the imported answer erase the shared product URL;
6. export it **For: Anyone**, allowing Apple to validate the copy;
7. replace `public/Wishlist.shortcut` and test a fresh import on a current iPhone or
   iPad; and
8. update the checksum below and the short checksum in the download link's `?v=` query string so
   existing members cannot receive a browser-cached copy.

Current SHA-256:

```text
83dbc204f0a311cd08f815c7ed23a02437f6de596740d2e1a9b1bb845e899400
```

Apple's supported `shortcuts://create-shortcut` URL opens an empty editor; it cannot supply actions.
The validated file and import question are therefore the smallest supported setup journey. Safari on
iOS does not currently register a web app manifest `share_target`, so the Android install route
cannot replace this shortcut.

The exported shortcut uses Apple's built-in **Gift** glyph on its muted **Grey Green** background. Share Sheet
Favourites and their order are device-local preferences and cannot be preset in a shared shortcut;
the member can add **Wishlist** to Favourites once through **Edit Actions**.

## Installation and updates

An exported shortcut is a new installation, not an in-place update. Before installing a replacement,
the member must delete the existing **Wishlist** shortcut. After tapping the download link, they must
open the file only once: continue in Shortcuts if it opens automatically, or use Safari's Downloads
button only when nothing opened. Opening the Downloads copy after Shortcuts has already handled the
download creates a duplicate.

## Instruction review

Last checked against the current product documentation on **1 September 2026**:

- [Apple: create a shortcut with a URL scheme](https://support.apple.com/en-gb/guide/shortcuts/apda283236d7/ios)
- [Apple: launch a shortcut from another app](https://support.apple.com/en-gb/guide/shortcuts/apd163eb9f95/ios)
- [Apple: limit Share Sheet input](https://support.apple.com/guide/shortcuts/limit-the-input-for-a-shortcut-apd8195f96d6/ios/26)
- [Apple: share shortcuts and validated files](https://support.apple.com/en-asia/guide/shortcuts/apdf01f8c054/ios)
- [Apple: add import questions](https://support.apple.com/guide/shortcuts/add-import-questions-to-shared-shortcuts-apdf330fd3a0/ios)
- [Apple: modify shortcut colours and icons](https://support.apple.com/en-gb/guide/shortcuts/apd5ad5a2128/ios)
- [WebKit: Web Share Target support request](https://bugs.webkit.org/show_bug.cgi?id=194593)
- [Google: install an Android web app](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en)
- [Apple: show Safari's Favourites bar](https://support.apple.com/en-gb/guide/safari/ibrw1012/mac)
- [Microsoft: Edge keyboard shortcuts](https://support.microsoft.com/en-US/edge/keyboard-shortcuts-in-microsoft-edge)
- [Mozilla: show Firefox's Bookmarks Toolbar](https://support.mozilla.org/en-US/kb/bookmarks-toolbar-display-favorite-websites)
