export type MockCredentials = { clientId: string; clientSecret: string; siteCode: string };

export type RecordedPayment = {
  id: string;
  idempotencyKey: string | null;
  body: Record<string, unknown>;
};

export type MockTransaction = {
  links: { self: string; refund: string };
  id: string;
  amount: { currency: string; value: number };
  merchantReference: string;
  siteCode: string;
  institution: string;
  status: "Incomplete" | "Successful" | "Error" | "Pending";
  reason?: string;
  createdDate: string;
  completedDate?: string;
};

export type TransactionOutcome =
  | "Complete"
  | "Cancelled"
  | "Abandoned"
  | "Voided"
  | "Error"
  | "Pending"
  | "PendingInvestigation"
  | "Created";

const ONE_API_STATUS: Record<TransactionOutcome, MockTransaction["status"]> = {
  Complete: "Successful",
  Cancelled: "Error",
  Abandoned: "Error",
  Voided: "Error",
  Error: "Error",
  Pending: "Pending",
  PendingInvestigation: "Pending",
  Created: "Incomplete",
};

const MOCK_PRIVATE_KEY = "mock-payments-api-private-key";

export const MOCK_CREDENTIALS: MockCredentials = {
  clientId: "mock-client",
  clientSecret: "mock-secret",
  siteCode: "MCK-MCK-001",
};

function problem(status: number, code: string, detail: string): Response {
  return Response.json({ id: crypto.randomUUID(), links: null, code, title: code, detail, source: null, meta: null }, { status });
}

function isUri(value: unknown): value is string {
  return typeof value === "string" && URL.canParse(value);
}

function paymentRequestProblem(body: Record<string, unknown>, siteCode: string): Response | null {
  const amount = body.amount as Record<string, unknown> | undefined;
  for (const field of ["siteCode", "amount", "merchantReference", "expireAt"]) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return problem(400, "BadRequest", `'${field}' must not be empty.`);
    }
  }
  if (body.siteCode !== siteCode) return problem(400, "BadRequest", "Site code is not valid for this client.");
  if (typeof amount !== "object" || amount.currency !== "ZAR" || typeof amount.value !== "number") {
    return problem(400, "BadRequest", "amount must be { currency: 'ZAR', value: number }.");
  }
  if (amount.value < 0.01) return problem(400, "BadRequest", "'Amount' must be greater than '0'.");
  if (body.region !== undefined && body.region !== "ZA") return problem(400, "BadRequest", "region must be ZA.");
  if (typeof body.merchantReference !== "string" || body.merchantReference.length > 50) {
    return problem(400, "BadRequest", "merchantReference must be at most 50 characters.");
  }
  if (!body.beneficiaryReference) {
    return problem(400, "BadRequest", "Error occurred creating merchant request (Parameter 'Bank reference missing')");
  }
  if (typeof body.beneficiaryReference !== "string" || !/^[A-Za-z0-9]{1,20}$/.test(body.beneficiaryReference)) {
    return problem(400, "BadRequest", "beneficiaryReference must be letters and numbers only, at most 20.");
  }
  if (typeof body.expireAt !== "string" || Number.isNaN(Date.parse(body.expireAt))) {
    return problem(400, "BadRequest", "expireAt must be an RFC 3339 date-time.");
  }
  for (const field of ["returnUrl", "notifyUrl"]) {
    const value = body[field];
    if (value === undefined) continue;
    if (!isUri(value)) return problem(400, "BadRequest", `${field} must be a valid URL.`);
    if (new URL(value).hostname === "localhost") return problem(403, "Forbidden", `${field} must be reachable from the internet.`);
  }
  return null;
}

