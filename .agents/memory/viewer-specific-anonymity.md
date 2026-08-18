---
name: Viewer-specific anonymity
description: Rules for showing anonymous content ownership only to the authenticated viewer
---

Anonymous ownership indicators should be derived on the server from the authenticated request and exposed as viewer-scoped booleans. Do not expose raw author IDs to regular users and ask the client to infer ownership.

**Why:** A shared anonymous number map or client-side user ID comparison makes every viewer see the same identity metadata and can reveal more than intended.

**How to apply:** For anonymous posts and comments, return fields such as `is_mine` calculated from the session user, and key client-side caches by the current user as well as the resource ID.