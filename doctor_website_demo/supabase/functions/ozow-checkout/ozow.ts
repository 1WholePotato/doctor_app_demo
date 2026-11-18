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

export class OzowError extends Error {
  constructor(readonly status: number, detail: string) {
    super(`Ozow answered ${status}: ${detail}`);
  }
}

const TOKEN_REFRESH_MARGIN_MS = 60_000;

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

  function postPayment(request: PaymentRequest, bearer: string): Promise<Response> {
    return fetchImpl(`${config.apiUrl}/payments`, {
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
    });
  }

  async function createPayment(request: PaymentRequest): Promise<CreatedPayment> {
    let response = await postPayment(request, await accessToken());
    if (response.status === 401) {
      token = null;
      response = await postPayment(request, await accessToken());
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new OzowError(response.status, body?.detail ?? response.statusText);
    if (typeof body?.id !== "string" || typeof body?.redirectUrl !== "string" || String(body.status).toLowerCase() !== "created") {
      throw new OzowError(response.status, `unexpected payment ${JSON.stringify(body)}`);
    }
    return { id: body.id, redirectUrl: body.redirectUrl };
  }

  return { createPayment };
}

export type OzowClient = ReturnType<typeof ozowClient>;
