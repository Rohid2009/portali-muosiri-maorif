// «Портали муосири маориф» — сервер дар Supabase Edge Functions.
// Ҳамаи санҷиши ҳуқуқҳо (RBAC) ин ҷо аст; интерфейс танҳо дархост мефиристад.
// Пайваст: SUPABASE_DB_URL (Supabase худаш медиҳад), схемаи "maorif".
import postgres from 'npm:postgres@3.4.5';
import bcrypt from 'npm:bcryptjs@2.4.3';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, {
  max: 3,
  prepare: false,
  idle_timeout: 20,
  connection: { search_path: 'maorif', application_name: 'maorif-api' },
});

const TZ = 'Asia/Dushanbe';
const SESSION_DAYS = 30;
const BCRYPT_COST = 10;

// ───────────────────────── ёрирасонҳо ─────────────────────────
class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const fail = (m: string, s = 400): never => { throw new ApiError(m, s); };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-session, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

function todayISO(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
const isIso = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const int = (v: unknown): number => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) fail('Маълумоти нодуруст'); return n; };
const optInt = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : int(v));

export function roundGrade(v: number): number {
  const f = Math.round(v * 100) / 100; const w = Math.floor(f);
  return f - w >= 0.5 ? w + 1 : w;
}
export function quarterGrade(gs: number[]): number | null {
  const v = gs.filter((g) => Number.isInteger(g) && g >= 1 && g <= 10);
  return v.length ? roundGrade(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let d = input.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9) d = '992' + d;
  return /^992\d{9}$/.test(d) ? d : null;
}
export function shortName(full: string): string {
  const p = full.trim().split(/\s+/);
  if (p.length < 2) return p[0] ? `${p[0][0]}.` : '';
  return `${p[1]} ${p[0][0]}.`;
}
export function normalizeClassName(input: unknown): { gradeLevel: number; letter: string; name: string } | null {
  const m = str(input, 20).toUpperCase().match(/^(\d{1,2})\s*[-–—]?\s*([A-ZА-ЯЁҒӢҚӮҲҶ]?)$/u);
  if (!m) return null;
  const g = Number(m[1]); if (g < 1 || g > 11) return null;
  return { gradeLevel: g, letter: m[2] || '', name: m[2] ? `${g}-${m[2]}` : String(g) };
}
const PW_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
function generatePassword(len = 10): string {
  for (;;) {
    const b = crypto.getRandomValues(new Uint8Array(len));
    const p = Array.from(b, (x) => PW_CHARS[x % PW_CHARS.length]).join('');
    if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)) return p;
  }
}
function validatePassword(p: unknown): string {
  if (typeof p !== 'string' || p.length < 8) fail('Парол камаш 8 аломат бошад.');
  if ((p as string).length > 72) fail('Парол хеле дароз аст.');
  if (!/[A-Za-zА-Яа-яЁё]/.test(p as string) || !/\d/.test(p as string)) fail('Паролда ҳам ҳарф, ҳам рақам бошад.');
  return p as string;
}
function validateLogin(l: unknown): string {
  const v = typeof l === 'string' ? l.trim().toLowerCase() : '';
  if (!/^[a-z0-9._-]{3,32}$/.test(v)) fail('Логин: 3–32 аломат, танҳо ҳарфҳои лотинӣ, рақам ва . _ -');
  return v;
}
async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, '0')).join('');
}
function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function clientIp(req: Request): string {
  return (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim().slice(0, 64);
}

type Role = 'DIRECTOR' | 'SPECIALIST' | 'TEACHER' | 'PARENT' | 'DISTRICT_ADMIN';
type Me = { id: number; schoolId: number; role: Role; fullName: string; login: string; phone: string | null; phoneVisible: boolean; mustChangePassword: boolean };
const STAFF: Role[] = ['DIRECTOR', 'SPECIALIST'];
const ROLE_TJ: Record<string, string> = { DIRECTOR: 'Мудир', SPECIALIST: 'Мутахассис', TEACHER: 'Омӯзгор', PARENT: 'Волид', DISTRICT_ADMIN: 'Админ' };

async function audit(action: string, actorId: number | null, schoolId: number | null, entity?: string, entityId?: string | number | null, details?: unknown, ip?: string) {
  await sql`insert into "AuditLog" ("schoolId","actorId",action,entity,"entityId",details,ip)
    values (${schoolId}, ${actorId}, ${action}, ${entity ?? null}, ${entityId == null ? null : String(entityId)}, ${details == null ? null : sql.json(details as never)}, ${ip ?? null})`;
}

async function school() {
  const [s] = await sql`select s.id, s.name, s.district, st."allowParentSignup", st."maxLoginAttempts", st."lockMinutes", st."parentMustChangePassword"
    from "School" s left join "SchoolSettings" st on st."schoolId" = s.id where s."isActive" order by s.id limit 1`;
  return s ?? null;
}

async function context(schoolId: number) {
  const today = todayISO();
  const [year] = await sql`select id, name, "startDate"::text as start, "endDate"::text as "end" from "AcademicYear" where "schoolId"=${schoolId} and "isCurrent" limit 1`;
  const quarters = year
    ? await sql`select number, "startDate"::text as start, "endDate"::text as "end", "isClosed" as closed from "Quarter" where "academicYearId"=${year.id} order by number`
    : [];
  const current = quarters.find((q) => q.start <= today && today <= q.end) ?? null;
  return { today, year: year ?? null, quarters: [...quarters], quarter: current };
}

async function auth(req: Request): Promise<Me> {
  const token = req.headers.get('x-session');
  if (!token || token.length < 20) fail('Лутфан ворид шавед.', 401);
  const id = await sha256(token!);
  const [u] = await sql`select u.id, u."schoolId", u.role, u."fullName", u.login, u.phone, u."phoneVisible", u."mustChangePassword", s."lastSeenAt"
    from "Session" s join "User" u on u.id = s."userId"
    where s.id=${id} and s."expiresAt" > now() and u."isActive"`;
  if (!u) fail('Вақти воридшавӣ гузашт. Лутфан аз нав ворид шавед.', 401);
  if (Date.now() - new Date(u.lastSeenAt).getTime() > 3600_000) {
    await sql`update "Session" set "lastSeenAt"=now(), "expiresAt"=now() + ${SESSION_DAYS + ' days'}::interval where id=${id}`;
  }
  const { lastSeenAt: _x, ...me } = u;
  return me as unknown as Me;
}
function need(me: Me, roles: Role[]) {
  if (!roles.includes(me.role)) fail('Барои шумо иҷозат нест.', 403);
  if (me.mustChangePassword) fail('Аввал пароли худро иваз кунед.', 403);
}
function canManage(me: Me, targetRole: Role): boolean {
  if (me.role === 'DIRECTOR') return ['SPECIALIST', 'TEACHER', 'PARENT'].includes(targetRole);
  if (me.role === 'SPECIALIST') return ['TEACHER', 'PARENT'].includes(targetRole);
  return false;
}
async function uniqueLogin(prefix: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const l = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
    const [x] = await sql`select 1 from "User" where login=${l}`;
    if (!x) return l;
  }
  fail('Логин сохта нашуд, боз кӯшиш кунед.');
  return '';
}
async function createSession(userId: number): Promise<string> {
  const token = randomToken();
  await sql`insert into "Session" (id,"userId","expiresAt") values (${await sha256(token)}, ${userId}, now() + ${SESSION_DAYS + ' days'}::interval)`;
  return token;
}
function publicUser(u: Record<string, unknown>) {
  return { id: u.id, role: u.role, roleTj: ROLE_TJ[u.role as string], fullName: u.fullName, login: u.login, phone: u.phone, phoneVisible: u.phoneVisible, mustChangePassword: u.mustChangePassword };
}
async function currentYearOrFail(schoolId: number) {
  const [y] = await sql`select id, "startDate"::text as start from "AcademicYear" where "schoolId"=${schoolId} and "isCurrent" limit 1`;
  if (!y) fail('Аввал соли таҳсилро созед (бахши «Сол ва чорякҳо»).');
  return y;
}

