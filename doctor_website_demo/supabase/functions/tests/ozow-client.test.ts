import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.14";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.102.1";
import { checkoutHandler } from "../ozow-checkout/checkout.ts";
import { notifyHandler } from "../ozow-notify/notify.ts";
import { reconcileHandler } from "../ozow-reconcile/reconcile.ts";
import { OzowError, ozowClient, type PaymentRequest } from "../_shared/ozow.ts";
import { MOCK_CREDENTIALS, startOzowMock } from "./ozow-mock.ts";

const request: PaymentRequest = {
  idempotencyKey: "4b1c4f3e-5d55-4a8f-9a49-7f0c2b9e1a01",
  reference: "DA0123456789",
  amount: 250,
  expiresAt: "2026-11-21T08:30:00.000Z",
  returnUrl: "https://courses.example.test/payments/return?booking=b1",
  notifyUrl: "https://project.example.test/functions/v1/ozow-notify",
};

function clientFor(mock: ReturnType<typeof startOzowMock>, overrides: Partial<typeof MOCK_CREDENTIALS> = {}) {
  return ozowClient({ apiUrl: mock.url, ...MOCK_CREDENTIALS, ...overrides });
}

Deno.test("creates a One API payment with the booking's amount and reference, signed with a bearer token", async () => {
  const mock = startOzowMock();
  try {
    const payment = await clientFor(mock).createPayment(request);

    assertEquals(payment.redirectUrl, `${mock.url.replace("/v1", "")}/${payment.id}/secure`);
    assertEquals(mock.createRequests.map((sent) => [sent.idempotencyKey, sent.body]), [[request.idempotencyKey, {
      siteCode: MOCK_CREDENTIALS.siteCode,
      region: "ZA",
      amount: { currency: "ZAR", value: 250 },
      merchantReference: "DA0123456789",
      beneficiaryReference: "DA0123456789",
      expireAt: "2026-11-21T08:30:00.000Z",
      returnUrl: request.returnUrl,
      notifyUrl: request.notifyUrl,
    }]]);
  } finally {
    await mock.close();
  }
});

Deno.test("reuses one access token across payments", async () => {
  const mock = startOzowMock();
  try {
    const client = clientFor(mock);
    await client.createPayment(request);
    await client.createPayment({ ...request, idempotencyKey: crypto.randomUUID(), reference: "DA9876543210" });
    assertEquals(mock.tokenRequests(), 1);
    assertEquals(mock.payments.size, 2);
  } finally {
    await mock.close();
  }
});

Deno.test("a token Ozow no longer accepts is replaced and the payment retried once", async () => {
  const first = startOzowMock({ port: 0 });
  const client = ozowClient({ apiUrl: first.url, ...MOCK_CREDENTIALS });
  await client.createPayment(request);
  await first.close();

  const restarted = startOzowMock({ port: first.port });
  try {
    const payment = await client.createPayment({ ...request, idempotencyKey: crypto.randomUUID() });
    assertEquals([restarted.tokenRequests(), restarted.payments.has(payment.id)], [1, true]);
  } finally {
    await restarted.close();
  }
});

Deno.test("a replay with the same idempotency key returns the same payment", async () => {
  const mock = startOzowMock();
  try {
    const client = clientFor(mock);
    const first = await client.createPayment(request);
    const replay = await client.createPayment(request);
    assertEquals(replay, first);
    assertEquals(mock.payments.size, 1);

    const conflict = await assertRejects(() => client.createPayment({ ...request, amount: 1 }), OzowError);
    assertEquals(conflict.status, 409);
  } finally {
    await mock.close();
  }
});

Deno.test("refusals surface as OzowError with Ozow's status", async () => {
  const mock = startOzowMock();
  try {
    const cases: [string, () => Promise<unknown>, number][] = [
      ["unknown client", () => clientFor(mock, { clientId: "nobody" }).createPayment(request), 404],
      ["wrong secret", () => clientFor(mock, { clientSecret: "wrong" }).createPayment(request), 401],
      ["other site", () => clientFor(mock, { siteCode: "OTH-OTH-001" }).createPayment(request), 400],
      ["reference with a dash", () => clientFor(mock).createPayment({ ...request, reference: "DA-01" }), 400],
      ["reference over 20 characters", () => clientFor(mock).createPayment({ ...request, reference: "DA012345678901234567890" }), 400],
      ["zero amount", () => clientFor(mock).createPayment({ ...request, amount: 0 }), 400],
      ["localhost return URL", () => clientFor(mock).createPayment({ ...request, returnUrl: "http://localhost:5173/payments/return" }), 403],
    ];
    for (const [label, attempt, status] of cases) {
      const error = await assertRejects(attempt, OzowError, undefined, label);
      assertEquals(error.status, status, label);
    }
    assertEquals(mock.payments.size, 0);
  } finally {
    await mock.close();
  }
});

Deno.test("the checkout answers preflight, refuses other methods, and refuses to start without Ozow credentials", async () => {
  const handler = checkoutHandler({ db: {} as SupabaseClient, ozow: null, appUrl: "", notifyUrl: "" });

  const preflight = await handler(new Request("http://function/", { method: "OPTIONS" }));
  assertEquals([preflight.status, preflight.headers.get("Access-Control-Allow-Origin")], [204, "*"]);

  assertEquals((await handler(new Request("http://function/", { method: "GET" }))).status, 405);

  const unconfigured = await handler(new Request("http://function/", { method: "POST", body: "{}" }));
  assertEquals([unconfigured.status, await unconfigured.json()], [503, { error: "Online payment is not available yet." }]);
});

