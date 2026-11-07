// Minimal in-memory Google Sheets API for local testing (no Google account needed).
// Usage: node scripts/mock-sheets.mjs path/to/seed.json [port]
// Then run the app with GOOGLE_SHEETS_API_BASE=http://localhost:4010 GOOGLE_SHEET_ID=mock
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const [, , seedPath, portArg] = process.argv;
const tabs = JSON.parse(readFileSync(seedPath, "utf8")); // { title: [[header], [row], ...] }
const titles = Object.keys(tabs);
const port = Number(portArg ?? 4010);

const unquote = (t) => (t.startsWith("'") ? t.slice(1, -1).replaceAll("''", "'") : t);
const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function parseRange(range) {
  const bang = range.lastIndexOf("!");
  const title = unquote(range.slice(0, bang));
  const ref = range.slice(bang + 1);
  if (!tabs[title]) throw new Error(`no tab ${title}`);
  return { title, ref };
}

function read(range) {
  const { title, ref } = parseRange(range);
  const grid = tabs[title];
  let m;
  if ((m = ref.match(/^(\d+):(\d+)$/))) return grid.slice(+m[1] - 1, +m[2]);
  if ((m = ref.match(/^([A-Z]+):([A-Z]+)$/))) {
    const a = colIndex(m[1]), b = colIndex(m[2]);
    return grid.map((r) => r.slice(a, b + 1));
  }
  if ((m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)$/))) {
    const a = colIndex(m[1]), b = colIndex(m[3]);
    return grid.slice(+m[2] - 1).map((r) => r.slice(a, b + 1));
  }
  throw new Error(`unsupported range ${range}`);
}

const send = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const body = req.method === "GET" ? null : JSON.parse(await new Promise((r) => {
      let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => r(s || "{}"));
    }));
    const path = decodeURIComponent(url.pathname).replace(/^\/v4\/spreadsheets\/[^/]+/, "");
    if (req.method === "GET" && path === "") {
      return send(res, 200, { sheets: titles.map((t, i) => ({ properties: { sheetId: 1000 + i, title: t } })) });
    }
    if (req.method === "GET" && path === "/values:batchGet") {
      return send(res, 200, { valueRanges: url.searchParams.getAll("ranges").map((r) => ({ range: r, values: read(r) })) });
    }
    if (req.method === "POST" && path.endsWith(":append")) {
      const { title } = parseRange(path.slice("/values/".length, -":append".length));
      tabs[title].push(...body.values);
      return send(res, 200, { updates: { updatedRows: body.values.length } });
    }
    if (req.method === "POST" && path === "/values:batchUpdate") {
      for (const d of body.data) {
        const { title, ref } = parseRange(d.range);
        const m = ref.match(/^([A-Z]+)(\d+)$/);
        const row = tabs[title][+m[2] - 1];
        row[colIndex(m[1])] = d.values[0][0];
      }
      return send(res, 200, { totalUpdatedCells: body.data.length });
    }
    send(res, 404, { error: `no route ${req.method} ${path}` });
  } catch (e) {
    send(res, 400, { error: String(e) });
  }
}).listen(port, () => console.log(`mock sheets on :${port}`));
