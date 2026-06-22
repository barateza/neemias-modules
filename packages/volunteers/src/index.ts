import { registerPlugin, type Plugin, type EntityProjection } from "@neemias/plugin-registry";

import {
  handleListVolunteers, handleCreateVolunteer, handleUpdateVolunteer,
  handleDeleteVolunteer, handleGetVolunteer, handleAddVolunteerClass,
  handleRemoveVolunteerClass, handleAddVolunteerGuardian, handleRemoveVolunteerGuardian,
} from "./routes/volunteers";
import { volunteerI18n } from "./i18n";

const VOLUNTEER_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS volunteers (
  volunteer_id  TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  birth_date    TEXT,
  photo_ref     TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE','REMOVED')),
  areas         TEXT DEFAULT '[]',
  nucleus_id    TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  created_by    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_volunteers_status ON volunteers(status);
CREATE INDEX IF NOT EXISTS idx_volunteers_nucleus ON volunteers(nucleus_id);

CREATE TABLE IF NOT EXISTS volunteer_classes (
  volunteer_id  TEXT NOT NULL,
  class_id      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'TEACHER' CHECK(role IN ('TEACHER','ASSISTANT')),
  PRIMARY KEY (volunteer_id, class_id)
);

CREATE TABLE IF NOT EXISTS volunteer_consents (
  consent_id    TEXT PRIMARY KEY,
  volunteer_id  TEXT NOT NULL,
  consent_photo INTEGER NOT NULL DEFAULT 0,
  consent_data  INTEGER NOT NULL DEFAULT 0,
  consent_date  TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_guardians (
  student_id    TEXT NOT NULL,
  volunteer_id  TEXT NOT NULL,
  relationship  TEXT NOT NULL CHECK(relationship IN ('PAI','MAE','TUTOR','AVO','OUTRO')),
  PRIMARY KEY (student_id, volunteer_id)
);
`;

const volunteerProjection: EntityProjection = {
  entityType: "VOLUNTEER",
  tableName: "volunteers",
  idColumn: "volunteer_id",
  fieldMap: {
    displayName: "display_name",
    email: "email",
    phone: "phone",
    birthDate: "birth_date",
    photoRef: "photo_ref",
    status: "status",
    areas: "areas",
    nucleusId: "nucleus_id",
    notes: "notes",
  },
};

interface WorkerMiddlewares {
  requireAuth: () => unknown;
  requireRole: (roles: string[]) => unknown;
}
type RouteFn = (method: string, path: string, middlewares: unknown[], handler: (...args: any[]) => Promise<Response>) => void;

export const volunteersPlugin: Plugin = {
  id: "volunteers",
  name: "Voluntários",
  version: "1.0.0",
  minCoreVersion: "1.0.0",

  registerEntityProjection: () => [volunteerProjection],

  registerWorkerRoutes: (route: unknown, middlewares: unknown) => {
    const r = route as RouteFn;
    const mw = middlewares as WorkerMiddlewares;

    r("GET",    "/api/v1/volunteers",                       [mw.requireAuth()],                                    handleListVolunteers);
    r("POST",   "/api/v1/volunteers",                       [mw.requireAuth(), mw.requireRole(["ADMIN", "CADASTRO"])], handleCreateVolunteer);
    r("PATCH",  "/api/v1/volunteers/:id",                    [mw.requireAuth(), mw.requireRole(["ADMIN", "CADASTRO"])], handleUpdateVolunteer);
    r("POST",   "/api/v1/volunteers/:id/delete",             [mw.requireAuth(), mw.requireRole(["ADMIN"])],            handleDeleteVolunteer);
    r("GET",    "/api/v1/volunteers/:id",                    [mw.requireAuth()],                                    handleGetVolunteer);
    r("POST",   "/api/v1/volunteers/:id/classes",            [mw.requireAuth(), mw.requireRole(["ADMIN", "CADASTRO"])], handleAddVolunteerClass);
    r("DELETE", "/api/v1/volunteers/:id/classes/:classId",   [mw.requireAuth(), mw.requireRole(["ADMIN"])],            handleRemoveVolunteerClass);
    r("POST",   "/api/v1/volunteers/:id/guardians",          [mw.requireAuth(), mw.requireRole(["ADMIN", "CADASTRO"])], handleAddVolunteerGuardian);
    r("DELETE", "/api/v1/volunteers/:id/guardians/:studentId",[mw.requireAuth(), mw.requireRole(["ADMIN"])],            handleRemoveVolunteerGuardian);
  },

  registerReactRoutes: () => [
    // { path: "/volunteers", lazy: () => import("@neemias/volunteers/pages") },
  ],

  registerI18n: () => volunteerI18n,

  registerPermissions: () => ({
    "volunteer.view": ["ADMIN", "CADASTRO", "VOLUNTEER"],
    "volunteer.manage": ["ADMIN", "CADASTRO"],
    "volunteer.delete": ["ADMIN"],
  }),

  registerMigrations: () => [
    { version: 1, sql: VOLUNTEER_MIGRATION_SQL },
  ],

  registerDexieStores: () => {
    // Dexie stores would be registered here when frontend is ready
  },
};

registerPlugin(volunteersPlugin);
