#!/usr/bin/env bun
// Read and analyse a Surge .surgearchive capture (a directory exported from Surge's request viewer).

import { closeSync, existsSync, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import zlib from "node:zlib";

type Entry = Record<string, any>;
type Side = "request" | "response";
type Opts = Record<string, any>;

const USAGE = `usage: surgearchive.ts <archive> <cmd> [args] [options]

commands
  summary              counts by method/status/policy/rule/host/remark   [--top N] [filters]
  list                 one TSV line per entry, in start order            [--limit N] [filters]
  show <id>            metadata, headers, decoded bodies                 [--notes] [--max N, 0 = all]
  body <id>            decoded body to stdout or file                    [--request] [--raw] [-o file]
  grep <regex>         search URL, headers, decoded bodies               [--notes] [filters]
  har -o <file>        export HTTP entries as HAR 1.2                    [filters]

filters (regex unless noted)
  --host --url --policy --rule   --method GET,POST (list)   --status 4 (prefix)
  --failed --rejected --has-body (flags)`;

const die = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const FILTERS = {
  host: { type: "string" },
  url: { type: "string" },
  method: { type: "string" },
  policy: { type: "string" },
  rule: { type: "string" },
  status: { type: "string" },
  failed: { type: "boolean" },
  rejected: { type: "boolean" },
  "has-body": { type: "boolean" },
} as const;

function load(archive: string): Entry[] {
  const index = join(archive, "index.json");
  if (!existsSync(index)) die(`not a surgearchive: ${index} missing`);
  const entries: Entry[] = JSON.parse(readFileSync(index, "utf8"));
  return entries.sort((a, b) => (a.startDate ?? 0) - (b.startDate ?? 0));
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function ts(epoch?: number): string {
  if (!epoch) return "-";
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function dateTime(epoch: number): string {
  const d = new Date(epoch * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${ts(epoch)}`;
}

type Parsed = [string, [string, string][]];
// Commands look up several fields per entry; each header block is parsed once.
const parsedHeaders = new Map<string, Parsed>();

function parseHeaders(raw = ""): Parsed {
  let parsed = parsedHeaders.get(raw);
  if (!parsed) parsedHeaders.set(raw, (parsed = splitHeaders(raw)));
  return parsed;
}

function splitHeaders(raw: string): Parsed {
  const lines = raw.split(/\r?\n/);
  const headers: [string, string][] = [];
  for (const line of lines.slice(1)) {
    if (!line) continue;
    // HTTP/2 pseudo-headers keep their leading colon: ":authority: host".
    const at = line.indexOf(":", line.startsWith(":") ? 1 : 0);
    if (at < 0) continue;
    headers.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
  }
  return [lines[0] ?? "", headers];
}

function header(raw: string | undefined, name: string): string {
  const n = name.toLowerCase();
  return parseHeaders(raw)[1].find(([k]) => k.toLowerCase() === n)?.[1] ?? "";
}

const statusCode = (e: Entry) => /^HTTP\/\S+\s+(\d{3})/.exec(parseHeaders(e.responseHeader)[0])?.[1] ?? "";

function host(e: Entry): string {
  if (e.remoteHost) return e.remoteHost;
  const url: string = e.URL ?? "";
  if (url.includes("://")) {
    try {
      return new URL(url).hostname;
    } catch {}
  }
  return url.replace(/:\d+$/, "");
}

const bodyPath = (root: string, e: Entry, side: Side) => join(root, "Requests", e.filename ?? "", `${side}.dump`);
const headerOf = (e: Entry, side: Side): string | undefined => (side === "request" ? e.requestHeader : e.responseHeader);
const SIDES: Side[] = ["request", "response"];

// Surge stores bodies exactly as they crossed the wire, so Content-Encoding still applies.
function decodeBody(data: Buffer, encoding: string): Buffer {
  const layers = encoding.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).reverse();
  for (const enc of layers) {
    if (enc === "gzip" || enc === "x-gzip") data = zlib.gunzipSync(data);
    else if (enc === "deflate") {
      try {
        data = zlib.inflateSync(data);
      } catch {
        data = zlib.inflateRawSync(data);
      }
    } else if (enc === "br") data = zlib.brotliDecompressSync(data);
    else if (enc === "zstd") data = zlib.zstdDecompressSync(data);
    else if (enc !== "identity") throw new Error(`unsupported Content-Encoding: ${enc}`);
  }
  return data;
}

function readBody(root: string, e: Entry, side: Side, raw = false): { data: Buffer | null; err?: string } {
  let data: Buffer;
  try {
    data = readFileSync(bodyPath(root, e, side));
  } catch {
    return { data: null };
  }
  if (raw) return { data };
  try {
    return { data: decodeBody(data, header(headerOf(e, side), "content-encoding")) };
  } catch (err) {
    return { data, err: String((err as Error).message ?? err) };
  }
}

const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

function utf8(data: Buffer): string | null {
  try {
    return strictUtf8.decode(data);
  } catch {
    return null;
  }
}

function renderBody(data: Buffer | null, limit: number): string {
  if (data === null) return "(no body)";
  if (!data.length) return "(empty)";
  let text = utf8(data);
  if (text === null) {
    const n = limit ? Math.min(limit, data.length) : data.length;
    return `(binary, ${data.length} bytes; base64 of first ${n} bytes)\n${data.subarray(0, n).toString("base64")}`;
  }
  try {
    text = JSON.stringify(JSON.parse(text), null, 2);
  } catch {}
  if (limit && text.length > limit) {
    text = `${text.slice(0, limit)}\n... (truncated, ${text.length} chars total; use --max 0 or \`body\`)`;
  }
  return text;
}

function matcher(o: Opts): (e: Entry) => boolean {
  const re = (s?: string) => (s ? new RegExp(s, "i") : null);
  const [h, u, p, r] = [re(o.host), re(o.url), re(o.policy), re(o.rule)];
  const methods = o.method ? new Set(String(o.method).toUpperCase().split(",")) : null;
  return (e) =>
    (!h || h.test(host(e))) &&
    (!u || u.test(e.URL ?? "")) &&
    (!methods || methods.has(String(e.method ?? "").toUpperCase())) &&
    (!p || p.test(e.policyName ?? "")) &&
    (!r || r.test(e.rule ?? "")) &&
    (!o.status || statusCode(e).startsWith(o.status)) &&
    (!o.failed || !!e.failed) &&
    (!o.rejected || !!e.rejected) &&
    (!o["has-body"] || !!(e.streamHasRequestBody || e.streamHasResponseBody));
}

function find(entries: Entry[], id: string): Entry {
  return entries.find((e) => String(e.id) === id) ?? die(`no entry with id ${id}`);
}

function summary(root: string, entries: Entry[], o: Opts) {
  const sel = entries.filter(matcher(o));
  if (!sel.length) return console.log("no matching entries");
  const starts = sel.map((e) => e.startDate).filter(Boolean);
  const sum = (k: string) => sel.reduce((n, e) => n + (e[k] ?? 0), 0).toLocaleString("en-US");
  const count = (k: string) => sel.filter((e) => e[k]).length;
  console.log(`archive   ${root}`);
  console.log(`entries   ${sel.length} (of ${entries.length})`);
  console.log(`devices   ${[...new Set(sel.map((e) => e.deviceName ?? "-"))].sort().join(", ")}`);
  console.log(`time      ${dateTime(Math.min(...starts))} → ${dateTime(Math.max(...starts))}`);
  console.log(`bytes     out ${sum("outBytes")}  in ${sum("inBytes")}`);
  console.log(`failed    ${count("failed")}  rejected ${count("rejected")}  modified ${count("modified")}`);
  const top = Number(o.top ?? 15);
  const table = (title: string, key: (e: Entry) => string | undefined) => {
    const c = new Map<string, number>();
    for (const e of sel) {
      const k = key(e) || "-";
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    console.log(`\n## ${title}`);
    for (const [k, v] of [...c].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`${String(v).padStart(6)}  ${k}`);
  };
  table("method", (e) => e.method);
  table("status", statusCode);
  table("policy", (e) => e.policyName);
  table("rule", (e) => e.rule);
  table("host", host);
  table("remark", (e) => e.remark);
}

function list(root: string, entries: Entry[], o: Opts) {
  const sel = entries.filter(matcher(o)).slice(0, Number(o.limit) || undefined);
  console.log("id\ttime\tmethod\tstatus\tpolicy\tflags\tout/in\turl");
  for (const e of sel) {
    let flags = (e.failed ? "F" : "") + (e.rejected ? "R" : "") + (e.modified ? "M" : "");
    flags += (existsSync(bodyPath(root, e, "request")) ? "q" : "") + (existsSync(bodyPath(root, e, "response")) ? "s" : "");
    console.log(
      [e.id, ts(e.startDate), e.method, statusCode(e) || "-", e.policyName || "-", flags || "-",
        `${e.outBytes ?? 0}/${e.inBytes ?? 0}`, e.URL].join("\t"),
    );
  }
}

function show(root: string, entries: Entry[], o: Opts, id: string) {
  const e = find(entries, id);
  const limit = Number(o.max ?? 4000);
  console.log(`# ${e.id} ${e.method} ${e.URL}`);
  console.log(`start ${ts(e.startDate)}  done ${ts(e.completedDate)}  device ${e.deviceName}`);
  console.log(`policy ${e.policyName} (original ${e.originalPolicyName})  rule ${e.rule}`);
  console.log(`remote ${e.remoteAddress || "-"}  local ${e.localAddress || "-"}  interface ${e.interface || "-"}`);
  console.log(`failed ${!!e.failed}  rejected ${!!e.rejected}  modified ${!!e.modified}  remark ${e.remark || "-"}`);
  if (e.timingRecords?.length) {
    console.log(`timing ${e.timingRecords.map((t: Entry) => `${t.name} ${t.durationInMillisecond ?? 0}ms`).join(", ")}`);
  }
  if (o.notes) console.log(`\n## notes\n${(e.notes ?? []).join("\n")}`);
  for (const side of SIDES) {
    console.log(`\n## ${side} header\n${(headerOf(e, side) ?? "(none)").replace(/\r\n/g, "\n").trimEnd()}`);
    const { data, err } = readBody(root, e, side);
    console.log(`\n## ${side} body${err ? `  [decode failed: ${err}; showing raw]` : ""}`);
    console.log(renderBody(data, limit));
  }
}

function body(root: string, entries: Entry[], o: Opts, id: string) {
  const side: Side = o.request ? "request" : "response";
  const { data, err } = readBody(root, find(entries, id), side, o.raw);
  if (data === null) return die(`entry ${id} has no ${side} body`);
  if (err) console.error(`decode failed: ${err}; writing raw bytes`);
  if (o.output) {
    writeFileSync(o.output, data);
    console.error(`wrote ${data.length} bytes to ${o.output}`);
  } else process.stdout.write(data);
}

function grep(root: string, entries: Entry[], o: Opts, pattern: string) {
  const pat = new RegExp(pattern, "i");
  for (const e of entries.filter(matcher(o))) {
    const hits: string[] = [];
    if (pat.test(e.URL ?? "")) hits.push("url");
    for (const side of SIDES) {
      if (pat.test(headerOf(e, side) ?? "")) hits.push(`${side}-header`);
      const { data, err } = readBody(root, e, side);
      if (!data?.length) continue;
      // latin1 keeps ASCII tokens inside binary payloads searchable.
      const text = utf8(data) ?? data.toString("latin1");
      const m = pat.exec(text);
      if (m) {
        const s = Math.max(m.index - 60, 0);
        const tag = err ? `${side}-body (raw, decode failed)` : `${side}-body`;
        hits.push(`${tag}: …${JSON.stringify(text.slice(s, m.index + m[0].length + 60))}…`);
      }
    }
    if (o.notes && pat.test((e.notes ?? []).join("\n"))) hits.push("notes");
    if (hits.length) console.log(`${e.id}\t${e.method}\t${e.URL}\n${hits.map((h) => `\t${h}`).join("\n")}`);
  }
}

function har(root: string, entries: Entry[], o: Opts) {
  if (!o.output) die("har needs -o <file>");
  const content = (data: Buffer | null, hdr?: string) => {
    const mimeType = header(hdr, "content-type");
    if (data === null) return { size: 0, mimeType };
    const text = utf8(data);
    return text === null
      ? { size: data.length, mimeType, text: data.toString("base64"), encoding: "base64" }
      : { size: data.length, mimeType, text };
  };
  const pairs = (h: [string, string][]) => h.map(([name, value]) => ({ name, value }));
  const bodyOf = (e: Entry, side: Side) => {
    const { data, err } = readBody(root, e, side);
    if (err) console.error(`entry ${e.id} ${side}: ${err}; exporting raw bytes`);
    return data;
  };
  // Entries are written one at a time so memory peaks at the largest single body, not the whole archive.
  const fd = openSync(o.output, "w");
  writeSync(fd, `{"log":{"version":"1.2","creator":{"name":"surgearchive.ts","version":"1"},"entries":[`);
  let n = 0;
  for (const e of entries.filter(matcher(o))) {
    if (!String(e.URL ?? "").includes("://")) continue;
    const [rqFirst, rqH] = parseHeaders(e.requestHeader);
    const [rsFirst, rsH] = parseHeaders(e.responseHeader);
    const rq = bodyOf(e, "request");
    const rs = bodyOf(e, "response");
    const start = e.startDate ?? 0;
    const ms = Math.max((e.completedDate ?? 0) - start, 0) * 1000;
    const entry = {
      startedDateTime: new Date(start * 1000).toISOString(),
      time: ms,
      request: {
        method: e.method, url: e.URL, httpVersion: rqFirst.split(" ").at(-1) ?? "",
        headers: pairs(rqH), queryString: [], cookies: [], headersSize: -1, bodySize: rq?.length ?? 0,
        ...(rq && { postData: content(rq, e.requestHeader) }),
      },
      response: {
        status: Number(statusCode(e) || 0), statusText: "", httpVersion: rsFirst.split(" ")[0] ?? "",
        headers: pairs(rsH), cookies: [], content: content(rs, e.responseHeader),
        redirectURL: "", headersSize: -1, bodySize: rs?.length ?? 0,
      },
      cache: {},
      timings: { send: 0, wait: ms, receive: 0 },
      serverIPAddress: e.remoteAddress ?? "",
      comment: `surge id ${e.id} policy ${e.policyName} rule ${e.rule}`,
    };
    writeSync(fd, (n++ ? ",\n" : "\n") + JSON.stringify(entry));
  }
  writeSync(fd, "\n]}}\n");
  closeSync(fd);
  console.error(`wrote ${n} entries to ${o.output}`);
}

type Option = { type: "string" | "boolean"; short?: string };
type Command = { options: Record<string, Option>; arg?: string; run: (root: string, entries: Entry[], o: Opts, arg: string) => void };

const COMMANDS: Record<string, Command> = {
  summary: { options: { ...FILTERS, top: { type: "string" } }, run: summary },
  list: { options: { ...FILTERS, limit: { type: "string" } }, run: list },
  show: { options: { notes: { type: "boolean" }, max: { type: "string" } }, arg: "id", run: show },
  body: {
    options: { request: { type: "boolean" }, raw: { type: "boolean" }, output: { type: "string", short: "o" } },
    arg: "id",
    run: body,
  },
  grep: { options: { ...FILTERS, notes: { type: "boolean" } }, arg: "regex", run: grep },
  har: { options: { ...FILTERS, output: { type: "string", short: "o" } }, run: har },
};

function main() {
  const argv = process.argv.slice(2);
  const help = argv.includes("-h") || argv.includes("--help");
  if (help || argv.length < 2) {
    console.log(USAGE);
    process.exit(help ? 0 : 1);
  }
  const [archive, name, ...rest] = argv;
  const cmd = COMMANDS[name] ?? die(`unknown command: ${name}\n\n${USAGE}`);
  let o: Opts, pos: string[];
  try {
    ({ values: o, positionals: pos } = parseArgs({ args: rest, options: cmd.options, allowPositionals: true }));
  } catch (err) {
    return die(`${(err as Error).message}\n\n${USAGE}`);
  }
  if (cmd.arg && !pos[0]) die(`${name} needs <${cmd.arg}>\n\n${USAGE}`);
  cmd.run(archive, load(archive), o, pos[0]);
}

main();
