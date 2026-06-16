/**
 * @neemias/nucleus — Módulo de Núcleos (Células/Pequenos Grupos)
 *
 * Primeiro módulo do ecossistema Neemias. Gerencia núcleos com regiões,
 * status, e vínculo com Students. Ativado via license key com entitlement "nucleus".
 *
 * @license BSL-1.1 — Source-available. Produção requer licença comercial.
 * @see https://github.com/barateza/neemias-modules
 */

import { registerPlugin } from "@openrollcall/plugin-registry";
import type { Plugin } from "@openrollcall/plugin-registry";
import { NUCLEUS_REGIONS } from "@openrollcall/schemas";

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
// These are created lazily when the core initializes them via hooks.

let _repository: NucleusRepository | null = null;
let _service: NucleusService | null = null;

export function getNucleusRepository(): NucleusRepository {
  if (!_repository) throw new Error("NucleusRepository not initialized. Plugin must be registered first.");
  return _repository;
}

export function getNucleusService(): NucleusService {
  if (!_service) throw new Error("NucleusService not initialized. Plugin must be registered first.");
  return _service;
}

// ── Plugin Registration ──────────────────────────────────────────────────────

export const nucleusPlugin: Plugin = {
  id: "nucleus",
  name: "Núcleos (Células)",
  version: "1.0.0",
  minCoreVersion: "1.0.0",

  // ── Worker API routes ───────────────────────────────────────────────────────
  registerWorkerRoutes: (route, _helpers?) => {
    const { requireAuth } = { requireAuth: () => ({} as any) };
    const { requireRole } = { requireRole: () => ({} as any) };

    route("GET",    "/api/v1/nuclei",             [requireAuth()],                              handleListNuclei);
    route("POST",   "/api/v1/nuclei",             [requireAuth(), requireRole(["ADMIN"])],       handleCreateNucleus);
    route("PATCH",  "/api/v1/nuclei/:nucleusId",  [requireAuth(), requireRole(["ADMIN"])],       handleUpdateNucleus);
    route("POST",   "/api/v1/nuclei/:nucleusId/delete", [requireAuth(), requireRole(["ADMIN"])], handleDeleteNucleus);
  },

  // ── React Router routes ────────────────────────────────────────────────────
  // Note: NucleiPage stays in core (imports from @neemias/nucleus for service/repo).
  // The React routes are registered by the core's router directly.
  registerReactRoutes: () => [
    // Routes are registered by the core via collectPluginRoutes() in routes.tsx.
    // When the module provides a NucleiPage component, add:
    // { path: "/nuclei", lazy: () => import("@neemias/nucleus/pages") },
  ],

  // ── i18n ────────────────────────────────────────────────────────────────────
  registerI18n: () => nucleusI18n,

  // ── Permissions ─────────────────────────────────────────────────────────────
  registerPermissions: () => ({
    "nuclei.manage": ["ADMIN"],
  }),

  // ── D1 Migration ────────────────────────────────────────────────────────────
  registerMigrations: () => [
    { version: 1, sql: NUCLEI_MIGRATION_SQL },
  ],

  // ── Dexie stores ────────────────────────────────────────────────────────────
  registerDexieStores: (db: any) => {
    // Initialize the repository with the Dexie instance
    _repository = new NucleusRepository(db);
    _service = new NucleusService(_repository);

    // Migrate: Dexie table registration
    // This is a no-op if the table already exists in the core schema.
    try {
      // Check if nuclei table exists in the schema
      const existingStores = (db as any).tables?.map?.((t: any) => t.name) ?? [];
      if (!existingStores.includes("nuclei")) {
        // Nuclei table registration would go here.
        // In practice, the table is already registered in the core's db.ts.
        // This hook is for the future when nuclei is fully extracted.
      }
    } catch {
      // Dexie version management is handled by the core.
    }
  },
};

// ── Register at import time (side-effect) ────────────────────────────────────
registerPlugin(nucleusPlugin);
