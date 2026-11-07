# Finance Tracker

A Next.js dashboard for Shubham's finances: personal and Infinity Linkage income, expenses, upcoming payments, subscriptions, and who owes whom. Built on Krutik Raut's [finance-tracker](https://github.com/krutikkkkkkkkk/finance-tracker), with Google Sheets in place of Notion.

A Google Sheet is the database. Anything you add here is written to the sheet, and anything you edit in the sheet shows up here on the next page load.

## Pages

| Page | What it does |
|---|---|
| **Dashboard** | Shows this month's income, expenses and net, plus what you're owed and what you owe. Also has a 6‑month income vs expenses chart, spending by category, people balances, renewals due in the next 30 days, and recent transactions. Filter by All / Personal / Infinity Linkage. |
| **Upcoming** | Bills and payments with a due date: credit card bills, rent, EMIs, GST, and client payments you're expecting. Subscription renewals and debts with a due date show up here too. Items are grouped into Overdue, Next 7 days, Later this month and Further out. **Mark paid** logs a transaction for the item. A recurring item then moves to its next due date, and a one-time item is marked Paid. |
| **Transactions** | Add an expense or income, optionally linked to a debt it settles. Filter by month and type. Click a row to open it in the sheet. |
| **Analytics** | Spending by category, with each category broken down into its subcategories. Pick a period (this month, last month, last 3, 6 or 12 months, or this year) and the Personal / Infinity Linkage filter. Choose any category or subcategory, for example Rapido over the last 3 months, to see its total, the change from the previous period, the number of transactions, the average per transaction, a month-by-month chart and every transaction. |
| **Categories** | Your categories, with their subcategories (e.g. Rapido and Uber under Transport, Zomato and Swiggy under Food & Dining) and this month's spend for each. You can add new categories or subcategories here. |
| **Debts** | Balance per person, open debts with an Overdue / Partially paid / Open status, and **Record payment**, which logs a linked repayment transaction. You can also add a debt (creating a new person if needed) or add a person. |
| **Subscriptions** | Monthly and yearly totals. **Mark renewed** moves the next renewal date forward by one billing cycle; you can also cancel or reactivate a subscription. |

Debt repayments are left out of the income and expense totals, so lending money to a friend never shows up as spending. Categories marked **Transfer** (Credit Card Bill, Own Accounts & Savings) are left out too, so paying a card bill doesn't count the same spending twice.

## The sheet

One tab per table: **Transactions, Categories, Subcategories, Debts, People, Subscriptions, Upcoming, Referral Programs, Referral Payouts**.

- Row 1 is the header. Column A is **ID**, a unique ID the app creates. Leave it alone.
- Columns are matched by header name, so you can reorder columns or add your own.
- Linked fields (Category, Subcategory, Person, Debt, Program, …) hold the ID of the linked row. Several IDs are separated by commas.
- Dates are `YYYY-MM-DD`. A date typed by hand (e.g. `07/11/2026`) also works.
- **Deleting** in the app fills the row's **Deleted** cell instead of removing it. Clear that cell to bring the row back.
- **Source** on a transaction records where it came from (`gmail:<message id>` for bank-alert imports, `notion-old` for the old Notion table).

## 1. Give the app access to the sheet (one time, ~5 minutes)

The app signs in to Google as a *service account*, a robot Google account that only sees what you share with it.

1. Open <https://console.cloud.google.com/>, create a project (any name), then open **APIs & Services → Library**, search **Google Sheets API** and click **Enable**.
2. **APIs & Services → Credentials → Create credentials → Service account**. Any name; skip the optional steps.
3. Open the new service account → **Keys → Add key → Create new key → JSON**. A `.json` file downloads.
4. Open your Google Sheet → **Share** → paste the service account's email (`…@….iam.gserviceaccount.com`, also in the JSON as `client_email`) → **Editor** → Send.

## 2. Environment variables

| Variable | Value |
|---|---|
| `GOOGLE_SHEET_ID` | The long ID in the sheet's URL: `docs.google.com/spreadsheets/d/<this part>/edit` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON key, the whole `-----BEGIN PRIVATE KEY-----…` text |
| `APP_PASSWORD` | The password you'll type to open the app |
| `AUTH_SECRET` | Optional. Any long random string |

Never commit the JSON key or `.env.local`.

## 3. Run locally

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

To try it with no Google account at all, run the bundled mock API with a seed file:

```bash
node scripts/mock-sheets.mjs seed.json 4010
GOOGLE_SHEETS_API_BASE=http://localhost:4010 GOOGLE_SHEET_ID=mock npm run dev
```

## 4. Deploy to Vercel

Import the repo at <https://vercel.com/new>, add the environment variables above, and deploy. Changing `APP_PASSWORD` signs out every device.

## How it works

- `src/lib/sheets.ts` is the Google Sheets client: service-account sign-in, one `batchGet` per page load for every tab (memoised per request), and row append / update by ID.
- `src/lib/data.ts` turns rows into transactions, debts, people and so on, and computes the totals: debt balances, upcoming items and monthly cash flow.
- `src/app/actions.ts` holds the server actions that add and edit rows. Each one re-checks your session.
- `src/proxy.ts` is a password gate on every route. Next.js 16 renamed `middleware` to `proxy`.
- The Google key lives only on the server and is never sent to the browser.

If you rename a column in the sheet, update the matching name in `sheets.ts`, `data.ts` and `actions.ts`.
