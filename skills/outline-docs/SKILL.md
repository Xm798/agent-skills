---
name: outline-docs
description: Read, create, and update Outline documents via MCP. Use when user shares an Outline document link (a URL whose path is `/doc/<slug>-<id>`), asks to read/write Outline docs, or wants to manage documentation in Outline workspace.
---

# Outline Documents

Use Outline MCP tools for all operations on the user's Outline workspace. Outline is often self-hosted, so the domain varies: recognise a document link by its `/doc/<slug>-<id>` path and take the host from the link the user gives. The MCP server already knows which instance to talk to, so search and create work without a link.

## URL Parsing

Extract document urlId from URL: `https://<outline-host>/doc/title-slug-{documentId}`

Example: `https://outline.example.com/doc/my-doc-abc123` → urlId is `abc123`

## Operations

### Read Document

```
mcp__outline__get_document(id: "<documentId>")
```

### Search Documents

```
mcp__outline__search_documents(query: "<search term>")
```

### Create Document

When user provides a URL and wants to create a new document, the URL is the **parent document**, not the target.

1. Get parent document to find its `collectionId`
2. If no collection found, ask user which collection to use
3. Create with metadata header:

```
mcp__outline__create_document(
  title: "<title>",
  text: "---\ncreated: *YYYY-MM-DD HH:mm*\nupdated: *YYYY-MM-DD HH:mm*\n---\n\n<content>",
  collectionId: "<collectionId>",
  parentDocumentId: "<parentId>",
  publish: true
)
```

### Update Document

1. First read the document
2. Update the `updated` field in metadata, preserve `created`
3. If no metadata exists, add it

```
mcp__outline__update_document(
  documentId: "<documentId>",
  text: "---\ncreated: *<original>*\nupdated: *YYYY-MM-DD HH:mm*\n---\n\n<content>"
)
```

## Metadata Format

```markdown
---
created: *2026-02-03 20:08*
updated: *2026-02-03 20:08*
---
```

Use local time, format: `YYYY-MM-DD HH:mm`

## Decision Flow

```
User provides URL + wants to write content
    ↓
Read target document
    ↓
Has content? ─── No ──→ Update directly (add metadata)
    │
   Yes
    ↓
Ask user: "Create child doc or update existing?"
    ↓
Create child ──→ Use URL as parentDocumentId
Update ────────→ Update document, preserve created time
```
