import type { AuthPrincipal } from "@neemias/schemas";
import { HttpError, sanitizePayload } from "@neemias/schemas";
import { applyEvent } from "@neemias/schemas/workers";
import {
  guardianSchema,
  volunteerClassSchema,
  volunteerCreateSchema,
  volunteerUpdateSchema,
} from "../schemas";

interface ModuleEnv {
  DB: { prepare(sql: string): D1PreparedStatement };
}
interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { last_row_id?: number } }>;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function nowISO(): string {
  return new Date().toISOString();
}
function randomUUID(): string {
  return crypto.randomUUID();
}
async function parseBody<T>(
  request: Request,
  schema?: { parse: (data: unknown) => T },
): Promise<T> {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "VALIDATION_FAILED", "Invalid JSON body");
  }
  const sanitized = sanitizePayload(body);
  if (schema) {
    try {
      return schema.parse(sanitized);
    } catch (error) {
      throw new HttpError(
        400,
        "VALIDATION_FAILED",
        error instanceof Error ? error.message : "Validation failed",
      );
    }
  }
  return sanitized as T;
}

type VolunteerRow = {
  volunteer_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  photo_ref: string;
  status: string;
  areas: string;
  nucleus_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
};
function mapRow(r: VolunteerRow) {
  return {
    volunteerId: r.volunteer_id,
    displayName: r.display_name,
    email: r.email,
    phone: r.phone,
    birthDate: r.birth_date,
    photoRef: r.photo_ref,
    status: r.status,
    areas: JSON.parse(r.areas || "[]"),
    nucleusId: r.nucleus_id,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    createdBy: r.created_by,
  };
}

// GET /api/v1/volunteers
export async function handleListVolunteers(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "ACTIVE";
  const db = env.DB;
  const rows = await db
    .prepare("SELECT * FROM volunteers WHERE status = ?1 ORDER BY display_name")
    .bind(status)
    .all<VolunteerRow>();
  return json({ items: rows.results.map(mapRow) });
}

// POST /api/v1/volunteers
export async function handleCreateVolunteer(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  principal: AuthPrincipal,
  _corrId: string,
): Promise<Response> {
  const payload = await parseBody(request, volunteerCreateSchema);
  const db = env.DB;
  const volunteerId = randomUUID();
  const ts = nowISO();

  // Consent
  const consentId = randomUUID();
  await db.batch([
    db
      .prepare(`INSERT INTO volunteers(volunteer_id, display_name, email, phone, birth_date, photo_ref, status, areas, nucleus_id, notes, created_at, updated_at, created_by)
      VALUES (?1,?2,?3,?4,?5,?6,'ACTIVE',?7,?8,?9,?10,?10,?11)`)
      .bind(
        volunteerId,
        payload.displayName,
        payload.email ?? null,
        payload.phone ?? null,
        payload.birthDate ?? null,
        payload.photoRef ?? "",
        JSON.stringify(payload.areas),
        payload.nucleusId ?? null,
        payload.notes ?? null,
        ts,
        principal.userId,
      ),
    db
      .prepare(`INSERT INTO volunteer_consents(consent_id, volunteer_id, consent_photo, consent_data, consent_date, created_at)
      VALUES (?1,?2,?3,?4,?5,?5)`)
      .bind(consentId, volunteerId, payload.consentPhoto ? 1 : 0, payload.consentData ? 1 : 0, ts),
  ]);

  // Class associations
  for (const cls of payload.classes) {
    await db
      .prepare("INSERT INTO volunteer_classes(volunteer_id, class_id, role) VALUES (?1,?2,?3)")
      .bind(volunteerId, cls.classId, cls.role)
      .run();
  }

  // Event-sourcing
  await applyEvent({
    eventId: randomUUID(),
    entityType: "VOLUNTEER",
    entityId: volunteerId,
    version: 1,
    actionType: "CREATED",
    payload: { displayName: payload.displayName, email: payload.email, areas: payload.areas },
    actorId: principal.userId,
    actorRole: principal.role,
    timestamp: ts,
  });

  return json({ volunteerId, status: "ACTIVE", createdAt: ts }, 201);
}

// PATCH /api/v1/volunteers/:id
export async function handleUpdateVolunteer(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  principal: AuthPrincipal,
  _corrId: string,
): Promise<Response> {
  const payload = await parseBody(request, volunteerUpdateSchema);
  const url = new URL(request.url);
  const volunteerId = url.pathname.split("/")[4];
  const db = env.DB;

  const cols: string[] = [];
  const params: unknown[] = [];
  if (payload.displayName !== undefined) {
    cols.push("display_name");
    params.push(payload.displayName);
  }
  if (payload.email !== undefined) {
    cols.push("email");
    params.push(payload.email);
  }
  if (payload.phone !== undefined) {
    cols.push("phone");
    params.push(payload.phone);
  }
  if (payload.areas !== undefined) {
    cols.push("areas");
    params.push(JSON.stringify(payload.areas));
  }
  if (payload.nucleusId !== undefined) {
    cols.push("nucleus_id");
    params.push(payload.nucleusId);
  }
  if (payload.notes !== undefined) {
    cols.push("notes");
    params.push(payload.notes);
  }
  if (payload.status !== undefined) {
    cols.push("status");
    params.push(payload.status);
  }
  if (cols.length === 0) throw new HttpError(400, "VALIDATION_FAILED", "No fields to update");

  params.push(nowISO(), volunteerId);
  const setClauses = cols.map((c, i) => `${c} = ?${i + 1}`);
  setClauses.push(`updated_at = ?${cols.length + 1}`);
  await db
    .prepare(
      `UPDATE volunteers SET ${setClauses.join(", ")} WHERE volunteer_id = ?${cols.length + 2}`,
    )
    .bind(...params)
    .run();

  await applyEvent({
    eventId: randomUUID(),
    entityType: "VOLUNTEER",
    entityId: volunteerId,
    version: 1,
    actionType: "UPDATED",
    payload: payload as Record<string, unknown>,
    actorId: principal.userId,
    actorRole: principal.role,
    timestamp: nowISO(),
  });

  return json({ volunteerId, status: "updated" });
}

