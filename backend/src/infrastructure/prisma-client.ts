// Infrastructure: cliente de Prisma compartido por todos los repositorios del proceso.
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
