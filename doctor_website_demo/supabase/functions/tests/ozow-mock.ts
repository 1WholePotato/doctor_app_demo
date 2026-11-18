export type MockCredentials = { clientId: string; clientSecret: string; siteCode: string };

export type RecordedPayment = {
  id: string;
  idempotencyKey: string | null;
  body: Record<string, unknown>;
};

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
  const returnUrl = new URL(String(payment.body.returnUrl));
  const back = (status: string) => {
    const url = new URL(returnUrl);
    url.searchParams.set("status", status);
    url.searchParams.set("reference", String(payment.body.merchantReference));
    return url.toString();
  };
  const amount = payment.body.amount as { value: number };
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mock Ozow checkout</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:48px auto;color:#0f172a}a{display:block;margin:10px 0;padding:12px;border-radius:8px;text-align:center;text-decoration:none}
.pay{background:#0f766e;color:#fff}.cancel{border:1px solid #cbd5e1;color:#334155}</style></head>
<body><p>Mock Ozow payment page</p><h1>Pay R ${amount.value.toFixed(2)}</h1><p>Reference ${payment.body.merchantReference}</p>
<a class="pay" href="${back("Complete")}">Simulate a completed payment</a>
<a class="cancel" href="${back("Cancelled")}">Cancel</a></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export function startOzowMock({ port = 0, hostname = "127.0.0.1", credentials = MOCK_CREDENTIALS } = {}) {
  const tokens = new Set<string>();
  const payments = new Map<string, RecordedPayment>();
  const byIdempotencyKey = new Map<string, { bodyText: string; payment: RecordedPayment }>();
  const createRequests: Omit<RecordedPayment, "id">[] = [];
  let tokenRequests = 0;
  let refuseNext = false;
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
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    if (!tokens.has(bearer)) return problem(401, "Unauthorized", "Unauthorized Request");
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

  const server = Deno.serve({ port, hostname, onListen: () => {} }, (req) => {
    const { pathname } = new URL(req.url);
    if (req.method === "POST" && pathname === "/v1/token") return token(req);
    if (req.method === "POST" && pathname === "/v1/payments") return createPayment(req);
    const page = pathname.match(/^\/([0-9a-f-]{36})\/secure$/);
    const payment = page && payments.get(page[1]);
    if (req.method === "GET" && payment) return paymentPage(payment);
    return problem(404, "NotFound", `No mock route for ${req.method} ${pathname}`);
  });
  origin = `http://${hostname === "0.0.0.0" ? "127.0.0.1" : hostname}:${server.addr.port}`;

  return {
    url: `${origin}/v1`,
    port: server.addr.port,
    payments,
    createRequests,
    tokenRequests: () => tokenRequests,
    refuseNextPayment: () => { refuseNext = true; },
    close: () => server.shutdown(),
  };
}

if (import.meta.main) {
  const mock = startOzowMock({ port: Number(Deno.env.get("OZOW_MOCK_PORT") ?? 55590), hostname: "0.0.0.0" });
  console.log(`Mock Ozow One API listening on ${mock.url}`);
}
