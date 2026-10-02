import { withSupabase } from "@supabase/server";

const allowedPermissions = new Set(["seating", "reservations", "announcements"]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emailFromName(name: string) {
  const localPart = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return localPart ? `${localPart}@jit-studyhub.com` : null;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const callerId = context.userClaims!.id;
    const adminClient = context.supabaseAdmin;

    const { data: owner, error: ownerError } = await adminClient
      .from("profiles")
      .select("role, email, is_active, must_change_password")
      .eq("id", callerId)
      .single();

    if (ownerError) {
      console.error("Owner profile lookup failed", ownerError.code, ownerError.message);
      return json({ error: "The owner account could not be verified." }, 500);
    }

    if (
      !owner ||
      owner.role !== "admin" ||
      owner.email?.toLowerCase() !== "admin@jit-studyhub.com" ||
      !owner.is_active ||
      owner.must_change_password
    ) {
      return json({ error: "Only the owner account can create employee accounts." }, 403);
    }

    let body: { name?: unknown; password?: unknown; permissions?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    const password = typeof body.password === "string" ? body.password : "";
    const permissions = Array.isArray(body.permissions)
      ? [...new Set(body.permissions.filter((value): value is string => typeof value === "string" && allowedPermissions.has(value)))]
      : [];
    const email = emailFromName(name);

    if (name.length < 2 || name.length > 120 || !email || email.length > 254) {
      return json({ error: "Enter a valid employee name between 2 and 120 characters." }, 400);
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return json({ error: "The temporary password must contain at least 8 characters, including a letter and a number." }, 400);
    }
    if (permissions.length === 0) {
      return json({ error: "Select at least one permission." }, 400);
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createError || !created.user) {
      const duplicate = createError?.message.toLowerCase().includes("already") ?? false;
      return json({ error: duplicate ? `${email} already exists.` : "The employee account could not be created." }, duplicate ? 409 : 400);
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name: name,
        email,
        role: "staff",
        staff_permissions: permissions,
        must_change_password: true,
        is_active: true,
      })
      .eq("id", created.user.id);

    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ error: "The employee profile could not be configured." }, 500);
    }

    await adminClient.from("audit_logs").insert({
      actor_id: callerId,
      action: "Created employee account",
      entity_type: "staff_account",
      entity_id: created.user.id,
      details: { email, permissions },
    });

    return json({ account: { id: created.user.id, name, email, permissions } }, 201);
  }),
};
