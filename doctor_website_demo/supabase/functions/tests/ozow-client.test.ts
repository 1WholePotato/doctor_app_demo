import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.14";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.102.1";
import { checkoutHandler } from "../ozow-checkout/checkout.ts";
import { OzowError, ozowClient, type PaymentRequest } from "../ozow-checkout/ozow.ts";
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
