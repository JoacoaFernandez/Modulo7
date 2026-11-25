// Crea el repositorio de mensajes rechazados sobre Postgres.
import { RejectedEventRepository } from "../../domain/repositories/rejected-event.repository";
import { prisma } from "../prisma-client";
import { RejectedEventRepositoryPrisma } from "./rejected-event.repository.prisma";

export const rejectedEventRepository: RejectedEventRepository = new RejectedEventRepositoryPrisma(prisma);