function paymentPage(payment: RecordedPayment): Response {
  const amount = payment.body.amount as { value: number };
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mock Ozow checkout</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:48px auto;color:#0f172a}a{display:block;margin:10px 0;padding:12px;border-radius:8px;text-align:center;text-decoration:none}
.pay{background:#0f766e;color:#fff}.cancel{border:1px solid #cbd5e1;color:#334155}</style></head>
<body><p>Mock Ozow payment page</p><h1>Pay R ${amount.value.toFixed(2)}</h1><p>Reference ${payment.body.merchantReference}</p>
<a class="pay" href="/${payment.id}/secure/Complete">Simulate a completed payment</a>
<a class="cancel" href="/${payment.id}/secure/PendingInvestigation">Simulate a payment the bank must investigate</a>
<a class="cancel" href="/${payment.id}/secure/Cancelled">Cancel</a></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function sha512(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function notificationForm(transaction: MockTransaction, outcome: TransactionOutcome): Promise<URLSearchParams> {
  const fields: [string, string][] = [
    ["SiteCode", transaction.siteCode],
    ["TransactionId", transaction.id],
    ["TransactionReference", transaction.merchantReference],
    ["Amount", transaction.amount.value.toFixed(2)],
    ["Status", outcome],
    ["Optional1", ""],
    ["Optional2", ""],
    ["Optional3", ""],
    ["Optional4", ""],
    ["Optional5", ""],
    ["CurrencyCode", transaction.amount.currency],
    ["IsTest", "True"],
    ["StatusMessage", transaction.reason ?? ""],
  ];
  const hash = await sha512((fields.map(([, value]) => value).join("") + MOCK_PRIVATE_KEY).toLowerCase());
  return new URLSearchParams([...fields, ["Hash", hash]]);
}

export function startOzowMock({
  port = 0,
  hostname = "127.0.0.1",
  credentials = MOCK_CREDENTIALS,
  notifyUrl = undefined as string | undefined,
  pageSize = 50,
} = {}) {
  const tokens = new Set<string>();
  const payments = new Map<string, RecordedPayment>();
  const transactions = new Map<string, MockTransaction[]>();
  const byIdempotencyKey = new Map<string, { bodyText: string; payment: RecordedPayment }>();
  const createRequests: Omit<RecordedPayment, "id">[] = [];
  let tokenRequests = 0;
  let refuseNext = false;
  let beforeNextPayment: (() => Promise<void>) | null = null;
  let origin = "";

  async function token(req: Request): Promise<Response> {
    tokenRequests += 1;
    const form = req.headers.get("Content-Type")?.includes("application/json")
      ? new URLSearchParams(await req.json())
      : new URLSearchParams(await req.text());
    if (form.get("grant_type") !== "client_credentials") return problem(400, "BadRequest", "grant_type must be client_credentials.");
    if (form.get("client_id") !== credentials.clientId) {
      return problem(404, "NotFound", `Consumer could not be found for client id ${form.get("client_id")}.`);
    }
    if (form.get("client_secret") !== credentials.clientSecret) return problem(401, "Unauthorized", "Invalid client secret.");
    if (form.get("scope") !== "payments") return problem(401, "Unauthorized", "Consumer does not have access to requested scope");
    const accessToken = crypto.randomUUID();
    tokens.add(accessToken);
    return Response.json({ access_token: accessToken, token_type: "Bearer", expires_in: "14400", scope: "payments" });
  }

  async function createPayment(req: Request): Promise<Response> {
    if (!authorized(req)) return problem(401, "Unauthorized", "Unauthorized Request");
    const bodyText = await req.text();
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    const idempotencyKey = req.headers.get("Idempotency-Key");
    createRequests.push({ idempotencyKey, body });

    const previous = idempotencyKey ? byIdempotencyKey.get(idempotencyKey) : undefined;
    if (previous && previous.bodyText !== bodyText) {
      return problem(409, "Conflict", "Idempotency key and request data do not match a previous request.");
    }
    if (refuseNext && !previous) {
      refuseNext = false;
      return problem(400, "BadRequest", "Refused by the mock on request.");
    }
    const refusal = previous ? null : paymentRequestProblem(body, credentials.siteCode);
    if (refusal) return refusal;
    const hook = beforeNextPayment;
    beforeNextPayment = null;
    await hook?.();

    const payment = previous?.payment ?? { id: crypto.randomUUID(), idempotencyKey, body };
    payments.set(payment.id, payment);
    if (idempotencyKey) byIdempotencyKey.set(idempotencyKey, { bodyText, payment });
    const self = `${origin}/v1/payments/${payment.id}`;
    return Response.json({
      links: { self, cancel: `${self}/cancel`, transactions: `${self}/transactions` },
      id: payment.id,
      status: "Created",
      redirectUrl: `${origin}/${payment.id}/secure`,
    }, { status: 201, headers: { Location: self } });
  }

  function authorized(req: Request): boolean {
    return tokens.has(req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "");
  }

  function listTransactions(req: Request, paymentId: string): Response {
    if (!authorized(req)) return problem(401, "Unauthorized", "Unauthorized Request");
    const url = new URL(req.url);
    for (const field of ["fromDate", "toDate"]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get(field) ?? "")) {
        return problem(400, "BadRequest", `'${field}' must be a date.`);
      }
    }
    const all = transactions.get(paymentId) ?? [];
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), pageSize);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const page = (at: number) => {
      const link = new URL(url);
      link.searchParams.set("limit", String(limit));
      link.searchParams.set("offset", String(at));
      return link.toString();
    };
    const lastOffset = Math.max(0, Math.ceil(all.length / limit) - 1) * limit;
    return Response.json({
      links: {
        self: page(offset),
        first: page(0),
        last: all.length > limit ? page(lastOffset) : null,
        prev: offset > 0 ? page(Math.max(0, offset - limit)) : null,
        next: offset + limit < all.length ? page(offset + limit) : null,
      },
      results: all.slice(offset, offset + limit),
      meta: { totalPages: Math.ceil(all.length / limit), totalItems: all.length },
    });
  }

  function addTransaction(paymentId: string, outcome: TransactionOutcome, overrides: Partial<MockTransaction> = {}): MockTransaction {
    const payment = payments.get(paymentId);
    if (!payment) throw new Error(`no mock payment ${paymentId}`);
    const id = overrides.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const transaction: MockTransaction = {
      links: { self: `${origin}/v1/transactions/${id}`, refund: `${origin}/v1/transactions/${id}/refunds` },
      id,
      amount: payment.body.amount as MockTransaction["amount"],
      merchantReference: String(payment.body.merchantReference),
      siteCode: String(payment.body.siteCode),
      institution: "Mock Bank",
      status: ONE_API_STATUS[outcome],
      reason: outcome,
      createdDate: now,
      ...(outcome === "Created" ? {} : { completedDate: now }),
      ...overrides,
    };
    const list = transactions.get(paymentId) ?? [];
    const existing = list.findIndex((candidate) => candidate.id === id);
    if (existing >= 0) list[existing] = transaction;
    else list.push(transaction);
    transactions.set(paymentId, list);
    return transaction;
  }

  async function notify(transaction: MockTransaction, outcome: TransactionOutcome, url: string): Promise<Response> {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: await notificationForm(transaction, outcome),
    });
  }

  async function finishPayment(payment: RecordedPayment, outcome: TransactionOutcome): Promise<Response> {
    const transaction = addTransaction(payment.id, outcome);
    const target = notifyUrl ?? String(payment.body.notifyUrl);
    const delivered = await notify(transaction, outcome, target).catch((error) => error);
    if (!(delivered instanceof Response) || !delivered.ok) console.error(`mock notification to ${target} failed`, delivered);
    else await delivered.body?.cancel();
    const back = new URL(String(payment.body.returnUrl));
    back.searchParams.set("status", outcome);
    back.searchParams.set("reference", String(payment.body.merchantReference));
    return Response.redirect(back.toString(), 303);
  }

  const server = Deno.serve({ port, hostname, onListen: () => {} }, (req) => {
    const { pathname } = new URL(req.url);
    if (req.method === "POST" && pathname === "/v1/token") return token(req);
    if (req.method === "POST" && pathname === "/v1/payments") return createPayment(req);
    const listing = pathname.match(/^\/v1\/payments\/([^/]+)\/transactions$/);
    if (req.method === "GET" && listing) return listTransactions(req, decodeURIComponent(listing[1]));
    const page = pathname.match(/^\/([0-9a-f-]{36})\/secure(?:\/(Complete|Cancelled|PendingInvestigation))?$/);
    const payment = page && payments.get(page[1]);
    if (req.method === "GET" && payment && page[2]) return finishPayment(payment, page[2] as TransactionOutcome);
    if (req.method === "GET" && payment) return paymentPage(payment);
    return problem(404, "NotFound", `No mock route for ${req.method} ${pathname}`);
  });
  origin = `http://${hostname === "0.0.0.0" ? "127.0.0.1" : hostname}:${server.addr.port}`;

  return {
    url: `${origin}/v1`,
    port: server.addr.port,
    payments,
    transactions,
    createRequests,
    addTransaction,
    notify,
    tokenRequests: () => tokenRequests,
    refuseNextPayment: () => { refuseNext = true; },
    beforeNextPayment: (hook: () => Promise<void>) => { beforeNextPayment = hook; },
    close: () => server.shutdown(),
  };
}

if (import.meta.main) {
  const mock = startOzowMock({
    port: Number(Deno.env.get("OZOW_MOCK_PORT") ?? 55590),
    hostname: "0.0.0.0",
    notifyUrl: Deno.env.get("OZOW_MOCK_NOTIFY_URL") || undefined,
  });
  console.log(`Mock Ozow One API listening on ${mock.url}`);
}