Deno.test("lists a payment's transactions across pages, sending the dates Ozow requires", async () => {
  const mock = startOzowMock({ pageSize: 2 });
  try {
    const client = clientFor(mock);
    const payment = await client.createPayment(request);
    const sent = (["Created", "Cancelled", "Complete", "PendingInvestigation"] as const).map((outcome) => mock.addTransaction(payment.id, outcome));

    const listed = await client.paymentTransactions(payment.id, new Date());

    assertEquals(listed.map((transaction) => [transaction.id, transaction.status]), sent.map((transaction) => [transaction.id, transaction.status]));
    assertEquals(listed.map((transaction) => [transaction.status, transaction.reason]), [
      ["Incomplete", "Created"],
      ["Error", "Cancelled"],
      ["Successful", "Complete"],
      ["Pending", "PendingInvestigation"],
    ]);
    assertEquals(listed[2].amount, { currency: "ZAR", value: 250 });
    assertEquals(listed[2].merchantReference, request.reference);
  } finally {
    await mock.close();
  }
});

Deno.test("a payment Ozow does not know lists no transactions", async () => {
  const mock = startOzowMock();
  try {
    assertEquals(await clientFor(mock).paymentTransactions(crypto.randomUUID(), new Date()), []);
  } finally {
    await mock.close();
  }
});

Deno.test("a lookup with a token Ozow no longer accepts gets a fresh token and retries once", async () => {
  const first = startOzowMock({ port: 0 });
  const client = ozowClient({ apiUrl: first.url, ...MOCK_CREDENTIALS });
  await client.paymentTransactions(crypto.randomUUID(), new Date());
  await first.close();

  const restarted = startOzowMock({ port: first.port });
  try {
    assertEquals(await client.paymentTransactions(crypto.randomUUID(), new Date()), []);
    assertEquals(restarted.tokenRequests(), 1);
  } finally {
    await restarted.close();
  }
});

Deno.test("a lookup Ozow refuses surfaces as OzowError", async () => {
  const mock = startOzowMock();
  try {
    const error = await assertRejects(
      () => clientFor(mock, { clientSecret: "wrong" }).paymentTransactions(crypto.randomUUID(), new Date()),
      OzowError,
    );
    assertEquals(error.status, 401);
  } finally {
    await mock.close();
  }
});

function scriptedOzow(pages: (url: URL) => Response | null) {
  const requested: string[] = [];
  const fetchImpl = (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    requested.push(url.origin + url.pathname);
    if (url.pathname.endsWith("/token")) return Promise.resolve(Response.json({ access_token: "token", expires_in: "14400" }));
    const page = pages(url);
    if (page) return Promise.resolve(page);
    return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
  };
  return { requested, fetchImpl: fetchImpl as typeof fetch };
}

Deno.test("an Ozow call that does not answer in time fails closed", async () => {
  const silent = scriptedOzow(() => null);
  const client = ozowClient({ apiUrl: "https://one.example.test/v1", ...MOCK_CREDENTIALS, timeoutMs: 50 }, silent.fetchImpl);

  const lookup = await assertRejects(() => client.paymentTransactions("p-1", new Date()), OzowError);
  const payment = await assertRejects(() => client.createPayment(request), OzowError);

  assertEquals([lookup.status, payment.status], [504, 504]);
});

Deno.test("a transactions page link outside Ozow's API is never followed with the token", async () => {
  const ozow = scriptedOzow((url) =>
    url.origin === "https://one.example.test"
      ? Response.json({ results: [], links: { next: "https://collector.example.test/v1/payments/p-1/transactions?offset=50" } })
      : Response.json({ results: [], links: {} })
  );
  const client = ozowClient({ apiUrl: "https://one.example.test/v1", ...MOCK_CREDENTIALS }, ozow.fetchImpl);

  await assertRejects(() => client.paymentTransactions("p-1", new Date()), OzowError);
  assertEquals(ozow.requested, ["https://one.example.test/v1/token", "https://one.example.test/v1/payments/p-1/transactions"]);
});

Deno.test("notify and reconcile refuse what they cannot act on", async () => {
  const ozow = ozowClient({ apiUrl: "http://127.0.0.1:9/v1", ...MOCK_CREDENTIALS });
  const db = {} as SupabaseClient;
  const post = (body: string, headers: HeadersInit = {}) =>
    new Request("http://function/", { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers } });

  const notify = notifyHandler({ db, ozow });
  assertEquals((await notify(new Request("http://function/", { method: "GET" }))).status, 405);
  assertEquals((await notify(post("Status=Complete"))).status, 400);
  assertEquals((await notify(post("TransactionReference=DA-12%27%3B"))).status, 400);
  assertEquals((await notifyHandler({ db, ozow: null })(post("TransactionReference=DA0123456789"))).status, 503);

  const reconcile = reconcileHandler({ db, ozow, serviceRoleKey: "service-key" });
  assertEquals((await reconcile(new Request("http://function/", { method: "GET" }))).status, 405);
  assertEquals((await reconcile(post("{}"))).status, 401);
  assertEquals((await reconcile(post("{}", { Authorization: "Bearer anon-key" }))).status, 401);
  assertEquals((await reconcileHandler({ db, ozow, serviceRoleKey: "" })(post("{}", { Authorization: "Bearer " }))).status, 401);
  assertEquals((await reconcileHandler({ db, ozow: null, serviceRoleKey: "service-key" })(post("{}", { Authorization: "Bearer service-key" }))).status, 503);
});
