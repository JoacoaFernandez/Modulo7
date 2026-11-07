// Crea el repositorio de la bandeja de entrada sobre Postgres.
import { InboxRepository } from "../../domain/repositories/inbox.repository";
import { prisma } from "../prisma-client";
import { InboxRepositoryPrisma } from "./inbox.repository.prisma";

export const inboxRepository: InboxRepository = new InboxRepositoryPrisma(prisma);
