import 'server-only';
import { headers } from 'next/headers';
import type { Prisma } from '@prisma/client';
import { db } from './db';

export function clientIp(): string {
  const h = headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim();
}

type AuditInput = {
  action: string;          // "auth.login", "auth.login_failed", "password.change", "grade.create" ...
  actorId?: number | null;
  schoolId?: number | null;
  entity?: string;
  entityId?: string | number;
  details?: Prisma.InputJsonValue;
};

/** Сабти тағйирнашаванда. Ҳеҷ гоҳ парол ё токенро ба details нагузоред. */
export async function audit(input: AuditInput, tx: Prisma.TransactionClient = db): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: input.action,
      actorId: input.actorId ?? null,
      schoolId: input.schoolId ?? null,
      entity: input.entity,
      entityId: input.entityId !== undefined ? String(input.entityId) : undefined,
      details: input.details,
      ip: clientIp(),
    },
  });
}
