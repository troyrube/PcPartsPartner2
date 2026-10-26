// Telesign SMS two-factor helpers. Server-side only: the API key never
// reaches the browser. Used when TWO_FA_ENABLED=true.

function authHeader() {
  const raw = `${process.env.TELESIGN_CUSTOMER_ID}:${process.env.TELESIGN_API_KEY}`;
  return 'Basic ' + Buffer.from(raw).toString('base64');
}

export async function sendSmsCode(phoneNumber) {
  const response = await fetch('https://rest-api.telesign.com/v1/verify/sms', {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      phone_number: phoneNumber,
      template: 'Your PC Parts Partner verification code is $$CODE$$',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data?.errors?.[0]?.description || 'Telesign request failed';
    return { ok: false, error: reason };
  }
  return { ok: true, referenceId: data.reference_id };
}

export async function checkSmsCode(referenceId, code) {
  const response = await fetch(
    `https://rest-api.telesign.com/v1/verify/${encodeURIComponent(referenceId)}?verify_code=${encodeURIComponent(code)}`,
    { headers: { Authorization: authHeader() } }
  );
  const data = await response.json().catch(() => ({}));
  return data?.verify?.code_state === 'VALID';
}