// ───────────────────────── амалҳо ─────────────────────────
type Ctx = { req: Request; ip: string; body: Record<string, unknown> };
type Handler = (c: Ctx) => Promise<unknown>;

const PUBLIC: Record<string, Handler> = {
  async meta() {
    const s = await school();
    if (!s) return { ready: false };
    const ctx = await context(s.id);
    return { ready: true, school: { name: s.name, district: s.district }, allowSignup: s.allowParentSignup, today: ctx.today, year: ctx.year, quarter: ctx.quarter };
  },

  async setup({ body, ip }) {
    const [n] = await sql`select count(*)::int as n from "User"`;
    if (n.n > 0) fail('Портал аллакай танзим шудааст.', 403);
    const pw = validatePassword(body.password);
    const hash = await bcrypt.hash(pw, BCRYPT_COST);
    const out = await sql.begin(async (t) => {
      const [s] = await t`insert into "School" (name, district) values ('МТМУ №12', 'Зафаробод') returning id`;
      await t`insert into "SchoolSettings" ("schoolId") values (${s.id})`;
      const [u] = await t`insert into "User" ("schoolId", role, "fullName", login, "passwordHash", "mustChangePassword")
        values (${s.id}, 'DIRECTOR', 'Мудири мактаб', 'mudir', ${hash}, true) returning id`;
      return { schoolId: s.id, userId: u.id };
    });
    await audit('setup', out.userId, out.schoolId, 'School', out.schoolId, null, ip);
    return { login: 'mudir' };
  },

  async login({ body, ip }) {
    const raw = str(body.login, 64).toLowerCase();
    const pw = typeof body.password === 'string' ? body.password : '';
    if (!raw || !pw) fail('Логин ва паролро нависед.');
    const [ipf] = await sql`select count(*)::int as n from "LoginAttempt" where ip=${ip} and not success and "createdAt" > now() - interval '15 minutes'`;
    if (ipf.n >= 30) fail('Аз ин дастгоҳ кӯшишҳо зиёданд. 15 дақиқа сабр кунед.', 429);
    const phone = normalizePhone(raw);
    const [u] = await sql`select u.*, st."maxLoginAttempts", st."lockMinutes" from "User" u left join "SchoolSettings" st on st."schoolId"=u."schoolId"
      where u.login=${raw} or (${phone}::text is not null and u.phone=${phone}) limit 1`;
    const bad = async () => { await sql`insert into "LoginAttempt" (ip, login, success) values (${ip}, ${raw}, false)`; fail('Логин ё парол нодуруст аст.', 401); };
    if (!u || !u.isActive) return bad();
    if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) {
      const min = Math.ceil((new Date(u.lockedUntil).getTime() - Date.now()) / 60000);
      fail(`Ҳисоб муваққатан баста аст. ${min} дақиқа баъд кӯшиш кунед.`, 429);
    }
    const ok = await bcrypt.compare(pw, u.passwordHash);
    if (!ok) {
      const max = u.maxLoginAttempts ?? 5, lock = u.lockMinutes ?? 15;
      const f = u.failedAttempts + 1;
      await sql`update "User" set "failedAttempts"=${f >= max ? 0 : f}, "lockedUntil"=${f >= max ? sql`now() + ${lock + ' minutes'}::interval` : null} where id=${u.id}`;
      await audit('auth.login_failed', u.id, u.schoolId, 'User', u.id, null, ip);
      return bad();
    }
    await sql`update "User" set "failedAttempts"=0, "lockedUntil"=null where id=${u.id}`;
    await sql`insert into "LoginAttempt" (ip, login, success) values (${ip}, ${raw}, true)`;
    await audit('auth.login', u.id, u.schoolId, 'User', u.id, null, ip);
    return { token: await createSession(u.id), user: publicUser(u) };
  },

  async signupOptions() {
    const s = await school();
    if (!s || !s.allowParentSignup) return { allowed: false, classes: [] };
    const rows = await sql`select c.id as "classId", c.name as "className", c."gradeLevel", st.id, st."fullName"
      from "Class" c join "AcademicYear" y on y.id=c."academicYearId" and y."isCurrent"
      join "ClassEnrollment" e on e."classId"=c.id join "Student" st on st.id=e."studentId" and st.status in ('ACTIVE','ABROAD')
      where c."schoolId"=${s.id} order by c."gradeLevel", c.name, st."fullName"`;
    const map = new Map<number, { classId: number; name: string; students: { id: number; name: string }[] }>();
    for (const r of rows) {
      if (!map.has(r.classId)) map.set(r.classId, { classId: r.classId, name: r.className, students: [] });
      map.get(r.classId)!.students.push({ id: r.id, name: shortName(r.fullName) });
    }
    return { allowed: true, classes: [...map.values()] };
  },

  async register({ body, ip }) {
    const s = await school();
    if (!s || !s.allowParentSignup) fail('Сабти номи волидон ҳоло баста аст.');
    const [r] = await sql`select count(*)::int as n from "LoginAttempt" where ip=${ip} and login='#signup' and "createdAt" > now() - interval '1 hour'`;
    if (r.n >= 5) fail('Аз ин дастгоҳ сабти ном зиёд шуд. Баъдтар кӯшиш кунед.', 429);
    await sql`insert into "LoginAttempt" (ip, login, success) values (${ip}, '#signup', true)`;
    const fullName = str(body.fullName, 120);
    if (fullName.length < 5 || !/\s/.test(fullName)) fail('Ному насабро пурра нависед.');
    const phone = normalizePhone(body.phone);
    if (!phone) fail('Рақами телефон нодуруст аст (масалан 90 123 4567).');
    const pw = validatePassword(body.password);
    const ids = Array.isArray(body.studentIds) ? [...new Set(body.studentIds.map(int))] : [];
    if (!ids.length || ids.length > 8) fail('Фарзанди худро аз рӯйхат интихоб кунед.');
    const relation = ['падар', 'модар', 'сарпараст'].includes(String(body.relation)) ? String(body.relation) : null;
    const [exists] = await sql`select 1 from "User" where phone=${phone} or login=${phone}`;
    if (exists) fail('Ин рақам аллакай сабт шудааст. Бо рақам ва пароли худ ворид шавед.');
    const found = await sql`select id from "Student" where "schoolId"=${s.id} and id in ${sql(ids)}`;
    if (found.length !== ids.length) fail('Хонанда ёфт нашуд.');
    const hash = await bcrypt.hash(pw, BCRYPT_COST);
    const u = await sql.begin(async (t) => {
      const [u] = await t`insert into "User" ("schoolId", role, "fullName", login, phone, "passwordHash", "mustChangePassword")
        values (${s.id}, 'PARENT', ${fullName}, ${phone}, ${phone}, ${hash}, false) returning *`;
      for (const sid of ids) await t`insert into "ParentLinkRequest" ("schoolId","parentUserId","studentId",relation) values (${s.id}, ${u.id}, ${sid}, ${relation})`;
      return u;
    });
    await audit('parent.register', u.id, s.id, 'User', u.id, { students: ids }, ip);
    return { token: await createSession(u.id), user: publicUser(u) };
  },
};

type AuthHandler = (c: Ctx & { me: Me }) => Promise<unknown>;

