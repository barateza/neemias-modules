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

// ── Schema imports (core MIT) ────────────────────────────────────────────────
// NUCLEUS_REGIONS, nucleusRegionSchema, nucleusSchema, Nucleus, NucleusRegion
// These stay in @openrollcall/schemas because the Student entity depends on them.
import { NUCLEUS_REGIONS } from "@openrollcall/schemas";

// ── Route handlers (extracted from workers/src/routes/nuclei.ts) ────────────
// These will be moved here from the core. For now, they exist in workers/.
// import { handleListNucleiPipeline, handleCreateNucleusPipeline,
//          handleUpdateNucleusPipeline, handleDeleteNucleusPipeline }
//   from "./routes/nuclei";

// ── React pages (extracted from app/src/app/pages/NucleiPage.tsx) ────────────
// import { NucleiPage } from "./pages/NucleiPage";

// ── Permissions ──────────────────────────────────────────────────────────────
// nuclei.manage permission: only ADMIN can create/edit/delete nuclei.
// Already defined in @openrollcall/permissions — this hook is for module-specific
// permissions beyond what the core ships.

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

// ── Plugin Registration ──────────────────────────────────────────────────────

export const nucleusPlugin: Plugin = {
  id: "nucleus",
  name: "Núcleos (Células)",
  version: "1.0.0",
  minCoreVersion: "1.0.0",

  // Worker API routes — extracted from workers/src/routes/nuclei.ts
  registerWorkerRoutes: (_route) => {
    // TODO: After extraction, handlers will be imported from ./routes/nuclei.ts
    // route("GET",    "/api/v1/nuclei",             [verifyLicenseKey("nucleus"), requireAuth()],                       handleListNucleiPipeline);
    // route("POST",   "/api/v1/nuclei",             [verifyLicenseKey("nucleus"), requireAuth(), requireRole(["ADMIN"])], handleCreateNucleusPipeline);
    // route("PATCH",  "/api/v1/nuclei/:nucleusId",  [verifyLicenseKey("nucleus"), requireAuth(), requireRole(["ADMIN"])], handleUpdateNucleusPipeline);
    // route("DELETE", "/api/v1/nuclei/:nucleusId",  [verifyLicenseKey("nucleus"), requireAuth(), requireRole(["ADMIN"])], handleDeleteNucleusPipeline);
  },

  // React Router routes — extracted from app/src/app/pages/NucleiPage.tsx
  registerReactRoutes: () => [
    // TODO: After extraction, import NucleiPage from ./pages/NucleiPage
    // { path: "/nuclei", element: <NucleiPage /> },
  ],

  // i18n — extracted from app/src/app/utils/i18n.ts
  registerI18n: () => ({
    nuclei: {
      title: "Núcleos",
      add: "Adicionar núcleo",
      edit: "Editar núcleo",
      delete: "Remover núcleo",
      confirmDelete: "Tem certeza que deseja remover este núcleo?",
      name: "Nome",
      region: "Região",
      status: "Status",
      noNuclei: "Nenhum núcleo cadastrado",
      ACTIVE: "Ativo",
      INACTIVE: "Inativo",
      DELETED: "Removido",
    },
  }),

  // Permissions
  registerPermissions: () => ({
    "nuclei.manage": ["ADMIN"],
  }),

  // D1 Migration
  registerMigrations: () => [
    { version: 1, sql: NUCLEI_MIGRATION_SQL },
  ],

  // Dexie stores — extracted from app/src/db/db.ts
  registerDexieStores: (_db) => {
    // TODO: After extraction
    // db.version(10).stores({
    //   ...db.existingVersion,
    //   nuclei: "nucleusId, region, name, status",
    // });
  },
};

// ── Register at import time (side-effect) ────────────────────────────────────
registerPlugin(nucleusPlugin);
