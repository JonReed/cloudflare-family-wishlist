# Apple Share Sheet shortcut

Family Wishlist ships `public/add-to-family-wishlist.shortcut` so an iPhone or iPad member does not
have to assemble a Shortcut by hand. Apple validates the exported file for import by anyone.

The shortcut contains no account credentials, family data or fixed deployment hostname. Its one-time
import question asks the member to paste the deployment-specific `/add?url=` address copied from the
authenticated **Add from anywhere** page. That address is stored locally in Apple Shortcuts.

## Workflow

The shortcut:

1. receives only **Safari Web Pages** and **URLs** from the Share Sheet;
2. gets URLs from the shortcut input;
3. URL-encodes the shared product link;
4. reads the deployment-specific `/add?url=` address supplied during import;
5. joins that address to the encoded product link; and
6. opens the resulting Family Wishlist draft.

The shared value is only a product URL. Authentication, product lookup, list selection and saving all
remain inside the protected Worker.

## Maintaining the file

The source of truth for behaviour is the workflow above and the matching manual recipe in
`app/routes/bookmarklet.tsx`. If the shortcut needs to change:

1. rebuild it in Apple Shortcuts using the documented workflow;
2. keep **Show in Share Sheet** enabled and limit its input to **Safari Web Pages** and **URLs**;
3. attach the import question to the deployment address only, not to the assembled product URL;
4. export it **For: Anyone**, allowing Apple to validate the copy;
5. replace `public/add-to-family-wishlist.shortcut` and test a fresh import on a current iPhone or
   iPad; and
6. update the checksum below.

Current SHA-256:

```text
a2affffd11be10c518fd19766313e23e609ce3e742c1f967d218e3d2970723c3
```

Apple's supported `shortcuts://create-shortcut` URL opens an empty editor; it cannot supply actions.
The validated file and import question are therefore the smallest supported setup journey. Safari on
iOS does not currently register a web app manifest `share_target`, so the Android install route
cannot replace this shortcut.

## Instruction review

Last checked against the current product documentation on **1 September 2026**:

- [Apple: create a shortcut with a URL scheme](https://support.apple.com/en-gb/guide/shortcuts/apda283236d7/ios)
- [Apple: launch a shortcut from another app](https://support.apple.com/en-gb/guide/shortcuts/apd163eb9f95/ios)
- [Apple: limit Share Sheet input](https://support.apple.com/guide/shortcuts/limit-the-input-for-a-shortcut-apd8195f96d6/ios/26)
- [Apple: share shortcuts and validated files](https://support.apple.com/en-asia/guide/shortcuts/apdf01f8c054/ios)
- [Apple: add import questions](https://support.apple.com/guide/shortcuts/add-import-questions-to-shared-shortcuts-apdf330fd3a0/ios)
- [WebKit: Web Share Target support request](https://bugs.webkit.org/show_bug.cgi?id=194593)
- [Google: install an Android web app](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en)
- [Apple: show Safari's Favourites bar](https://support.apple.com/en-gb/guide/safari/ibrw1012/mac)
- [Microsoft: Edge keyboard shortcuts](https://support.microsoft.com/en-US/edge/keyboard-shortcuts-in-microsoft-edge)
- [Mozilla: show Firefox's Bookmarks Toolbar](https://support.mozilla.org/en-US/kb/bookmarks-toolbar-display-favorite-websites)