const PRIVATE: Record<string, AuthHandler> = {
  // ── ҳисоби худ ──
  async me({ me }) {
    const ctx = await context(me.schoolId);
    const s = await school();
    const [unread] = await sql`select count(*)::int as n from "Conversation" c where c."lastSenderId" is not null and c."lastSenderId" <> ${me.id}
      and ((c."teacherId"=${me.id} and (c."teacherReadAt" is null or c."teacherReadAt" < c."lastMessageAt"))
        or (c."parentId"=${me.id} and (c."parentReadAt" is null or c."parentReadAt" < c."lastMessageAt")))`;
    let pending = 0;
    if (STAFF.includes(me.role)) {
      const [p] = await sql`select count(*)::int as n from "ParentLinkRequest" where "schoolId"=${me.schoolId} and status='PENDING'`;
      pending = p.n;
    }
    return { user: { ...publicUser(me as unknown as Record<string, unknown>) }, school: { name: s?.name, district: s?.district }, ...ctx, unread: unread.n, pending };
  },
  async logout({ req }) {
    await sql`delete from "Session" where id=${await sha256(req.headers.get('x-session') || '')}`;
    return {};
  },
  async changePassword({ me, body, ip }) {
    const [u] = await sql`select "passwordHash" from "User" where id=${me.id}`;
    if (!(await bcrypt.compare(String(body.oldPassword ?? ''), u.passwordHash))) fail('Пароли ҳозира нодуруст аст.');
    const pw = validatePassword(body.newPassword);
    if (pw === body.oldPassword) fail('Пароли нав бояд аз пешина фарқ кунад.');
    await sql`update "User" set "passwordHash"=${await bcrypt.hash(pw, BCRYPT_COST)}, "mustChangePassword"=false where id=${me.id}`;
    await sql`delete from "Session" where "userId"=${me.id} and id <> ${await sha256(String((body as Record<string, unknown>).__token ?? ''))}`;
    await audit('password.change', me.id, me.schoolId, 'User', me.id, null, ip);
    return {};
  },
  async changeLogin({ me, body, ip }) {
    const [u] = await sql`select "passwordHash" from "User" where id=${me.id}`;
    if (!(await bcrypt.compare(String(body.password ?? ''), u.passwordHash))) fail('Пароли ҳозира нодуруст аст.');
    const login = validateLogin(body.login);
    const [x] = await sql`select 1 from "User" where login=${login} and id<>${me.id}`;
    if (x) fail('Ин логин банд аст.');
    await sql`update "User" set login=${login} where id=${me.id}`;
    await audit('login.change', me.id, me.schoolId, 'User', me.id, { login }, ip);
    return { login };
  },
  async updateContact({ me, body }) {
    const raw = str(body.phone, 30);
    const phone = raw ? normalizePhone(raw) : null;
    if (raw && !phone) fail('Рақами телефон нодуруст аст.');
    if (me.role === 'PARENT' && !phone) fail('Волид бояд рақами телефон дошта бошад.');
    if (phone) { const [x] = await sql`select 1 from "User" where phone=${phone} and id<>${me.id}`; if (x) fail('Ин рақам ба ҳисоби дигар тааллуқ дорад.'); }
    await sql`update "User" set phone=${phone}, "phoneVisible"=${body.phoneVisible !== false} where id=${me.id}`;
    return { phone, phoneVisible: body.phoneVisible !== false };
  },

  // ── мутахассис ва мудир ──
  async 'sp.overview'({ me }) {
    need(me, STAFF);
    const ctx = await context(me.schoolId);
    const [c] = await sql`select
      (select count(*)::int from "User" where "schoolId"=${me.schoolId} and role='TEACHER' and "isActive") as teachers,
      (select count(*)::int from "User" where "schoolId"=${me.schoolId} and role='PARENT' and "isActive") as parents,
      (select count(*)::int from "Student" where "schoolId"=${me.schoolId} and status='ACTIVE') as students,
      (select count(*)::int from "Class" c join "AcademicYear" y on y.id=c."academicYearId" and y."isCurrent" where c."schoolId"=${me.schoolId}) as classes,
      (select count(*)::int from "Subject" where "schoolId"=${me.schoolId}) as subjects,
      (select count(*)::int from "ParentLinkRequest" where "schoolId"=${me.schoolId} and status='PENDING') as pending,
      (select count(*)::int from "JournalEntry" where "schoolId"=${me.schoolId} and "lessonDate"=${ctx.today}) as "todayEntries",
      (select count(*)::int from "JournalEntry" where "schoolId"=${me.schoolId} and "lessonDate"=${ctx.today} and attendance<>'PRESENT') as "todayAbsent"`;
    return { ...c, ...ctx };
  },

  async 'sp.years'({ me }) {
    need(me, STAFF);
    const years = await sql`select id, name, "startDate"::text as start, "endDate"::text as "end", "isCurrent" from "AcademicYear" where "schoolId"=${me.schoolId} order by "startDate" desc`;
    const qs = await sql`select "academicYearId" as y, number, "startDate"::text as start, "endDate"::text as "end", "isClosed" as closed from "Quarter" where "schoolId"=${me.schoolId} order by number`;
    return { today: todayISO(), years: years.map((y) => ({ ...y, quarters: qs.filter((q) => q.y === y.id) })) };
  },
  async 'sp.saveYear'({ me, body, ip }) {
    need(me, STAFF);
    const name = str(body.name, 20);
    if (!/^\d{4}[-–]\d{4}$/.test(name)) fail('Номи сол: масалан 2026-2027');
    const qs = Array.isArray(body.quarters) ? body.quarters as Record<string, unknown>[] : [];
    if (qs.length !== 4) fail('Санаҳои ҳар 4 чорякро нависед.');
    let prevEnd = '';
    qs.forEach((q, i) => {
      if (!isIso(q.start) || !isIso(q.end)) fail(`Чоряки ${i + 1}: санаҳоро пурра нависед.`);
      if ((q.start as string) > (q.end as string)) fail(`Чоряки ${i + 1}: оғоз аз анҷом пештар бошад.`);
      if (prevEnd && (q.start as string) <= prevEnd) fail(`Чоряки ${i + 1} бояд баъд аз чоряки ${i} сар шавад.`);
      prevEnd = q.end as string;
    });
    const start = qs[0].start as string, end = qs[3].end as string;
    const id = optInt(body.id);
    const yearId = await sql.begin(async (t) => {
      let yid = id;
      if (yid) {
        const [y] = await t`update "AcademicYear" set name=${name.replace('–', '-')}, "startDate"=${start}, "endDate"=${end} where id=${yid} and "schoolId"=${me.schoolId} returning id`;
        if (!y) fail('Сол ёфт нашуд.');
      } else {
        const [d] = await t`select 1 from "AcademicYear" where "schoolId"=${me.schoolId} and name=${name}`;
        if (d) fail('Чунин сол аллакай ҳаст.');
        const [y] = await t`insert into "AcademicYear" ("schoolId", name, "startDate", "endDate") values (${me.schoolId}, ${name.replace('–', '-')}, ${start}, ${end}) returning id`;
        yid = y.id;
      }
      for (let i = 0; i < 4; i++) {
        await t`insert into "Quarter" ("schoolId","academicYearId",number,"startDate","endDate") values (${me.schoolId}, ${yid}, ${i + 1}, ${qs[i].start as string}, ${qs[i].end as string})
          on conflict ("academicYearId", number) do update set "startDate"=excluded."startDate", "endDate"=excluded."endDate"`;
      }
      const [anyCur] = await t`select 1 from "AcademicYear" where "schoolId"=${me.schoolId} and "isCurrent"`;
      if (body.makeCurrent || !anyCur) {
        await t`update "AcademicYear" set "isCurrent"=(id=${yid}) where "schoolId"=${me.schoolId}`;
      }
      return yid;
    });
    await audit('year.save', me.id, me.schoolId, 'AcademicYear', yearId, { name, quarters: qs }, ip);
    return { id: yearId };
  },

  async 'sp.subjects'({ me }) {
    need(me, STAFF);
    return await sql`select s.id, s.name, (select count(*)::int from "TeachingAssignment" a where a."subjectId"=s.id and a."activeTo" is null) as teachers
      from "Subject" s where s."schoolId"=${me.schoolId} order by s.name`;
  },
  async 'sp.saveSubject'({ me, body, ip }) {
    need(me, STAFF);
    const names = (Array.isArray(body.names) ? body.names : [body.name]).map((n) => str(n, 80)).filter(Boolean);
    if (!names.length) fail('Номи фанро нависед.');
    const id = optInt(body.id);
    if (id) {
      const [d] = await sql`select 1 from "Subject" where "schoolId"=${me.schoolId} and lower(name)=lower(${names[0]}) and id<>${id}`;
      if (d) fail('Чунин фан аллакай ҳаст.');
      await sql`update "Subject" set name=${names[0]} where id=${id} and "schoolId"=${me.schoolId}`;
    } else {
      for (const n of names) await sql`insert into "Subject" ("schoolId", name) values (${me.schoolId}, ${n}) on conflict do nothing`;
    }
    await audit(id ? 'subject.rename' : 'subject.create', me.id, me.schoolId, 'Subject', id, { names }, ip);
    return {};
  },
  async 'sp.deleteSubject'({ me, body, ip }) {
    need(me, STAFF);
    const id = int(body.id);
    const [e] = await sql`select 1 from "JournalEntry" where "subjectId"=${id} limit 1`;
    if (e) fail('Дар ин фан баҳо гузошта шудааст — нест кардан мумкин нест.');
    await sql.begin(async (t) => {
      await t`delete from "ScheduleLesson" where "subjectId"=${id} and "schoolId"=${me.schoolId}`;
      await t`delete from "TeachingAssignment" where "subjectId"=${id} and "schoolId"=${me.schoolId}`;
      await t`delete from "Subject" where id=${id} and "schoolId"=${me.schoolId}`;
    });
    await audit('subject.delete', me.id, me.schoolId, 'Subject', id, null, ip);
    return {};
  },

  async 'sp.classes'({ me }) {
    need(me, STAFF);
    return await sql`select c.id, c.name, c."gradeLevel",
      (select count(*)::int from "ClassEnrollment" e join "Student" s on s.id=e."studentId" where e."classId"=c.id and s.status in ('ACTIVE','ABROAD')) as students
      from "Class" c join "AcademicYear" y on y.id=c."academicYearId" and y."isCurrent" where c."schoolId"=${me.schoolId} order by c."gradeLevel", c.name`;
  },
  async 'sp.saveClass'({ me, body, ip }) {
    need(me, STAFF);
    const y = await currentYearOrFail(me.schoolId);
    const list = (Array.isArray(body.names) ? body.names : [body.name]).map(String).flatMap((s) => s.split(/[,;\n]+/)).map((s) => s.trim()).filter(Boolean);
    if (!list.length) fail('Номи синфро нависед (масалан 8-А).');
    const parsed = list.map((n) => { const p = normalizeClassName(n); if (!p) fail(`Номи синф нодуруст: «${n}». Масалан: 5-А, 11-Б`); return p!; });
    const id = optInt(body.id);
    if (id) {
      const p = parsed[0];
      const [d] = await sql`select 1 from "Class" where "academicYearId"=${y.id} and name=${p.name} and id<>${id}`;
      if (d) fail('Чунин синф аллакай ҳаст.');
      await sql`update "Class" set name=${p.name}, "gradeLevel"=${p.gradeLevel}, letter=${p.letter} where id=${id} and "schoolId"=${me.schoolId}`;
    } else {
      for (const p of parsed) await sql`insert into "Class" ("schoolId","academicYearId","gradeLevel",letter,name) values (${me.schoolId}, ${y.id}, ${p.gradeLevel}, ${p.letter}, ${p.name}) on conflict do nothing`;
    }
    await audit(id ? 'class.rename' : 'class.create', me.id, me.schoolId, 'Class', id, { names: parsed.map((p) => p.name) }, ip);
    return {};
  },
  async 'sp.deleteClass'({ me, body, ip }) {
    need(me, STAFF);
    const id = int(body.id);
    const [e] = await sql`select 1 from "JournalEntry" where "classId"=${id} limit 1`;
    if (e) fail('Дар ин синф баҳо ҳаст — нест кардан мумкин нест.');
    const [s] = await sql`select 1 from "ClassEnrollment" where "classId"=${id} limit 1`;
    if (s) fail('Дар синф хонанда ҳаст. Аввал хонандагонро ба синфи дигар гузаронед ё нест кунед.');
    await sql.begin(async (t) => {
      await t`delete from "ScheduleLesson" where "classId"=${id} and "schoolId"=${me.schoolId}`;
      await t`delete from "TeachingAssignment" where "classId"=${id} and "schoolId"=${me.schoolId}`;
      await t`delete from "Class" where id=${id} and "schoolId"=${me.schoolId}`;
    });
    await audit('class.delete', me.id, me.schoolId, 'Class', id, null, ip);
    return {};
  },

  async 'sp.students'({ me, body }) {
    need(me, STAFF);
    const classId = int(body.classId);
    return await sql`select s.id, s."fullName", s.status, e."classId",
      (select string_agg(u."fullName" || coalesce(' (' || u.phone || ')', ''), ', ') from "ParentStudent" ps join "User" u on u.id=ps."parentUserId" where ps."studentId"=s.id) as parents
      from "ClassEnrollment" e join "Student" s on s.id=e."studentId" where e."classId"=${classId} and s."schoolId"=${me.schoolId} order by s."fullName"`;
  },
  async 'sp.addStudents'({ me, body, ip }) {
    need(me, STAFF);
    const y = await currentYearOrFail(me.schoolId);
    const classId = int(body.classId);
    const [c] = await sql`select id from "Class" where id=${classId} and "schoolId"=${me.schoolId} and "academicYearId"=${y.id}`;
    if (!c) fail('Синф ёфт нашуд.');
    const names = String(body.names ?? '').split('\n').map((n) => str(n, 120)).filter((n) => n.length >= 3);
    if (!names.length) fail('Ному насаби хонандагонро нависед (ҳар сатр — як хонанда).');
    if (names.length > 60) fail('Якбора то 60 хонанда.');
    await sql.begin(async (t) => {
      for (const n of names) {
        const [s] = await t`insert into "Student" ("schoolId","fullName") values (${me.schoolId}, ${n}) returning id`;
        await t`insert into "ClassEnrollment" ("schoolId","studentId","classId","academicYearId") values (${me.schoolId}, ${s.id}, ${classId}, ${y.id})`;
      }
    });
    await audit('student.create', me.id, me.schoolId, 'Class', classId, { count: names.length }, ip);
    return { added: names.length };
  },
  async 'sp.updateStudent'({ me, body, ip }) {
    need(me, STAFF);
    const id = int(body.id);
    const fullName = str(body.fullName, 120);
    if (fullName.length < 3) fail('Ному насабро нависед.');
    const status = ['ACTIVE', 'ABROAD', 'EXPELLED', 'GRADUATED'].includes(String(body.status)) ? String(body.status) : 'ACTIVE';
    const classId = optInt(body.classId);
    await sql.begin(async (t) => {
      const [s] = await t`update "Student" set "fullName"=${fullName}, status=${status} where id=${id} and "schoolId"=${me.schoolId} returning id`;
      if (!s) fail('Хонанда ёфт нашуд.');
      if (classId) {
        const [c] = await t`select "academicYearId" from "Class" where id=${classId} and "schoolId"=${me.schoolId}`;
        if (!c) fail('Синф ёфт нашуд.');
        await t`insert into "ClassEnrollment" ("schoolId","studentId","classId","academicYearId") values (${me.schoolId}, ${id}, ${classId}, ${c.academicYearId})
          on conflict ("studentId","academicYearId") do update set "classId"=excluded."classId"`;
      }
    });
    await audit('student.update', me.id, me.schoolId, 'Student', id, { fullName, status, classId }, ip);
    return {};
  },
  async 'sp.deleteStudent'({ me, body, ip }) {
    need(me, STAFF);
    const id = int(body.id);
    const [e] = await sql`select 1 from "JournalEntry" where "studentId"=${id} limit 1`;
    if (e) fail('Хонанда баҳо дорад — нест кардан мумкин нест. Ҳолаташро «Хориҷ шуд» гузоред.');
    await sql.begin(async (t) => {
      await t`delete from "ParentLinkRequest" where "studentId"=${id} and "schoolId"=${me.schoolId}`;
      await t`delete from "ParentStudent" where "studentId"=${id} and "schoolId"=${me.schoolId}`;
      await t`delete from "PeriodGrade" where "studentId"=${id} and "schoolId"=${me.schoolId}`;
      await t`delete from "ExcuseDocument" where "studentId"=${id} and "schoolId"=${me.schoolId}`;
      await t`delete from "ClassEnrollment" where "studentId"=${id} and "schoolId"=${me.schoolId}`;
      await t`delete from "Student" where id=${id} and "schoolId"=${me.schoolId}`;
    });
    await audit('student.delete', me.id, me.schoolId, 'Student', id, null, ip);
    return {};
  },

  async 'sp.teachers'({ me }) {
    need(me, STAFF);
    const ts = await sql`select id, "fullName", login, phone, "isActive", "mustChangePassword" from "User" where "schoolId"=${me.schoolId} and role='TEACHER' order by "isActive" desc, "fullName"`;
    const as = await sql`select a.id, a."teacherId", a."classId", a."subjectId", c.name as "className", s.name as "subjectName"
      from "TeachingAssignment" a join "Class" c on c.id=a."classId" join "Subject" s on s.id=a."subjectId" join "AcademicYear" y on y.id=a."academicYearId" and y."isCurrent"
      where a."schoolId"=${me.schoolId} and a."activeTo" is null order by s.name, c."gradeLevel", c.name`;
    return ts.map((t) => ({ ...t, assignments: as.filter((a) => a.teacherId === t.id) }));
  },
  async 'sp.saveTeacher'({ me, body, ip }) {
    need(me, STAFF);
    const fullName = str(body.fullName, 120);
    if (fullName.length < 5) fail('Ному насаби омӯзгорро пурра нависед.');
    const rawPhone = str(body.phone, 30);
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (rawPhone && !phone) fail('Рақами телефон нодуруст аст.');
    const list = Array.isArray(body.assignments) ? (body.assignments as Record<string, unknown>[]).map((a) => ({ classId: int(a.classId), subjectId: int(a.subjectId) })) : [];
    const id = optInt(body.id);
    if (phone) { const [x] = await sql`select 1 from "User" where phone=${phone} and id is distinct from ${id}`; if (x) fail('Ин рақам ба ҳисоби дигар тааллуқ дорад.'); }
    const today = todayISO();
    let creds: { login: string; password: string } | null = null;
    const teacherId: number = await sql.begin(async (t) => {
      let tid = id;
      if (tid) {
        const [u] = await t`update "User" set "fullName"=${fullName}, phone=${phone} where id=${tid} and "schoolId"=${me.schoolId} and role='TEACHER' returning id`;
        if (!u) fail('Омӯзгор ёфт нашуд.');
      } else {
        const login = await uniqueLogin('omuz');
        const password = generatePassword();
        const [u] = await t`insert into "User" ("schoolId", role, "fullName", login, phone, "passwordHash", "mustChangePassword")
          values (${me.schoolId}, 'TEACHER', ${fullName}, ${login}, ${phone}, ${await bcrypt.hash(password, BCRYPT_COST)}, true) returning id`;
        tid = u.id; creds = { login, password };
      }
      if (list.length || id) {
        const [y] = await t`select id, "startDate"::text as start from "AcademicYear" where "schoolId"=${me.schoolId} and "isCurrent"`;
        if (!y && list.length) fail('Аввал соли таҳсилро созед.');
        if (y) {
          const from = today < y.start ? y.start : today;
          const cur = await t`select id, "classId", "subjectId", "activeFrom"::text as "from" from "TeachingAssignment" where "teacherId"=${tid} and "academicYearId"=${y.id} and "activeTo" is null`;
          const key = (a: { classId: number; subjectId: number }) => `${a.classId}:${a.subjectId}`;
          const want = new Set(list.map(key));
          for (const a of cur) {
            if (want.has(key(a))) continue;
            const [e] = await t`select 1 from "JournalEntry" where "classId"=${a.classId} and "subjectId"=${a.subjectId} and "enteredById"=${tid} limit 1`;
            if (e) await t`update "TeachingAssignment" set "activeTo"=${today} where id=${a.id}`;
            else await t`delete from "TeachingAssignment" where id=${a.id}`;
          }
          const have = new Set(cur.map(key));
          for (const a of list) {
            if (have.has(key(a))) continue;
            const [ok] = await t`select 1 from "Class" c, "Subject" s where c.id=${a.classId} and c."schoolId"=${me.schoolId} and c."academicYearId"=${y.id} and s.id=${a.subjectId} and s."schoolId"=${me.schoolId}`;
            if (!ok) fail('Синф ё фан ёфт нашуд.');
            await t`insert into "TeachingAssignment" ("schoolId","teacherId","classId","subjectId","academicYearId","activeFrom") values (${me.schoolId}, ${tid}, ${a.classId}, ${a.subjectId}, ${y.id}, ${from})`;
          }
        }
      }
      return tid!;
    });
    await audit(id ? 'teacher.update' : 'teacher.create', me.id, me.schoolId, 'User', teacherId, { fullName, assignments: list.length }, ip);
    return { id: teacherId, credentials: creds };
  },
  async 'sp.deleteUser'({ me, body, ip }) {
    need(me, STAFF);
    const id = int(body.id);
    const [u] = await sql`select id, role from "User" where id=${id} and "schoolId"=${me.schoolId}`;
    if (!u || !canManage(me, u.role)) fail('Ин корбарро идора карда наметавонед.', 403);
    const [h] = await sql`select (exists(select 1 from "JournalEntry" where "enteredById"=${id})
      or exists(select 1 from "AuditLog" where "actorId"=${id}) or exists(select 1 from "Message" where "senderId"=${id})
      or exists(select 1 from "Conversation" where "teacherId"=${id} or "parentId"=${id})) as has`;
    if (h.has) {
      await sql.begin(async (t) => {
        await t`update "User" set "isActive"=false where id=${id}`;
        await t`update "TeachingAssignment" set "activeTo"=${todayISO()} where "teacherId"=${id} and "activeTo" is null`;
        await t`delete from "Session" where "userId"=${id}`;
      });
      await audit('user.archive', me.id, me.schoolId, 'User', id, null, ip);
      return { archived: true };
    }
    await sql.begin(async (t) => {
      await t`delete from "ScheduleLesson" where "teacherId"=${id}`;
      await t`delete from "TeachingAssignment" where "teacherId"=${id}`;
      await t`delete from "ParentLinkRequest" where "parentUserId"=${id}`;
      await t`delete from "ParentStudent" where "parentUserId"=${id}`;
      await t`delete from "Session" where "userId"=${id}`;
      await t`delete from "User" where id=${id}`;
    });
    await audit('user.delete', me.id, me.schoolId, 'User', id, null, ip);
    return { deleted: true };
  },
  async 'sp.users'({ me }) {
    need(me, STAFF);
    const roles = me.role === 'DIRECTOR' ? ['SPECIALIST', 'TEACHER', 'PARENT'] : ['TEACHER', 'PARENT'];
    return await sql`select id, role, "fullName", login, phone, "isActive", "mustChangePassword", ("lockedUntil" > now()) as locked
      from "User" where "schoolId"=${me.schoolId} and role in ${sql(roles)} order by role, "fullName"`;
  },
  async 'sp.setCredentials'({ me, body, ip }) {
    need(me, STAFF);
    const id = int(body.id);
    const [u] = await sql`select id, role, login from "User" where id=${id} and "schoolId"=${me.schoolId}`;
    if (!u || !canManage(me, u.role)) fail('Ин корбарро идора карда наметавонед.', 403);
    let login = u.login as string;
    if (body.login && String(body.login).trim().toLowerCase() !== login) {
      login = validateLogin(body.login);
      const [x] = await sql`select 1 from "User" where login=${login} and id<>${id}`;
      if (x) fail('Ин логин банд аст.');
    }
    let password: string | null = null;
    if (body.passwordMode === 'random') password = generatePassword();
    else if (body.passwordMode === 'manual') password = validatePassword(body.password);
    const mustChange = body.mustChange !== false;
    if (password) {
      await sql`update "User" set login=${login}, "passwordHash"=${await bcrypt.hash(password, BCRYPT_COST)}, "mustChangePassword"=${mustChange}, "failedAttempts"=0, "lockedUntil"=null where id=${id}`;
      await sql`delete from "Session" where "userId"=${id}`;
    } else {
      await sql`update "User" set login=${login}, "failedAttempts"=0, "lockedUntil"=null where id=${id}`;
    }
    await audit('credentials.set', me.id, me.schoolId, 'User', id, { loginChanged: login !== u.login, passwordChanged: !!password }, ip);
    return { login, password };
  },
  async 'sp.setActive'({ me, body, ip }) {
    need(me, STAFF);
    const id = int(body.id);
    const [u] = await sql`select role from "User" where id=${id} and "schoolId"=${me.schoolId}`;
    if (!u || !canManage(me, u.role)) fail('Ин корбарро идора карда наметавонед.', 403);
    const active = body.active !== false;
    await sql`update "User" set "isActive"=${active} where id=${id}`;
    if (!active) await sql`delete from "Session" where "userId"=${id}`;
    await audit(active ? 'user.activate' : 'user.deactivate', me.id, me.schoolId, 'User', id, null, ip);
    return {};
  },

  async 'sp.requests'({ me }) {
    need(me, STAFF);
    return await sql`select r.id, r.relation, r.status, r."createdAt", u.id as "parentId", u."fullName" as "parentName", u.phone,
      s.id as "studentId", s."fullName" as "studentName", c.name as "className"
      from "ParentLinkRequest" r join "User" u on u.id=r."parentUserId" join "Student" s on s.id=r."studentId"
      left join "ClassEnrollment" e on e."studentId"=s.id and e."academicYearId"=(select id from "AcademicYear" where "schoolId"=${me.schoolId} and "isCurrent" limit 1)
      left join "Class" c on c.id=e."classId"
      where r."schoolId"=${me.schoolId} and r.status='PENDING' order by r."createdAt"`;
  },
  async 'sp.reviewRequest'({ me, body, ip }) {
    need(me, STAFF);
    const id = int(body.id);
    const approve = body.approve === true;
    await sql.begin(async (t) => {
      const [r] = await t`update "ParentLinkRequest" set status=${approve ? 'APPROVED' : 'REJECTED'}, "reviewedById"=${me.id}, "reviewedAt"=now()
        where id=${id} and "schoolId"=${me.schoolId} and status='PENDING' returning "parentUserId", "studentId"`;
      if (!r) fail('Дархост ёфт нашуд ё аллакай баррасӣ шудааст.');
      if (approve) await t`insert into "ParentStudent" ("parentUserId","studentId","schoolId") values (${r.parentUserId}, ${r.studentId}, ${me.schoolId}) on conflict do nothing`;
    });
    await audit(approve ? 'link.approve' : 'link.reject', me.id, me.schoolId, 'ParentLinkRequest', id, null, ip);
    return {};
  },
  async 'sp.parents'({ me }) {
    need(me, STAFF);
    return await sql`select u.id, u."fullName", u.phone, u.login, u."isActive",
      coalesce((select json_agg(json_build_object('id', s.id, 'name', s."fullName")) from "ParentStudent" ps join "Student" s on s.id=ps."studentId" where ps."parentUserId"=u.id), '[]') as children
      from "User" u where u."schoolId"=${me.schoolId} and u.role='PARENT' order by u."isActive" desc, u."fullName"`;
  },
  async 'sp.unlink'({ me, body, ip }) {
    need(me, STAFF);
    const parentId = int(body.parentId), studentId = int(body.studentId);
    await sql`delete from "ParentStudent" where "parentUserId"=${parentId} and "studentId"=${studentId} and "schoolId"=${me.schoolId}`;
    await sql`update "ParentLinkRequest" set status='REJECTED', "reviewedById"=${me.id}, "reviewedAt"=now() where "parentUserId"=${parentId} and "studentId"=${studentId}`;
    await audit('link.remove', me.id, me.schoolId, 'User', parentId, { studentId }, ip);
    return {};
  },
  async 'sp.settings'({ me, body, ip }) {
    need(me, STAFF);
    if (body.save) {
      const max = Math.min(Math.max(Number(body.maxLoginAttempts) || 5, 3), 20);
      const lock = Math.min(Math.max(Number(body.lockMinutes) || 15, 1), 1440);
      await sql`update "SchoolSettings" set "allowParentSignup"=${body.allowParentSignup !== false}, "maxLoginAttempts"=${max}, "lockMinutes"=${lock} where "schoolId"=${me.schoolId}`;
      await audit('settings.update', me.id, me.schoolId, 'SchoolSettings', me.schoolId, { allowParentSignup: body.allowParentSignup !== false, max, lock }, ip);
    }
    const [s] = await sql`select "allowParentSignup", "maxLoginAttempts", "lockMinutes" from "SchoolSettings" where "schoolId"=${me.schoolId}`;
    return s;
  },
  async 'sp.classReport'({ me, body }) {
    need(me, STAFF);
    const classId = int(body.classId);
    const ctx = await context(me.schoolId);
    const qn = Number(body.quarter) || ctx.quarter?.number || 1;
    const q = ctx.quarters.find((x) => x.number === qn);
    const students = await sql`select s.id, s."fullName", s.status from "ClassEnrollment" e join "Student" s on s.id=e."studentId" where e."classId"=${classId} and s."schoolId"=${me.schoolId} order by s."fullName"`;
    const subjects = await sql`select distinct s.id, s.name from "TeachingAssignment" a join "Subject" s on s.id=a."subjectId" where a."classId"=${classId} order by s.name`;
    const rows = q ? await sql`select "studentId", "subjectId", array_agg(grade) filter (where grade is not null) as grades,
        count(*) filter (where attendance='ABSENT')::int as absent, count(*)::int as total
      from "JournalEntry" where "classId"=${classId} and "lessonDate" between ${q.start} and ${q.end} group by 1, 2` : [];
    const grades: Record<string, number | null> = {};
    const absent: Record<number, number> = {};
    for (const r of rows) {
      grades[`${r.studentId}:${r.subjectId}`] = quarterGrade(r.grades ?? []);
      absent[r.studentId] = (absent[r.studentId] ?? 0) + r.absent;
    }
    return { quarter: qn, quarters: ctx.quarters, students, subjects, grades, absent };
  },

  // ── мудир ──
  async 'dir.audit'({ me, body }) {
    need(me, ['DIRECTOR']);
    const lim = Math.min(Number(body.limit) || 100, 300);
    return await sql`select a.id::text, a.action, a.entity, a."entityId", a.details, a.ip, a."createdAt", u."fullName" as actor, u.role
      from "AuditLog" a left join "User" u on u.id=a."actorId" where a."schoolId"=${me.schoolId} order by a.id desc limit ${lim}`;
  },
  async 'dir.createStaff'({ me, body, ip }) {
    need(me, ['DIRECTOR']);
    const fullName = str(body.fullName, 120);
    if (fullName.length < 5) fail('Ному насабро пурра нависед.');
    const login = await uniqueLogin('mut');
    const password = generatePassword();
    const [u] = await sql`insert into "User" ("schoolId", role, "fullName", login, "passwordHash", "mustChangePassword")
      values (${me.schoolId}, 'SPECIALIST', ${fullName}, ${login}, ${await bcrypt.hash(password, BCRYPT_COST)}, true) returning id`;
    await audit('specialist.create', me.id, me.schoolId, 'User', u.id, { fullName }, ip);
    return { id: u.id, credentials: { login, password } };
  },

  // ── омӯзгор ──
  async 't.assignments'({ me }) {
    need(me, ['TEACHER']);
    const today = todayISO();
    return await sql`select a.id, c.id as "classId", c.name as "className", c."gradeLevel", s.name as "subjectName",
      (select count(*)::int from "ClassEnrollment" e join "Student" st on st.id=e."studentId" where e."classId"=c.id and st.status in ('ACTIVE','ABROAD')) as students,
      (select count(*)::int from "JournalEntry" j where j."classId"=c.id and j."subjectId"=s.id and j."lessonDate"=${today}) as "todayEntries"
      from "TeachingAssignment" a join "Class" c on c.id=a."classId" join "Subject" s on s.id=a."subjectId" join "AcademicYear" y on y.id=a."academicYearId" and y."isCurrent"
      where a."teacherId"=${me.id} and a."activeFrom" <= ${today} and (a."activeTo" is null or a."activeTo" >= ${today})
      order by s.name, c."gradeLevel", c.name`;
  },
  async 't.journal'({ me, body }) {
    need(me, ['TEACHER']);
    const a = await loadAssignment(int(body.assignmentId), me);
    const ctx = await context(me.schoolId);
    const students = await sql`select s.id, s."fullName", s.status from "ClassEnrollment" e join "Student" s on s.id=e."studentId"
      where e."classId"=${a.classId} and s.status in ('ACTIVE','ABROAD') order by s."fullName"`;
    const from = ctx.year?.start ?? '1900-01-01';
    const entries = await sql`select "studentId", "lessonDate"::text as date, "lessonNo", grade, attendance, behavior from "JournalEntry"
      where "classId"=${a.classId} and "subjectId"=${a.subjectId} and "lessonDate" >= ${from} order by "lessonDate", "lessonNo"`;
    return { assignment: a, students, entries, ...ctx };
  },
  async 't.save'({ me, body, ip }) {
    need(me, ['TEACHER']);
    const a = await loadAssignment(int(body.assignmentId), me);
    const ctx = await context(me.schoolId);
    if (!ctx.quarter) fail('Имрӯз ба ягон чоряк дохил намешавад (таътил ё санаҳо муқаррар нашудаанд).');
    if (ctx.quarter!.closed) fail('Чоряк баста шудааст.');
    const lessonNo = Number(body.lessonNo) || 1;
    if (!Number.isInteger(lessonNo) || lessonNo < 1 || lessonNo > 12) fail('Рақами дарс нодуруст.');
    const rows = Array.isArray(body.rows) ? body.rows as Record<string, unknown>[] : [];
    const enrolled = new Set((await sql`select e."studentId" from "ClassEnrollment" e join "Student" s on s.id=e."studentId" where e."classId"=${a.classId} and s.status='ACTIVE'`).map((r) => r.studentId));
    const existing = await sql`select * from "JournalEntry" where "classId"=${a.classId} and "subjectId"=${a.subjectId} and "lessonDate"=${ctx.today} and "lessonNo"=${lessonNo}`;
    const byStudent = new Map(existing.map((e) => [e.studentId, e]));
    let created = 0, filled = 0, skipped = 0;
    await sql.begin(async (t) => {
      for (const r of rows) {
        const sid = int(r.studentId);
        if (!enrolled.has(sid)) continue;
        const att = ['PRESENT', 'ABSENT', 'EXCUSED'].includes(String(r.attendance)) ? String(r.attendance) : 'PRESENT';
        const grade = r.grade === null || r.grade === undefined || r.grade === '' ? null : Number(r.grade);
        if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 10)) fail('Баҳо аз 1 то 10 бошад.');
        if (grade !== null && att !== 'PRESENT') fail('Ба хонандаи ғоиб баҳо гузошта намешавад.');
        const beh = ['EXEMPLARY', 'SATISFACTORY', 'UNSATISFACTORY'].includes(String(r.behavior)) ? String(r.behavior) : null;
        const cur = byStudent.get(sid);
        if (!cur) {
          if (att === 'PRESENT' && grade === null && !beh && !r.mark) continue;
          await t`insert into "JournalEntry" ("schoolId","studentId","classId","subjectId","enteredById","lessonDate","lessonNo",grade,attendance,behavior)
            values (${me.schoolId}, ${sid}, ${a.classId}, ${a.subjectId}, ${me.id}, ${ctx.today}, ${lessonNo}, ${grade}, ${att}, ${beh})`;
          created++;
          continue;
        }
        // сабти мавҷуд иваз намешавад — танҳо ҷойи холӣ пур мешавад
        let changed = false;
        if (grade !== null && cur.grade === null && cur.attendance === 'PRESENT' && att === 'PRESENT') { await t`update "JournalEntry" set grade=${grade} where id=${cur.id}`; changed = true; }
        if (beh && !cur.behavior) { await t`update "JournalEntry" set behavior=${beh} where id=${cur.id}`; changed = true; }
        if (changed) filled++;
        else if (att !== cur.attendance || (grade !== null && grade !== cur.grade)) skipped++;
      }
    });
    await audit('journal.save', me.id, me.schoolId, 'Class', a.classId, { subjectId: a.subjectId, date: ctx.today, lessonNo, created, filled, skipped }, ip);
    return { created, filled, skipped };
  },

  // ── волид ──
  async 'p.children'({ me }) {
    need(me, ['PARENT']);
    const kids = await sql`select s.id, s."fullName", s.status, c.name as "className"
      from "ParentStudent" ps join "Student" s on s.id=ps."studentId"
      left join "ClassEnrollment" e on e."studentId"=s.id and e."academicYearId"=(select id from "AcademicYear" where "schoolId"=${me.schoolId} and "isCurrent" limit 1)
      left join "Class" c on c.id=e."classId" where ps."parentUserId"=${me.id} order by s."fullName"`;
    const reqs = await sql`select r.id, r.status, s."fullName" from "ParentLinkRequest" r join "Student" s on s.id=r."studentId" where r."parentUserId"=${me.id} and r.status<>'APPROVED' order by r."createdAt" desc`;
    return { children: kids, requests: reqs.map((r) => ({ id: r.id, status: r.status, name: shortName(r.fullName) })) };
  },
  async 'p.child'({ me, body }) {
    need(me, ['PARENT']);
    const sid = int(body.studentId);
    const [link] = await sql`select 1 from "ParentStudent" where "parentUserId"=${me.id} and "studentId"=${sid}`;
    if (!link) fail('Ин хонанда ба шумо пайваст нест.', 403);
    const ctx = await context(me.schoolId);
    const [st] = await sql`select s.id, s."fullName", c.id as "classId", c.name as "className" from "Student" s
      left join "ClassEnrollment" e on e."studentId"=s.id and e."academicYearId"=${ctx.year?.id ?? 0} left join "Class" c on c.id=e."classId" where s.id=${sid}`;
    const subjects = st.classId ? await sql`select distinct s.id, s.name, (select u."fullName" from "TeachingAssignment" a2 join "User" u on u.id=a2."teacherId" where a2."classId"=${st.classId} and a2."subjectId"=s.id and a2."activeTo" is null limit 1) as teacher
      from "TeachingAssignment" a join "Subject" s on s.id=a."subjectId" where a."classId"=${st.classId} order by s.name` : [];
    const entries = await sql`select "subjectId", "lessonDate"::text as date, grade, attendance, behavior from "JournalEntry"
      where "studentId"=${sid} and "lessonDate" >= ${ctx.year?.start ?? '1900-01-01'} order by "lessonDate" desc, "lessonNo" desc`;
    return { student: st, subjects, entries, ...ctx };
  },
  async 'p.requestChildren'({ me, body, ip }) {
    need(me, ['PARENT']);
    const ids = Array.isArray(body.studentIds) ? [...new Set(body.studentIds.map(int))] : [];
    if (!ids.length || ids.length > 8) fail('Фарзандро интихоб кунед.');
    const found = await sql`select id from "Student" where "schoolId"=${me.schoolId} and id in ${sql(ids)}`;
    for (const s of found) {
      await sql`insert into "ParentLinkRequest" ("schoolId","parentUserId","studentId") values (${me.schoolId}, ${me.id}, ${s.id})
        on conflict ("parentUserId","studentId") do update set status='PENDING', "reviewedById"=null, "reviewedAt"=null where "ParentLinkRequest".status='REJECTED'`;
    }
    await audit('link.request', me.id, me.schoolId, 'User', me.id, { students: ids }, ip);
    return { sent: found.length };
  },

  // ── рӯйхати тамос ──
  async directory({ me }) {
    if (me.mustChangePassword) fail('Аввал пароли худро иваз кунед.', 403);
    if (me.role === 'PARENT') {
      const rows = await sql`select u.id, u."fullName", case when u."phoneVisible" then u.phone end as phone,
        coalesce(string_agg(distinct s.name || ' — ' || c.name, ', '), '') as info
        from "User" u left join "TeachingAssignment" a on a."teacherId"=u.id and a."activeTo" is null
        left join "Subject" s on s.id=a."subjectId" left join "Class" c on c.id=a."classId"
        where u."schoolId"=${me.schoolId} and u.role='TEACHER' and u."isActive" group by u.id order by u."fullName"`;
      return { kind: 'teachers', people: rows };
    }
    if (me.role === 'TEACHER' || STAFF.includes(me.role)) {
      const rows = await sql`select u.id, u."fullName", case when u."phoneVisible" then u.phone end as phone,
        coalesce(string_agg(distinct st."fullName" || coalesce(' (' || c.name || ')', ''), ', '), '') as info
        from "User" u left join "ParentStudent" ps on ps."parentUserId"=u.id left join "Student" st on st.id=ps."studentId"
        left join "ClassEnrollment" e on e."studentId"=st.id and e."academicYearId"=(select id from "AcademicYear" where "schoolId"=${me.schoolId} and "isCurrent" limit 1)
        left join "Class" c on c.id=e."classId"
        where u."schoolId"=${me.schoolId} and u.role='PARENT' and u."isActive" group by u.id order by u."fullName"`;
      return { kind: 'parents', people: rows };
    }
    fail('Барои шумо иҷозат нест.', 403);
  },

  // ── чат (танҳо омӯзгор ↔ волид, бе чатбот) ──
  async 'chat.list'({ me }) {
    need(me, ['TEACHER', 'PARENT']);
    const isT = me.role === 'TEACHER';
    return await sql`select c.id, o.id as "otherId", o."fullName" as "otherName", c."lastMessageAt", c."lastSenderId",
      (select body from "Message" m where m."conversationId"=c.id order by m.id desc limit 1) as last,
      (c."lastSenderId" is not null and c."lastSenderId"<>${me.id} and (${isT ? sql`c."teacherReadAt"` : sql`c."parentReadAt"`} is null or ${isT ? sql`c."teacherReadAt"` : sql`c."parentReadAt"`} < c."lastMessageAt")) as unread
      from "Conversation" c join "User" o on o.id=${isT ? sql`c."parentId"` : sql`c."teacherId"`}
      where ${isT ? sql`c."teacherId"` : sql`c."parentId"`}=${me.id} order by c."lastMessageAt" desc nulls last, c.id desc`;
  },
  async 'chat.open'({ me, body }) {
    need(me, ['TEACHER', 'PARENT']);
    const other = int(body.userId);
    const want = me.role === 'TEACHER' ? 'PARENT' : 'TEACHER';
    const [o] = await sql`select id from "User" where id=${other} and "schoolId"=${me.schoolId} and role=${want} and "isActive"`;
    if (!o) fail('Корбар ёфт нашуд.');
    const [teacherId, parentId] = me.role === 'TEACHER' ? [me.id, other] : [other, me.id];
    const [c] = await sql`insert into "Conversation" ("schoolId","teacherId","parentId") values (${me.schoolId}, ${teacherId}, ${parentId})
      on conflict ("teacherId","parentId") do update set "schoolId"=excluded."schoolId" returning id`;
    return { id: c.id };
  },
  async 'chat.messages'({ me, body }) {
    need(me, ['TEACHER', 'PARENT']);
    const c = await myConversation(int(body.conversationId), me);
    const after = Number(body.afterId) || 0;
    const msgs = await sql`select id, "senderId", body, "createdAt" from "Message" where "conversationId"=${c.id} and id > ${after} order by id desc limit 200`;
    if (me.role === 'TEACHER') await sql`update "Conversation" set "teacherReadAt"=now() where id=${c.id}`;
    else await sql`update "Conversation" set "parentReadAt"=now() where id=${c.id}`;
    const [o] = await sql`select "fullName", case when "phoneVisible" then phone end as phone from "User" where id=${me.role === 'TEACHER' ? c.parentId : c.teacherId}`;
    return { id: c.id, other: o, otherRead: me.role === 'TEACHER' ? c.parentReadAt : c.teacherReadAt, messages: msgs.reverse() };
  },
  async 'chat.send'({ me, body }) {
    need(me, ['TEACHER', 'PARENT']);
    if (body.website) fail('Паём фиристода нашуд.');
    const opened = Number(body.openedAt) || 0;
    if (!opened || Date.now() - opened < 1200) fail('Лутфан паёмро худатон нависед.');
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : '';
    if (!text) fail('Паём холӣ аст.');
    const c = await myConversation(int(body.conversationId), me);
    const [r] = await sql`select
      (select max("createdAt") from "Message" where "senderId"=${me.id}) as last,
      (select count(*)::int from "Message" where "senderId"=${me.id} and "createdAt" > now() - interval '10 minutes') as n10,
      (select count(*)::int from "Message" where "senderId"=${me.id} and "conversationId"=${c.id} and body=${text} and "createdAt" > now() - interval '60 seconds') as dup`;
    if (r.last && Date.now() - new Date(r.last).getTime() < 1500) fail('Хеле тез. Каме сабр кунед.', 429);
    if (r.n10 >= 40) fail('Паёмҳо хеле зиёданд. Баъдтар нависед.', 429);
    if (r.dup) fail('Ҳамин паём аллакай фиристода шуд.');
    const [m] = await sql`insert into "Message" ("conversationId","senderId",body) values (${c.id}, ${me.id}, ${text}) returning id, "senderId", body, "createdAt"`;
    await sql`update "Conversation" set "lastMessageAt"=now(), "lastSenderId"=${me.id}, ${me.role === 'TEACHER' ? sql`"teacherReadAt"` : sql`"parentReadAt"`}=now() where id=${c.id}`;
    return m;
  },
};

