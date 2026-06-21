/**
 * @neemias/nucleus — Módulo de Núcleos (Células/Pequenos Grupos)
 *
 * Primeiro módulo do ecossistema Neemias. Gerencia núcleos com regiões,
 * status, e vínculo com Students. Ativado via license key com entitlement "nucleus".
 *
 * @license BSL-1.1 — Source-available. Produção requer licença comercial.
 * @see https://github.com/barateza/neemias-modules
 */

import { registerPlugin } from "@neemias/plugin-registry";
import type { Plugin } from "@neemias/plugin-registry";
import { NUCLEUS_REGIONS } from "@neemias/schemas";

// ── Module sub-modules ───────────────────────────────────────────────────────
import {
  handleListNuclei,
  handleCreateNucleus,
  handleUpdateNucleus,
  handleDeleteNucleus,
} from "./routes/nuclei";
import { nucleusI18n } from "./i18n";
import { NucleusRepository } from "./db/repository";
import { NucleusService } from "./services/nucleusService";

// ── D1 Migration ─────────────────────────────────────────────────────────────
const NUCLEI_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS nuclei (
  nucleus_id TEXT PRIMARY KEY,
  region TEXT NOT NULL CHECK(region IN (${NUCLEUS_REGIONS.map((r) => `'${r}'`).join(", ")})),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE','DELETED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nuclei_region ON nuclei(region);
CREATE INDEX IF NOT EXISTS idx_nuclei_status ON nuclei(status);
`;

// ── Singleton instances ──────────────────────────────────────────────────────

let _repository: NucleusRepository | null = null;
let _service: NucleusService | null = null;

export function getNucleusRepository(): NucleusRepository {
  if (!_repository) throw new Error("NucleusRepository not initialized.");
  return _repository;
}

export function getNucleusService(): NucleusService {
  if (!_service) throw new Error("NucleusService not initialized.");
  return _service;
}

// ── Plugin Registration ──────────────────────────────────────────────────────

interface WorkerMiddlewares {
  requireAuth: () => unknown;
  requireRole: (roles: string[]) => unknown;
}

type RouteFn = (
  method: string,
  path: string,
  middlewares: unknown[],
  handler: (...args: any[]) => Promise<Response>
) => void;

export const nucleusPlugin: Plugin = {
  id: "nucleus",
  name: "Núcleos (Células)",
  version: "1.0.0",
  minCoreVersion: "1.0.0",

  registerWorkerRoutes: (route: unknown, middlewares: unknown) => {
    const r = route as RouteFn;
    const mw = middlewares as WorkerMiddlewares;

    r("GET",    "/api/v1/nuclei",                    [mw.requireAuth()],                              handleListNuclei);
    r("POST",   "/api/v1/nuclei",                    [mw.requireAuth(), mw.requireRole(["ADMIN"])],    handleCreateNucleus);
    r("PATCH",  "/api/v1/nuclei/:nucleusId",         [mw.requireAuth(), mw.requireRole(["ADMIN"])],    handleUpdateNucleus);
    r("POST",   "/api/v1/nuclei/:nucleusId/delete",  [mw.requireAuth(), mw.requireRole(["ADMIN"])],    handleDeleteNucleus);
  },

  registerReactRoutes: () => [
    // React routes registered by core via collectPluginRoutes()
    // When NucleiPage is ready to be imported from the module, add:
    // { path: "/nuclei", lazy: () => import("@neemias/nucleus/pages") },
  ],

  registerI18n: () => nucleusI18n,

  registerPermissions: () => ({
    "nuclei.manage": ["ADMIN"],
  }),

  registerMigrations: () => [
    { version: 1, sql: NUCLEI_MIGRATION_SQL },
  ],

  registerDexieStores: (db: any) => {
    _repository = new NucleusRepository(db);
    _service = new NucleusService(_repository);
  },
};

// ── Register at import time (side-effect) ────────────────────────────────────
registerPlugin(nucleusPlugin);
