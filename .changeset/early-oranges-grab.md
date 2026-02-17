---
'@irvinebroque/http-rfc-utils': patch
---

Cache the OpenCode CLI binary in both issue-triggered workflows to avoid repeated installs and speed up subsequent automation and debug runs, and upload debug artifacts from the `tool-output` directory used by OpenCode in GitHub runners.
