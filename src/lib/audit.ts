import 'server-only';
import { headers } from 'next/headers';
import type { Prisma } from '@prisma/client';
import { db } from './db';

/**
 * IP-и муштарӣ барои маҳдудияти воридшавӣ.
 * Дар паси Render/Cloudflare X-Forwarded-For-ро муштарӣ худаш сохта метавонад, бинобар ин
 * CLIENT_IP_HEADER=true-client-ip гузоред. Дар VPS nginx X-Forwarded-For-ро иваз мекунад.
 */
export function clientIp(): string {
  const h = headers();
  const trusted = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (trusted) {
    const v = h.get(trusted);
    if (v) return v.split(',')[0].trim();
  }
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
