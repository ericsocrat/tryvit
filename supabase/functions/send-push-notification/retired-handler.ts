/** Inert compatibility endpoint: authenticate service authority, never dispatch. */
export function createRetiredPushHandler(readServiceAuthority: () => string | undefined) {
  return async (request: Request): Promise<Response> => {
    const json = (body: object, status: number) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const expected = readServiceAuthority();
    if (!expected) return json({ error: "Service authority unavailable" }, 503);
    const provided = request.headers.get("Authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!provided) return json({ error: "Unauthorized" }, 401);

    // Compare fixed-length digests without early character exits. Neither the
    // credential nor its digest is logged, persisted or returned to the caller.
    const encoder = new TextEncoder();
    const [left, right] = await Promise.all([
      crypto.subtle.digest("SHA-256", encoder.encode(expected)),
      crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    ]);
    const expectedDigest = new Uint8Array(left);
    const actualDigest = new Uint8Array(right);
    let difference = 0;
    for (let i = 0; i < expectedDigest.length; i += 1) difference |= expectedDigest[i] ^ actualDigest[i];
    if (difference !== 0) return json({ error: "Unauthorized" }, 401);
    return json({ processed: 0, status: "retired", reason: "unsupported_aggregate" }, 200);
  };
}
