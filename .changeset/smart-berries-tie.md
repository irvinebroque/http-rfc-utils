---
'@irvinebroque/http-rfc-utils': patch
---

Fix Changesets changelog loading in CI by importing `@changesets/changelog-github` from its default export so release PR/version steps can resolve changelog functions.
