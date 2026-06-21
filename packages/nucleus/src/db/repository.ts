/**
 * Module: Núcleos (Células) — NucleusRepository
 *
 * Encapsula acesso a dados de núcleos no IndexedDB (Dexie).
 * Injeta-se a instância do Dexie via construtor.
 *
 * @license BSL-1.1
 */

import type { Nucleus, NucleusRegion } from "@neemias/schemas";

export interface NucleusDB {
  nuclei: {
    get(id: string): Promise<Nucleus | undefined>;
    add(item: Nucleus): Promise<string>;
    update(id: string, changes: Partial<Nucleus>): Promise<void>;
    where(field: string): {
      equals(value: string): {
        sortBy(field: string): Promise<Nucleus[]>;
        filter(fn: (item: Nucleus) => boolean): { sortBy(field: string): Promise<Nucleus[]> };
      };
    };
    orderBy(field: string): { toArray(): Promise<Nucleus[]> };
  };
}

export type NucleusCreateInput = Omit<Nucleus, "nucleusId" | "createdAt" | "updatedAt">;

export class NucleusRepository {
  constructor(private db: NucleusDB) {}

  async getById(id: string): Promise<Nucleus | undefined> {
    return this.db.nuclei.get(id);
  }

  async create(data: NucleusCreateInput): Promise<string> {
    const nucleusId = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.nuclei.add({
      ...data,
      nucleusId,
      createdAt: now,
      updatedAt: now,
    } as Nucleus);
    return nucleusId;
  }

  async update(id: string, changes: Partial<Nucleus>): Promise<void> {
    await this.db.nuclei.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  }

  async remove(id: string): Promise<void> {
    await this.db.nuclei.update(id, {
      status: "DELETED",
      updatedAt: new Date().toISOString(),
    } as Partial<Nucleus>);
  }

  async findActive(region?: NucleusRegion): Promise<Nucleus[]> {
    if (region) {
      return this.db.nuclei
        .where("status")
        .equals("ACTIVE")
        .filter((n) => n.region === region)
        .sortBy("name");
    }
    return this.db.nuclei.where("status").equals("ACTIVE").sortBy("name");
  }

  async listAll(): Promise<Nucleus[]> {
    return this.db.nuclei.orderBy("name").toArray();
  }
}
