import "server-only";
import { createSign, randomUUID } from "node:crypto";
import { cache } from "react";

/**
 * Google Sheets as the database.
 *
 * One spreadsheet, one tab per table. Row 1 of every tab is the header, column A is "ID".
 * Columns are matched by header name, so you can reorder or add columns in the sheet freely.
 * Linked records (Category, Person, Debt, …) hold the linked row's ID; several IDs are
 * separated by commas. Deleting sets the "Deleted" cell instead of removing the row —
 * clear that cell in the sheet to restore it.
 */

export const TABLES = {
  transactions: {
    tab: "Transactions",
    columns: ["ID", "Name", "Date", "Amount", "Type", "Scope", "Category", "Subcategory", "Payment Method", "Paid To / From", "Debt", "Upcoming Payment", "GST Paid", "Notes", "Source", "Deleted"],
  },
  categories: { tab: "Categories", columns: ["ID", "Category", "Icon", "Scope", "Transfer", "Deleted"] },
  subcategories: { tab: "Subcategories", columns: ["ID", "Name", "Category", "Deleted"] },
  debts: {
    tab: "Debts",
    columns: ["ID", "Description", "Person", "Direction", "Amount", "Date", "Due Date", "Scope", "Notes", "Deleted"],
  },
  people: { tab: "People", columns: ["ID", "Name", "Phone", "UPI ID", "Relationship", "Deleted"] },
  subscriptions: {
    tab: "Subscriptions",
    columns: ["ID", "Name", "Amount", "Billing Cycle", "Next Renewal", "Scope", "Category", "Payment Method", "Active", "Notes", "Deleted"],
  },
  upcoming: {
    tab: "Upcoming",
    columns: ["ID", "Name", "Amount", "Due Date", "Direction", "Repeat", "Status", "Scope", "Category", "Person", "Payment Method", "Paid So Far", "Notes", "Deleted"],
  },
  referralPrograms: {
    tab: "Referral Programs",
    columns: ["ID", "Company", "Platform", "Link", "Commission", "Active", "Notes", "Deleted"],
  },
  referralPayouts: {
    tab: "Referral Payouts",
    columns: ["ID", "Name", "Program", "Amount", "Original Amount", "Status", "Earned Date", "Expected Payout", "Paid Date", "Transaction", "Notes", "Deleted"],
  },
} as const;

export type TableKey = keyof typeof TABLES;
type Cell = string | number | boolean | null;

export type Row = {
  id: string;
  /** Opens the row in Google Sheets. */
  url: string;
  /** 1-based sheet row number at the time it was read. */
  rowNumber: number;
  values: Record<string, Cell>;
};

// ---------- auth ----------

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to .env.local or your Vercel project (see README).`);
  return v;
}

const API = () => (process.env.GOOGLE_SHEETS_API_BASE || "https://sheets.googleapis.com").replace(/\/$/, "");
const SHEET_ID = () => env("GOOGLE_SHEET_ID");

let token: { value: string; exp: number } | null = null;

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

async function accessToken(): Promise<string> {
  // Local testing against a mock API needs no Google credentials.
  if (process.env.GOOGLE_SHEETS_API_BASE) return "mock";
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = env("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status}). Check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return token.value;
}

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API()}/v4/spreadsheets/${SHEET_ID()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 403 || res.status === 404) {
      throw new Error(`Google Sheets refused access (${res.status}). Share the sheet with the service account email as Editor.`);
    }
    throw new Error(`Google Sheets request failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

const quote = (tab: string) => `'${tab.replaceAll("'", "''")}'`;

// ---------- reading ----------

/** Tab title → numeric sheet id (for row links). Rarely changes, so kept for the process lifetime. */
let gids: Map<string, number> | null = null;
async function sheetGids(): Promise<Map<string, number>> {
  if (gids) return gids;
  const meta = await api<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    "?fields=sheets.properties(sheetId,title)",
  );
  gids = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  return gids;
}

type Snapshot = Record<TableKey, Row[]>;

/**
 * Bumped after every write, so a server action that writes and then re-renders the page
 * (same request) reads fresh data instead of the request's earlier snapshot.
 */
let writes = 0;

