const assert = require("node:assert/strict");
const test = require("node:test");

const { getKioskConfig, requestKioskApi } = require("./kiosk-api.cjs");

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  KIOSK_ACCESS_TOKEN: "a".repeat(64),
};

test("validates and normalizes kiosk configuration", () => {
  assert.deepEqual(getKioskConfig(validEnvironment), {
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_example",
    accessToken: "a".repeat(64),
  });
  assert.throws(
    () => getKioskConfig({ ...validEnvironment, KIOSK_ACCESS_TOKEN: "short" }),
    /device credential/,
  );
});

test("sends the device credential only from the main process request", async () => {
  const payload = { result: { action: "check-in" } };
  const result = await requestKioskApi(
    getKioskConfig(validEnvironment),
    { method: "POST", body: { code: "JITPASS:test" } },
    async (url, options) => {
      assert.equal(url, "https://example.supabase.co/functions/v1/scan-booking-pass");
      assert.equal(options.headers["x-kiosk-token"], "a".repeat(64));
      assert.equal(options.body, JSON.stringify({ code: "JITPASS:test" }));
      return new Response(JSON.stringify(payload), { status: 200 });
    },
  );

  assert.deepEqual(result, payload);
});

test("surfaces API errors", async () => {
  await assert.rejects(
    requestKioskApi(
      getKioskConfig(validEnvironment),
      {},
      async () =>
        new Response(JSON.stringify({ error: "Invalid kiosk credential." }), { status: 401 }),
    ),
    /Invalid kiosk credential/,
  );
});
