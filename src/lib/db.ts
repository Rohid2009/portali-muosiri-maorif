import { PrismaClient } from '@prisma/client';

// Як нусха дар dev (hot reload), то пайвастҳо зиёд нашаванд.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
