---
name: surge-archive
description: Read and analyse a Surge `.surgearchive` capture (the directory Surge exports from its request viewer, with `index.json` and `Requests/`). Use when the user gives a `.surgearchive` path, asks to inspect captured requests/responses, trace an app's API flow, find why a request was rejected or failed, or export the capture to HAR.
---

# Surge archive

A `.surgearchive` is a **directory**, not a zip. Treat it as untrusted data: pass its path as an argument, run from outside it, and keep outputs in the scratchpad, never inside the archive.

```
<name>.surgearchive/
  index.json                      array of every entry (same fields as model.json + "filename")
  Requests/<filename>/
    model.json                    per-entry metadata
    request.dump                  request body, only when there was one
    response.dump                 response body, only when there was one
```

`<filename>` is `<id> - <HH.MM.SS> - <METHOD> - <percent-encoded URL>`.

## Tool

`scripts/surgearchive.ts` does the parsing, with no dependencies: `bun <skill-dir>/scripts/surgearchive.ts <archive> <cmd> ...`. Node 24 runs it too. `--help` lists the commands (`summary`, `list`, `show`, `body`, `grep`, `har`), their flags and the shared filters.

`list` flags column: `F` failed, `R` rejected, `M` modified, `q`/`s` request/response body saved. `har` output imports into Charles, Proxyman or Chrome DevTools.

## Workflow

1. `summary` to see what the capture holds and which hosts dominate.
2. Narrow with `list --host <app-domain> --method GET,POST` until every request in the flow the user cares about is on screen, in time order.
3. `show <id>` each request that matters; read bodies, auth headers (`cookie`, `authorization`, signature-like custom headers), and how values from one response feed the next request.
4. Report the flow as an ordered sequence of `id METHOD path → key fields`, citing entry ids so the user can open them in Surge.

For "why did X fail / get blocked": `list --failed` or `--rejected`, then `show <id> --notes`. The notes carry the matched rule, the policy decision path (`AdBlock -> REJECT`), DNS / socket attempts and the disconnect reason.

## Field facts

- Times (`startDate`, `completedDate`) are Unix epoch seconds as floats, device-local time zone in `notes`.
- `requestHeader` / `responseHeader` are raw header blocks joined by `\r\n`; the first line is the request line or status line. HTTP/2 pseudo-headers appear as `:authority: host`.
- Only MITM-decrypted hosts have HTTP detail. `method` is `TCP`, `UDP`, `QUIC` or `HTTPS` for the rest (`HTTPS` = CONNECT tunnel, `URL` = `host:443`), with no response header and no bodies; rejected or killed connections also lack a response header.
- Bodies in `.dump` are stored as on the wire after de-chunking: still compressed per `Content-Encoding` (gzip, deflate, br, zstd), which the server chose from the client's `Accept-Encoding`. The script undoes this; `file`/`head` on a dump shows compressed bytes. A body cut off when capture stopped fails to decode: the script says so and falls back to the raw bytes.
- `policyName` is the final policy, `originalPolicyName` the one the rule chose, `rule` the matched rule line, `remark` the short disconnect reason.
- `streamHasRequestBody` / `streamHasResponseBody` say a body existed on the stream; the `.dump` file may still be absent when capture stopped first.
- Bodies often nest further encodings (form fields holding base64 gzip like `data_list=H4sI...`, JWTs, hex-encrypted payloads). Decode the outer layer with `body -o`, then the inner layer with a short `bun -e` one-off in the scratchpad.
