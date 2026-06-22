/**
 * Module: Núcleos (Células) — NucleusService
 *
 * Business logic for nuclei CRUD. Wraps NucleusRepository with
 * role-based authorization (ADMIN only for mutations).
 *
 * @license BSL-1.1
 */

import type { NucleusRegion } from "@neemias/schemas";
import type { NucleusRepository } from "../db/repository";

export class NucleusServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NucleusServiceError";
  }
}

export class NucleusService {
  constructor(private repo: NucleusRepository) {}

  async list(region?: NucleusRegion) {
    return this.repo.findActive(region);
  }

  async add(input: {
    actorRole: string;
    region: NucleusRegion;
    name: string;
    timestamp: string;
  }): Promise<string> {
    if (input.actorRole !== "ADMIN") {
      throw new NucleusServiceError("UNAUTHORIZED");
    }
    const name = input.name.trim();
    if (!name) throw new NucleusServiceError("INVALID_NAME");
    return this.repo.create({
      region: input.region,
      name,
      status: "ACTIVE",
    });
  }

  async update(input: {
    actorRole: string;
    nucleusId: string;
    region?: NucleusRegion;
    name?: string;
    timestamp: string;
  }): Promise<void> {
    if (input.actorRole !== "ADMIN") {
      throw new NucleusServiceError("UNAUTHORIZED");
    }
    const existing = await this.repo.getById(input.nucleusId);
    if (!existing) throw new NucleusServiceError("NOT_FOUND");

    const changes: Record<string, unknown> = { updatedAt: input.timestamp };
    if (input.region !== undefined) changes.region = input.region;
    if (input.name !== undefined) changes.name = input.name.trim();

    await this.repo.update(input.nucleusId, changes as any);
  }

  async remove(input: { actorRole: string; nucleusId: string; timestamp: string }): Promise<void> {
    if (input.actorRole !== "ADMIN") {
      throw new NucleusServiceError("UNAUTHORIZED");
    }
    const existing = await this.repo.getById(input.nucleusId);
    if (!existing) throw new NucleusServiceError("NOT_FOUND");
    await this.repo.remove(input.nucleusId);
  }
}
