import { withSupabase } from "@supabase/server";

const permissionValues = ["seating", "reservations", "announcements"] as const;
const allowedPermissions = new Set<string>(permissionValues);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StaffPermission = (typeof permissionValues)[number];
type RequestBody = {
  action?: unknown;
  staffId?: unknown;
  permissions?: unknown;
  isActive?: unknown;
  password?: unknown;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const ownerId = context.userClaims!.id;
    const adminClient = context.supabaseAdmin;

    const { data: owner, error: ownerError } = await adminClient
      .from("profiles")
      .select("role, email, is_active, must_change_password")
      .eq("id", ownerId)
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
      return json({ error: "Only the owner can manage employee accounts." }, 403);
    }

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const action = typeof body.action === "string" ? body.action : "";
    const staffId = typeof body.staffId === "string" ? body.staffId : "";

    if (!uuidPattern.test(staffId)) {
      return json({ error: "Enter a valid employee account ID." }, 400);
    }

    const { data: staff, error: staffError } = await adminClient
      .from("profiles")
      .select("id, full_name, email, role, is_active, staff_permissions")
      .eq("id", staffId)
      .eq("role", "staff")
      .single();

    if (staffError || !staff) {
      return json({ error: "The employee account could not be found." }, 404);
    }

    let auditAction = "";
    let auditDetails: Record<string, unknown> = {};
    let result: Record<string, unknown> = {};

    if (action === "update_permissions") {
      const submitted = Array.isArray(body.permissions) ? body.permissions : [];
      if (
        submitted.length === 0 ||
        submitted.some((value) => typeof value !== "string" || !allowedPermissions.has(value))
      ) {
        return json({ error: "Select at least one valid employee permission." }, 400);
      }

      const submittedSet = new Set(submitted as string[]);
      const permissions = permissionValues.filter((permission) => submittedSet.has(permission));
      const { error } = await adminClient
        .from("profiles")
        .update({ staff_permissions: permissions })
        .eq("id", staffId)
        .eq("role", "staff");

      if (error) {
        console.error("Staff permission update failed", error.code, error.message);
        return json({ error: "The employee permissions could not be updated." }, 500);
      }

      auditAction = "Updated employee permissions";
      auditDetails = { email: staff.email, before: staff.staff_permissions, after: permissions };
      result = { permissions };
    } else if (action === "set_active") {
      if (typeof body.isActive !== "boolean") {
        return json({ error: "Choose whether the employee account is active." }, 400);
      }

      if (body.isActive) {
        const { error: authError } = await adminClient.auth.admin.updateUserById(staffId, {
          ban_duration: "none",
        });
        if (authError) {
          console.error("Staff Auth reactivation failed", authError.code, authError.message);
          return json({ error: "The employee sign-in could not be reactivated." }, 500);
        }

        const { error: profileError } = await adminClient
          .from("profiles")
          .update({ is_active: true })
          .eq("id", staffId)
          .eq("role", "staff");
        if (profileError) {
          await adminClient.auth.admin.updateUserById(staffId, { ban_duration: "876000h" });
          console.error(
            "Staff profile reactivation failed",
            profileError.code,
            profileError.message,
          );
          return json({ error: "The employee account could not be reactivated." }, 500);
        }

        auditAction = "Reactivated employee account";
      } else {
        const { error: profileError } = await adminClient
          .from("profiles")
          .update({ is_active: false })
          .eq("id", staffId)
          .eq("role", "staff");
        if (profileError) {
          console.error(
            "Staff profile deactivation failed",
            profileError.code,
            profileError.message,
          );
          return json({ error: "The employee account could not be deactivated." }, 500);
        }

        const { error: authError } = await adminClient.auth.admin.updateUserById(staffId, {
          ban_duration: "876000h",
        });
        if (authError) {
          console.error("Staff Auth deactivation failed", authError.code, authError.message);
          return json(
            { error: "Dashboard access is blocked, but Auth sign-in could not be disabled." },
            500,
          );
        }

        const { data: revoked, error: revokeError } = await adminClient.rpc(
          "revoke_staff_sessions",
          {
            p_staff_id: staffId,
          },
        );
        if (revokeError) {
          console.error("Staff session revocation failed", revokeError.code, revokeError.message);
          return json(
            {
              error: "The account is inactive, but its refreshable sessions could not be revoked.",
            },
            500,
          );
        }

        auditAction = "Deactivated employee account";
        result = { revokedSessions: revoked };
      }

      auditDetails = { email: staff.email, active: body.isActive };
      result = { ...result, isActive: body.isActive };
    } else if (action === "reset_password") {
      const password = typeof body.password === "string" ? body.password : "";
      if (
        password.length < 8 ||
        password.length > 72 ||
        !/[A-Za-z]/.test(password) ||
        !/\d/.test(password)
      ) {
        return json({ error: "Use 8 to 72 characters with at least one letter and number." }, 400);
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(staffId, {
        password,
      });
      if (authError) {
        console.error("Staff password reset failed", authError.code, authError.message);
        return json({ error: "The temporary password could not be set." }, 500);
      }

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", staffId)
        .eq("role", "staff");
      if (profileError) {
        await adminClient.auth.admin.updateUserById(staffId, { ban_duration: "876000h" });
        console.error(
          "Staff password-reset profile update failed",
          profileError.code,
          profileError.message,
        );
        return json(
          {
            error:
              "The password changed, but the account was disabled because the required-reset flag could not be saved.",
          },
          500,
        );
      }

      const { data: revoked, error: revokeError } = await adminClient.rpc("revoke_staff_sessions", {
        p_staff_id: staffId,
      });
      if (revokeError) {
        console.error(
          "Staff session revocation after password reset failed",
          revokeError.code,
          revokeError.message,
        );
        return json(
          { error: "The password changed, but refreshable sessions could not be revoked." },
          500,
        );
      }

      auditAction = "Reset employee password";
      auditDetails = { email: staff.email, password_change_required: true };
      result = { revokedSessions: revoked, mustChangePassword: true };
    } else {
      return json({ error: "Unsupported employee account action." }, 400);
    }

    const { error: auditError } = await adminClient.from("audit_logs").insert({
      actor_id: ownerId,
      action: auditAction,
      entity_type: "staff_account",
      entity_id: staffId,
      details: auditDetails,
    });
    if (auditError) {
      console.error("Staff lifecycle audit insert failed", auditError.code, auditError.message);
    }

    return json({ account: { id: staffId, name: staff.full_name }, ...result });
  }),
};
