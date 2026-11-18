export type OzowConfig = {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  siteCode: string;
};

export type PaymentRequest = {
  idempotencyKey: string;
  reference: string;
  amount: number;
  expiresAt: string;
  returnUrl: string;
  notifyUrl: string;
};

export type CreatedPayment = { id: string; redirectUrl: string };

export type OzowTransaction = { id: string; status: string } & Record<string, unknown>;

export class OzowError extends Error {
  constructor(readonly status: number, detail: string) {
    super(`Ozow answered ${status}: ${detail}`);
  }
}

const TOKEN_REFRESH_MARGIN_MS = 60_000;
const DAY_MS = 86_400_000;

function isoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function isTransaction(value: unknown): value is OzowTransaction {
  const record = value as Record<string, unknown> | null;
  return typeof record?.id === "string" && typeof record?.status === "string";
}

export function ozowClient(config: OzowConfig, fetchImpl: typeof fetch = fetch) {
  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) return token.value;
    const response = await fetchImpl(`${config.apiUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: "payments",
        grant_type: "client_credentials",
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || typeof body?.access_token !== "string") {
      throw new OzowError(response.status, body?.detail ?? "no access token");
    }
    token = { value: body.access_token, expiresAt: Date.now() + Number(body.expires_in) * 1000 };
    return token.value;
  }

  async function authorized(send: (bearer: string) => Promise<Response>): Promise<Response> {
    const response = await send(await accessToken());
    if (response.status !== 401) return response;
    token = null;
    return send(await accessToken());
  }

  async function createPayment(request: PaymentRequest): Promise<CreatedPayment> {
    const response = await authorized((bearer) => fetchImpl(`${config.apiUrl}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        "Idempotency-Key": request.idempotencyKey,
      },
      body: JSON.stringify({
        siteCode: config.siteCode,
        region: "ZA",
        amount: { currency: "ZAR", value: request.amount },
        merchantReference: request.reference,
        beneficiaryReference: request.reference,
        expireAt: request.expiresAt,
        returnUrl: request.returnUrl,
        notifyUrl: request.notifyUrl,
      }),
    }));
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new OzowError(response.status, body?.detail ?? response.statusText);
    if (typeof body?.id !== "string" || typeof body?.redirectUrl !== "string" || String(body.status).toLowerCase() !== "created") {
      throw new OzowError(response.status, `unexpected payment ${JSON.stringify(body)}`);
    }
    return { id: body.id, redirectUrl: body.redirectUrl };
  }

  async function paymentTransactions(paymentId: string, createdAt: Date): Promise<OzowTransaction[]> {
    const query = new URLSearchParams({
      fromDate: isoDate(createdAt.getTime() - DAY_MS),
      toDate: isoDate(Date.now() + DAY_MS),
      limit: "50",
    });
    let next: string | null = `${config.apiUrl}/payments/${encodeURIComponent(paymentId)}/transactions?${query}`;
    const transactions: OzowTransaction[] = [];
    while (next) {
      const page: string = next;
      const response = await authorized((bearer) => fetchImpl(page, { headers: { Authorization: `Bearer ${bearer}` } }));
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new OzowError(response.status, body?.detail ?? response.statusText);
      if (!Array.isArray(body?.results) || !body.results.every(isTransaction)) {
        throw new OzowError(response.status, `unexpected transactions ${JSON.stringify(body)}`);
      }
      transactions.push(...body.results);
      next = typeof body.links?.next === "string" ? body.links.next : null;
    }
    return transactions;
  }

  return { createPayment, paymentTransactions };
}

export type OzowClient = ReturnType<typeof ozowClient>;

export function ozowFromEnv(env: (name: string) => string): OzowClient | null {
  const config = {
    apiUrl: env("OZOW_API_URL"),
    clientId: env("OZOW_CLIENT_ID"),
    clientSecret: env("OZOW_CLIENT_SECRET"),
    siteCode: env("OZOW_SITE_CODE"),
  };
  return Object.values(config).every(Boolean) ? ozowClient(config) : null;
}
