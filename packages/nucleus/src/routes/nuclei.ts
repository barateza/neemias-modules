/**
 * Module: Núcleos (Células) — Worker Route Handlers
 *
 * Pipeline-compatible handlers for nuclei CRUD.
 * Vendored utilities (json, parseBody, nowISO, randomUUID) to avoid
 * coupling to core internals. Uses env.DB directly (not getDB).
 *
 * @license BSL-1.1
 */

import { HttpError, sanitizePayload } from "@openrollcall/schemas";
import type { AuthPrincipal } from "@openrollcall/schemas";

// ── Schemas (module-defined) ─────────────────────────────────────────────────
import { nucleusCreateSchema, nucleusUpdateSchema } from "../schemas";

// ── Types ────────────────────────────────────────────────────────────────────
// env.DB is the only Worker binding these handlers need.
interface ModuleEnv {
  DB: {
    prepare(sql: string): D1PreparedStatement;
  };
}

interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<void>;
}

// ── Vendored utilities ───────────────────────────────────────────────────────

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
  schema?: { parse: (data: unknown) => T }
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
        error instanceof Error ? error.message : "Validation failed"
      );
    }
  }
  return sanitized as T;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

type NucleusRow = {
  nucleus_id: string;
  region: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapRow(r: NucleusRow) {
  return {
    nucleusId: r.nucleus_id,
    region: r.region,
    name: r.name,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function handleListNuclei(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string
): Promise<Response> {
  const url = new URL(request.url);
  const region = url.searchParams.get("region");
  const db = env.DB;
  let sql =
    "SELECT nucleus_id, region, name, status, created_at, updated_at FROM nuclei WHERE status = 'ACTIVE'";
  const params: unknown[] = [];
  if (region) {
    params.push(region);
    sql += ` AND region = ?${params.length}`;
  }
  sql += " ORDER BY region, name";
  const stmt = db.prepare(sql);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<NucleusRow>();
  return json({ items: result.results.map(mapRow) });
}

export async function handleCreateNucleus(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string
): Promise<Response> {
  const payload = await parseBody(request, nucleusCreateSchema);
  const db = env.DB;
  const nucleusId = randomUUID();
  const ts = nowISO();
  await db
    .prepare(
      "INSERT INTO nuclei(nucleus_id, region, name, status, created_at, updated_at) VALUES (?1, ?2, ?3, 'ACTIVE', ?4, ?4)"
    )
    .bind(nucleusId, payload.region, payload.name, ts)
    .run();
  return json(
    { nucleusId, region: payload.region, name: payload.name, status: "ACTIVE", createdAt: ts, updatedAt: ts },
    201
  );
}

export async function handleUpdateNucleus(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string
): Promise<Response> {
  const payload = await parseBody(request, nucleusUpdateSchema);
  const url = new URL(request.url);
  const nucleusId = url.pathname.split("/")[4];
  const db = env.DB;
  const fields: string[] = [];
  const params: unknown[] = [];
  if (payload.region !== undefined) {
    params.push(payload.region);
    fields.push(`region = ?${params.length}`);
  }
  if (payload.name !== undefined) {
    params.push(payload.name);
    fields.push(`name = ?${params.length}`);
  }
  params.push(nucleusId);
  fields.push("updated_at = ?" + (params.length + 1));
  params.push(nowISO());
  const result = await db
    .prepare(
      `UPDATE nuclei SET ${fields.join(", ")} WHERE nucleus_id = ?${params.length - 1} RETURNING nucleus_id, region, name, status, created_at, updated_at`
    )
    .bind(...params)
    .first<NucleusRow>();
  if (!result) throw new HttpError(404, "NOT_FOUND", "Nucleus not found");
  return json(mapRow(result));
}

export async function handleDeleteNucleus(
  request: Request,
  env: ModuleEnv,
  _ctx: ExecutionContext,
  _principal: AuthPrincipal,
  _corrId: string
): Promise<Response> {
  const url = new URL(request.url);
  const nucleusId = url.pathname.split("/")[4];
  const db = env.DB;
  const ts = nowISO();
  const result = await db
    .prepare("UPDATE nuclei SET status = 'DELETED', updated_at = ?1 WHERE nucleus_id = ?2 RETURNING nucleus_id")
    .bind(ts, nucleusId)
    .first<{ nucleus_id: string }>();
  if (!result) throw new HttpError(404, "NOT_FOUND", "Nucleus not found");
  return json({ nucleusId: result.nucleus_id, status: "DELETED", updatedAt: ts });
}