/** Every table in one API call, memoised per request (and per write). */
export const loadAll = () => loadAllAt(writes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- cache key only
const loadAllAt = cache(async (_writes: number): Promise<Snapshot> => {
  const keys = Object.keys(TABLES) as TableKey[];
  const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" });
  for (const k of keys) params.append("ranges", `${quote(TABLES[k].tab)}!A1:Z`);
  const [batch, ids] = await Promise.all([
    api<{ valueRanges: { values?: Cell[][] }[] }>(`/values:batchGet?${params}`),
    sheetGids(),
  ]);
  const out = {} as Snapshot;
  keys.forEach((k, i) => {
    const [header = [], ...rows] = batch.valueRanges[i]?.values ?? [];
    const names = header.map((h) => String(h ?? "").trim());
    const gid = ids.get(TABLES[k].tab) ?? 0;
    out[k] = rows
      .map((cells, r) => {
        const values: Record<string, Cell> = {};
        names.forEach((n, c) => {
          if (n) values[n] = cells[c] ?? null;
        });
        const rowNumber = r + 2;
        return {
          id: String(values.ID ?? "").trim(),
          rowNumber,
          url: `https://docs.google.com/spreadsheets/d/${SHEET_ID()}/edit#gid=${gid}&range=A${rowNumber}`,
          values,
        };
      })
      .filter((row) => row.id && !String(row.values.Deleted ?? "").trim());
  });
  return out;
});

export async function rowsOf(table: TableKey): Promise<Row[]> {
  return (await loadAll())[table];
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

/** Dates typed by hand in the sheet can come back in a few shapes; normalise to YYYY-MM-DD. */
export function toISODate(v: Cell): string | null {
  if (v === null || v === "" || typeof v === "boolean") return null;
  if (typeof v === "number") {
    // Sheets serial day number (days since 1899-12-30).
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); // Indian order: DD/MM/YYYY
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -,]+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`;
  return null;
}

/** Readers that mirror the old Notion property readers. */
export const read = {
  text(r: Row, col: string): string {
    const v = r.values[col];
    return v === null || v === undefined ? "" : String(v).trim();
  },
  number(r: Row, col: string): number | null {
    const v = r.values[col];
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[,₹\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  },
  select(r: Row, col: string): string | null {
    return read.text(r, col) || null;
  },
  date(r: Row, col: string): string | null {
    return toISODate(r.values[col] ?? null);
  },
  ids(r: Row, col: string): string[] {
    return read.text(r, col).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  },
  checkbox(r: Row, col: string): boolean {
    const v = r.values[col];
    return v === true || /^(true|yes|y|1|✓|✔)$/i.test(String(v ?? "").trim());
  },
};

// ---------- writing ----------

export type Values = Record<string, Cell | string[] | undefined>;

function toCell(v: Cell | string[] | undefined): Cell {
  if (v === undefined) return null;
  if (Array.isArray(v)) return v.join(", ");
  return v;
}

/** Current header row and ID column of a tab, read fresh (not from the request cache). */
async function layout(table: TableKey) {
  const tab = quote(TABLES[table].tab);
  const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE" });
  params.append("ranges", `${tab}!1:1`);
  params.append("ranges", `${tab}!A:A`);
  const res = await api<{ valueRanges: { values?: Cell[][] }[] }>(`/values:batchGet?${params}`);
  const header = (res.valueRanges[0]?.values?.[0] ?? []).map((h) => String(h ?? "").trim());
  const ids = (res.valueRanges[1]?.values ?? []).map((r) => String(r?.[0] ?? "").trim());
  if (!header.length) throw new Error(`The “${TABLES[table].tab}” tab has no header row.`);
  return { header, ids };
}

const colLetter = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Appends a row and returns its new ID. */
export async function insert(table: TableKey, values: Values): Promise<string> {
  const id = randomUUID();
  const { header } = await layout(table);
  const row = header.map((h) => (h === "ID" ? id : toCell(values[h])));
  await api(
    `/values/${encodeURIComponent(`${quote(TABLES[table].tab)}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: { values: [row] } },
  );
  writes++;
  return id;
}

/** Finds a row by ID; null if it isn't in this table (or was deleted). */
export async function findRow(table: TableKey, id: string): Promise<Row | null> {
  const norm = (s: string) => s.replaceAll("-", "").toLowerCase();
  return (await rowsOf(table)).find((r) => norm(r.id) === norm(id)) ?? null;
}

/** Updates only the given columns of one row, located by ID. */
export async function update(table: TableKey, id: string, values: Values): Promise<void> {
  const norm = (s: string) => s.replaceAll("-", "").toLowerCase();
  const { header, ids } = await layout(table);
  const index = ids.findIndex((x, i) => i > 0 && norm(x) === norm(id));
  if (index < 1) throw new Error("That entry doesn't belong here.");
  const rowNumber = index + 1;
  const data = Object.entries(values)
    .filter(([col]) => col !== "ID")
    .map(([col, v]) => {
      const c = header.indexOf(col);
      if (c < 0) throw new Error(`The “${TABLES[table].tab}” tab is missing a “${col}” column.`);
      return { range: `${quote(TABLES[table].tab)}!${colLetter(c)}${rowNumber}`, values: [[toCell(v)]] };
    });
  if (!data.length) return;
  await api(`/values:batchUpdate`, { method: "POST", body: { valueInputOption: "RAW", data } });
  writes++;
}

export const sameId = (a: string, b: string) => a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase();

/** Value builders kept with the old Notion names so the actions read the same. */
export const write = {
  title: (v: string) => v,
  text: (v: string) => v,
  number: (v: number | null) => v,
  select: (v: string | null) => v,
  date: (v: string | null) => v,
  relation: (ids: string[]) => ids,
  checkbox: (v: boolean) => v,
  phone: (v: string) => v,
};