async function loadAssignment(id: number, me: Me) {
  const today = todayISO();
  const [a] = await sql`select a.id, a."classId", a."subjectId", c.name as "className", s.name as "subjectName"
    from "TeachingAssignment" a join "Class" c on c.id=a."classId" join "Subject" s on s.id=a."subjectId" join "AcademicYear" y on y.id=a."academicYearId" and y."isCurrent"
    where a.id=${id} and a."teacherId"=${me.id} and a."activeFrom" <= ${today} and (a."activeTo" is null or a."activeTo" >= ${today})`;
  if (!a) fail('Ин синф/фан ба шумо тақсим нашудааст.', 403);
  return a;
}
async function myConversation(id: number, me: Me) {
  const [c] = await sql`select * from "Conversation" where id=${id} and (${me.role === 'TEACHER' ? sql`"teacherId"` : sql`"parentId"`}=${me.id})`;
  if (!c) fail('Сӯҳбат ёфт нашуд.', 404);
  return c;
}

// ───────────────────────── сервер ─────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    try { await sql`select 1`; return json({ ok: true }); } catch { return json({ ok: false }, 503); }
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'POST лозим аст' }, 405);
  let body: Record<string, unknown>;
  try {
    const t = await req.text();
    if (t.length > 200_000) return json({ ok: false, error: 'Дархост хеле калон аст' }, 413);
    body = JSON.parse(t || '{}');
  } catch { return json({ ok: false, error: 'JSON нодуруст' }, 400); }
  const action = String(body.action ?? '');
  const ip = clientIp(req);
  try {
    if (Object.hasOwn(PUBLIC, action)) return json({ ok: true, data: await PUBLIC[action]({ req, ip, body }) });
    if (Object.hasOwn(PRIVATE, action)) {
      const me = await auth(req);
      if (action === 'changePassword') body.__token = req.headers.get('x-session');
      return json({ ok: true, data: await PRIVATE[action]({ req, ip, body, me }) });
    }
    return json({ ok: false, error: 'Амали номаълум' }, 404);
  } catch (e) {
    if (e instanceof ApiError) return json({ ok: false, error: e.message }, e.status);
    const code = (e as { code?: string }).code;
    if (code === '23505') return json({ ok: false, error: 'Чунин сабт аллакай ҳаст.' }, 409);
    console.error(action, e);
    return json({ ok: false, error: 'Хатои сервер. Каме баъд боз кӯшиш кунед.' }, 500);
  }
});