// POST /api/v1/volunteers/:id/delete
export async function handleDeleteVolunteer(
  _request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  principal: AuthPrincipal,
  _corrId: string,
): Promise<Response> {
  const volunteerId = new URL(_request.url).pathname.split("/")[4];
  const db = env.DB;
  const ts = nowISO();
  await db
    .prepare("UPDATE volunteers SET status = 'REMOVED', updated_at = ?1 WHERE volunteer_id = ?2")
    .bind(ts, volunteerId)
    .run();

  await applyEvent({
    eventId: randomUUID(),
    entityType: "VOLUNTEER",
    entityId: volunteerId,
    version: 1,
    actionType: "DELETED",
    payload: {},
    actorId: principal.userId,
    actorRole: principal.role,
    timestamp: ts,
  });

  return json({ volunteerId, status: "REMOVED" });
}

// GET /api/v1/volunteers/:id
export async function handleGetVolunteer(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string,
): Promise<Response> {
  const volunteerId = new URL(request.url).pathname.split("/")[4];
  const db = env.DB;
  const row = await db
    .prepare("SELECT * FROM volunteers WHERE volunteer_id = ?1")
    .bind(volunteerId)
    .first<VolunteerRow>();
  if (!row) throw new HttpError(404, "NOT_FOUND", "Volunteer not found");

  const classes = (
    await db
      .prepare("SELECT class_id, role FROM volunteer_classes WHERE volunteer_id = ?1")
      .bind(volunteerId)
      .all<{ class_id: string; role: string }>()
  ).results;

  const guardians = (
    await db
      .prepare(`SELECT sg.student_id, sg.relationship, s.display_name as student_name
    FROM student_guardians sg JOIN students s ON s.student_id = sg.student_id WHERE sg.volunteer_id = ?1`)
      .bind(volunteerId)
      .all<{ student_id: string; relationship: string; student_name: string }>()
  ).results;

  return json({
    ...mapRow(row),
    classes: classes.map((c) => ({ classId: c.class_id, role: c.role })),
    students: guardians.map((g) => ({
      studentId: g.student_id,
      relationship: g.relationship,
      name: g.student_name,
    })),
  });
}

// POST /api/v1/volunteers/:id/classes
export async function handleAddVolunteerClass(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string,
): Promise<Response> {
  const volunteerId = new URL(request.url).pathname.split("/")[4];
  const payload = await parseBody(request, volunteerClassSchema);
  await env.DB.prepare(
    "INSERT INTO volunteer_classes(volunteer_id, class_id, role) VALUES (?1,?2,?3)",
  )
    .bind(volunteerId, payload.classId, payload.role)
    .run();
  return json({ volunteerId, classId: payload.classId, role: payload.role }, 201);
}

// DELETE /api/v1/volunteers/:id/classes/:classId
export async function handleRemoveVolunteerClass(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string,
): Promise<Response> {
  const parts = new URL(request.url).pathname.split("/");
  const volunteerId = parts[4];
  const classId = parts[6];
  await env.DB.prepare("DELETE FROM volunteer_classes WHERE volunteer_id = ?1 AND class_id = ?2")
    .bind(volunteerId, classId)
    .run();
  return json({ volunteerId, classId, status: "removed" });
}

// POST /api/v1/volunteers/:id/guardians
export async function handleAddVolunteerGuardian(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string,
): Promise<Response> {
  const volunteerId = new URL(request.url).pathname.split("/")[4];
  const payload = await parseBody(request, guardianSchema);
  await env.DB.prepare(
    "INSERT INTO student_guardians(student_id, volunteer_id, relationship) VALUES (?1,?2,?3)",
  )
    .bind(payload.studentId, volunteerId, payload.relationship)
    .run();
  return json(
    { volunteerId, studentId: payload.studentId, relationship: payload.relationship },
    201,
  );
}

// DELETE /api/v1/volunteers/:id/guardians/:studentId
export async function handleRemoveVolunteerGuardian(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string,
): Promise<Response> {
  const parts = new URL(request.url).pathname.split("/");
  const volunteerId = parts[4];
  const studentId = parts[6];
  await env.DB.prepare("DELETE FROM student_guardians WHERE volunteer_id = ?1 AND student_id = ?2")
    .bind(volunteerId, studentId)
    .run();
  return json({ volunteerId, studentId, status: "removed" });
}
