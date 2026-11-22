"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isDateKey } from "@/lib/validation";
import { toResult, UserError, type ActionResult } from "@/lib/action-result";
import {
  isFoodCategory,
  isFoodReaction,
  isFoodStatus,
  type BabyEventKind,
  type DiaperData,
  type FeedData,
  type FoodCategory,
  type FoodReaction,
  type FoodStatus,
} from "@/lib/baby";

// ---------- types ----------

export type ChildDTO = {
  id: string;
  name: string;
  birthDate: string;
  sex: "girl" | "boy" | null;
  /** The viewer added this child (may edit and share it). */
  isOwner: boolean;
  /** Everyone tracking this child, to name who made a record. */
  people: { id: string; name: string }[];
};

export type BabyEventDTO = {
  id: string;
  kind: BabyEventKind;
  startedAt: string;
  endedAt: string | null;
  data: FeedData | DiaperData | null;
  note: string | null;
  byUserId: string | null;
};

export type GrowthDTO = {
  id: string;
  date: string;
  weightG: number | null;
  heightCm: number | null;
  headCm: number | null;
};

export type FoodTryDTO = {
  id: string;
  date: string;
  amount: string | null;
  reaction: FoodReaction;
  note: string | null;
};

export type FoodDTO = {
  id: string;
  product: string;
  category: FoodCategory;
  startDate: string;
  status: FoodStatus;
  note: string | null;
  tries: FoodTryDTO[];
};

export type EventInput = {
  kind: BabyEventKind;
  startedAt: string;
  endedAt?: string | null;
  data?: FeedData | DiaperData | null;
  note?: string | null;
};

const NAME_MAX = 40;
const NOTE_MAX = 300;
const CHILDREN_MAX = 6;
const KINDS: BabyEventKind[] = ["sleep", "feed", "diaper"];

// ---------- helpers ----------

/** Children a user may see and track: their own and those shared with them. */
function reachable(userId: string) {
  return { OR: [{ userId }, { access: { some: { userId, status: "active" } } }] };
}

/** Only the parent who added the child may edit it, share it or delete it. */
async function ownChild(userId: string, childId: string) {
  const child = await prisma.child.findFirst({ where: { id: childId, userId }, select: { id: true } });
  if (!child) throw new UserError("Это может только тот, кто добавил малыша");
  return child;
}

/** The child is the user's or shared with them. */
async function seeChild(userId: string, childId: string) {
  const child = await prisma.child.findFirst({ where: { id: childId, ...reachable(userId) }, select: { id: true } });
  if (!child) throw new UserError("Ребёнок не найден");
  return child;
}

async function ownEvent(userId: string, eventId: string) {
  const event = await prisma.babyEvent.findFirst({
    where: { id: eventId, child: reachable(userId) },
    select: { id: true, childId: true, kind: true, startedAt: true, endedAt: true },
  });
  if (!event) throw new UserError("Запись не найдена");
  return event;
}

function parseTime(raw: unknown, label: string): Date {
  const date = new Date(String(raw ?? ""));
  if (Number.isNaN(date.getTime())) throw new UserError(`${label}: некорректное время`);
  // Nothing from the future, and nothing older than three years.
  const now = Date.now();
  if (date.getTime() > now + 5 * 60_000) throw new UserError(`${label}: время ещё не наступило`);
  if (date.getTime() < now - 3 * 365 * 86_400_000) throw new UserError(`${label}: слишком давно`);
  return date;
}

function cleanNote(raw: unknown): string | null {
  const note = typeof raw === "string" ? raw.trim() : "";
  if (!note) return null;
  if (note.length > NOTE_MAX) throw new UserError(`Заметка не длиннее ${NOTE_MAX} символов`);
  return note;
}

function cleanData(kind: BabyEventKind, raw: unknown): Prisma.InputJsonValue | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  if (kind === "diaper") {
    const data: DiaperData = { pee: d.pee === true, poo: d.poo === true };
    if (!data.pee && !data.poo) throw new UserError("Отметьте, какой подгузник");
    return data;
  }
  if (kind === "feed") {
    if (d.type === "breast") {
      const side = d.side === "left" || d.side === "right" ? d.side : undefined;
      return side ? { type: "breast", side } : { type: "breast" };
    }
    if (d.type === "bottle") {
      const ml = Math.round(Number(d.ml));
      if (!Number.isFinite(ml) || ml < 1 || ml > 1000) throw new UserError("Сколько мл: от 1 до 1000");
      const milk = d.milk === "breastmilk" ? "breastmilk" : "formula";
      return { type: "bottle", ml, milk };
    }
    throw new UserError("Выберите тип кормления");
  }
  return undefined;
}

function eventDTO(e: {
  id: string;
  kind: string;
  startedAt: Date;
  endedAt: Date | null;
  data: Prisma.JsonValue;
  note: string | null;
  byUserId?: string | null;
}): BabyEventDTO {
  return {
    id: e.id,
    kind: (KINDS as string[]).includes(e.kind) ? (e.kind as BabyEventKind) : "sleep",
    startedAt: e.startedAt.toISOString(),
    endedAt: e.endedAt ? e.endedAt.toISOString() : null,
    data: (e.data as FeedData | DiaperData | null) ?? null,
    note: e.note,
    byUserId: e.byUserId ?? null,
  };
}

function foodDTO(f: {
  id: string;
  product: string;
  category: string;
  startDate: string;
  status: string;
  note: string | null;
  tries: { id: string; date: string; amount: string | null; reaction: string; note: string | null }[];
}): FoodDTO {
  return {
    id: f.id,
    product: f.product,
    category: isFoodCategory(f.category) ? f.category : "other",
    startDate: f.startDate,
    status: isFoodStatus(f.status) ? f.status : "trying",
    note: f.note,
    tries: f.tries.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      reaction: isFoodReaction(t.reaction) ? t.reaction : "none",
      note: t.note,
    })),
  };
}

// ---------- mom mode ----------

export async function setMomMode(enabled: boolean): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await prisma.user.update({ where: { id: userId }, data: { momMode: enabled } });
    revalidatePath("/app", "layout");
  });
}

// ---------- children ----------

export async function listChildren(): Promise<ChildDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.child.findMany({
    where: reachable(userId),
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true } },
      access: {
        where: { status: "active" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    birthDate: c.birthDate,
    sex: c.sex === "girl" || c.sex === "boy" ? c.sex : null,
    isOwner: c.userId === userId,
    people: [c.user, ...c.access.map((a) => a.user)],
  }));
}

function cleanChild(input: { name: string; birthDate: string; sex?: string | null }) {
  const name = String(input.name ?? "").trim();
  if (!name) throw new UserError("Как зовут малыша?");
  if (name.length > NAME_MAX) throw new UserError(`Имя не длиннее ${NAME_MAX} символов`);
  if (!isDateKey(input.birthDate)) throw new UserError("Укажите дату рождения");
  const sex: ChildDTO["sex"] = input.sex === "girl" || input.sex === "boy" ? input.sex : null;
  return { name, birthDate: input.birthDate, sex };
}

export async function saveChild(
  id: string | null,
  input: { name: string; birthDate: string; sex?: string | null },
): Promise<ActionResult<ChildDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const data = cleanChild(input);
    if (id) {
      await ownChild(userId, id);
      await prisma.child.update({ where: { id }, data });
      return (await listChildren()).find((c) => c.id === id)!;
    }
    if ((await prisma.child.count({ where: { userId } })) >= CHILDREN_MAX) {
      throw new UserError(`Можно добавить до ${CHILDREN_MAX} детей`);
    }
    const c = await prisma.child.create({ data: { ...data, userId } });
    return (await listChildren()).find((x) => x.id === c.id)!;
  });
}

export async function deleteChild(id: string): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await ownChild(userId, id);
    await prisma.child.delete({ where: { id } });
  });
}

// ---------- events: sleep, feeds, diapers ----------

/** Events that touch [from, to), plus any timer still running. */
export async function listEvents(
  childId: string,
  fromIso: string,
  toIso: string,
): Promise<ActionResult<BabyEventDTO[]>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await seeChild(userId, childId);
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new UserError("Неверный период");
    const rows = await prisma.babyEvent.findMany({
      where: {
        childId,
        startedAt: { lt: to },
        OR: [{ endedAt: null }, { endedAt: { gte: from } }, { startedAt: { gte: from } }],
      },
      orderBy: { startedAt: "desc" },
      take: 2000,
    });
    return rows.map(eventDTO);
  });
}

/** Starts a sleep or feeding timer; a running timer of the same kind is stopped first. */
export async function startTimer(
  childId: string,
  kind: "sleep" | "feed",
  data?: FeedData,
): Promise<ActionResult<BabyEventDTO[]>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await seeChild(userId, childId);
    const now = new Date();
    const stopped = await prisma.babyEvent.findMany({
      where: { childId, kind, endedAt: null },
    });
    if (stopped.length > 0) {
      await prisma.babyEvent.updateMany({
        where: { id: { in: stopped.map((e) => e.id) } },
        data: { endedAt: now },
      });
    }
    // Starting a sleep ends a feeding in progress (and the other way round).
    const other = kind === "sleep" ? "feed" : "sleep";
    await prisma.babyEvent.updateMany({ where: { childId, kind: other, endedAt: null }, data: { endedAt: now } });
    const created = await prisma.babyEvent.create({
      data: {
        childId,
        kind,
        startedAt: now,
        byUserId: userId,
        data: kind === "feed" && data ? cleanData("feed", data) : undefined,
      },
    });
    const touched = await prisma.babyEvent.findMany({
      where: { id: { in: [created.id, ...stopped.map((e) => e.id)] } },
    });
    return touched.map(eventDTO);
  });
}

export async function stopTimer(eventId: string): Promise<ActionResult<BabyEventDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const event = await ownEvent(userId, eventId);
    const updated = await prisma.babyEvent.update({
      where: { id: event.id },
      data: { endedAt: event.endedAt ?? new Date() },
    });
    return eventDTO(updated);
  });
}

/** Adds a finished or instant record: a diaper, a bottle, or a sleep/feed entered afterwards. */
export async function addEvent(childId: string, input: EventInput): Promise<ActionResult<BabyEventDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await seeChild(userId, childId);
    if (!KINDS.includes(input.kind)) throw new UserError("Неизвестный тип записи");
    const startedAt = parseTime(input.startedAt, "Начало");
    const endedAt = input.endedAt ? parseTime(input.endedAt, "Конец") : null;
    if (endedAt && endedAt < startedAt) throw new UserError("Конец раньше начала");
    if (input.kind === "sleep" && !endedAt) throw new UserError("Укажите, когда проснулся");
    const created = await prisma.babyEvent.create({
      data: {
        childId,
        kind: input.kind,
        startedAt,
        endedAt: input.kind === "diaper" ? startedAt : endedAt ?? startedAt,
        data: cleanData(input.kind, input.data),
        note: cleanNote(input.note),
        byUserId: userId,
      },
    });
    return eventDTO(created);
  });
}

export async function updateEvent(eventId: string, input: EventInput): Promise<ActionResult<BabyEventDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const event = await ownEvent(userId, eventId);
    const startedAt = parseTime(input.startedAt, "Начало");
    const endedAt = input.endedAt ? parseTime(input.endedAt, "Конец") : null;
    if (endedAt && endedAt < startedAt) throw new UserError("Конец раньше начала");
    const kind = event.kind as BabyEventKind;
    const updated = await prisma.babyEvent.update({
      where: { id: event.id },
      data: {
        startedAt,
        // A finished record stays finished; a running timer stays running.
        endedAt: kind === "diaper" ? startedAt : endedAt ?? (event.endedAt ? startedAt : null),
        data: input.data !== undefined ? cleanData(kind, input.data) : undefined,
        note: cleanNote(input.note),
      },
    });
    return eventDTO(updated);
  });
}

export async function deleteEvent(eventId: string): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const event = await ownEvent(userId, eventId);
    await prisma.babyEvent.delete({ where: { id: event.id } });
  });
}

// ---------- growth ----------

export async function listGrowth(childId: string): Promise<ActionResult<GrowthDTO[]>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await seeChild(userId, childId);
    const rows = await prisma.growthRecord.findMany({ where: { childId }, orderBy: { date: "asc" } });
    return rows.map((g) => ({ id: g.id, date: g.date, weightG: g.weightG, heightCm: g.heightCm, headCm: g.headCm }));
  });
}

export async function addGrowth(
  childId: string,
  input: { date: string; weightKg?: number | null; heightCm?: number | null; headCm?: number | null },
): Promise<ActionResult<GrowthDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await seeChild(userId, childId);
    if (!isDateKey(input.date)) throw new UserError("Укажите дату");
    const num = (v: unknown, min: number, max: number, label: string) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) throw new UserError(`${label}: от ${min} до ${max}`);
      return n;
    };
    const weightKg = num(input.weightKg, 0.3, 40, "Вес, кг");
    const heightCm = num(input.heightCm, 20, 150, "Рост, см");
    const headCm = num(input.headCm, 20, 60, "Окружность головы, см");
    if (weightKg === null && heightCm === null && headCm === null) {
      throw new UserError("Заполните вес, рост или окружность головы");
    }
    const g = await prisma.growthRecord.create({
      data: {
        childId,
        date: input.date,
        weightG: weightKg === null ? null : Math.round(weightKg * 1000),
        heightCm,
        headCm,
      },
    });
    return { id: g.id, date: g.date, weightG: g.weightG, heightCm: g.heightCm, headCm: g.headCm };
  });
}

export async function deleteGrowth(id: string): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const row = await prisma.growthRecord.findFirst({ where: { id, child: reachable(userId) }, select: { id: true } });
    if (!row) throw new UserError("Запись не найдена");
    await prisma.growthRecord.delete({ where: { id } });
  });
}

// ---------- complementary foods ----------

const foodInclude = { tries: { orderBy: { date: "asc" as const } } };

export async function listFoods(childId: string): Promise<ActionResult<FoodDTO[]>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await seeChild(userId, childId);
    const rows = await prisma.foodIntro.findMany({
      where: { childId },
      include: foodInclude,
      orderBy: { startDate: "desc" },
    });
    return rows.map(foodDTO);
  });
}

export async function addFood(
  childId: string,
  input: { product: string; category: string; startDate: string; amount?: string | null },
): Promise<ActionResult<FoodDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await seeChild(userId, childId);
    const product = String(input.product ?? "").trim();
    if (!product) throw new UserError("Какой продукт?");
    if (product.length > 40) throw new UserError("Название продукта не длиннее 40 символов");
    if (!isFoodCategory(input.category)) throw new UserError("Выберите группу продуктов");
    if (!isDateKey(input.startDate)) throw new UserError("Укажите дату");
    const exists = await prisma.foodIntro.findFirst({
      where: { childId, product: { equals: product, mode: "insensitive" } },
      select: { id: true },
    });
    if (exists) throw new UserError("Этот продукт уже есть в списке — добавьте в нём новую пробу");
    const created = await prisma.foodIntro.create({
      data: {
        childId,
        product,
        category: input.category,
        startDate: input.startDate,
        tries: {
          create: { date: input.startDate, amount: input.amount?.trim().slice(0, 30) || null },
        },
      },
      include: foodInclude,
    });
    return foodDTO(created);
  });
}

async function ownFood(userId: string, foodId: string) {
  const food = await prisma.foodIntro.findFirst({
    where: { id: foodId, child: reachable(userId) },
    select: { id: true, status: true },
  });
  if (!food) throw new UserError("Продукт не найден");
  return food;
}

async function loadFood(id: string): Promise<FoodDTO> {
  return foodDTO(await prisma.foodIntro.findUniqueOrThrow({ where: { id }, include: foodInclude }));
}

export async function addFoodTry(
  foodId: string,
  input: { date: string; amount?: string | null; reaction: string; note?: string | null },
): Promise<ActionResult<FoodDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const food = await ownFood(userId, foodId);
    if (!isDateKey(input.date)) throw new UserError("Укажите дату");
    if (!isFoodReaction(input.reaction)) throw new UserError("Отметьте, как прошло");
    await prisma.foodTry.create({
      data: {
        foodId,
        date: input.date,
        amount: input.amount?.trim().slice(0, 30) || null,
        reaction: input.reaction,
        note: cleanNote(input.note),
      },
    });
    // A reaction during introduction pauses the food until the parent decides.
    if (input.reaction !== "none" && food.status === "trying") {
      await prisma.foodIntro.update({ where: { id: foodId }, data: { status: "reaction" } });
    }
    return loadFood(foodId);
  });
}

export async function setFoodStatus(foodId: string, status: string): Promise<ActionResult<FoodDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await ownFood(userId, foodId);
    if (!isFoodStatus(status)) throw new UserError("Неизвестный статус");
    await prisma.foodIntro.update({ where: { id: foodId }, data: { status } });
    return loadFood(foodId);
  });
}

export async function deleteFood(foodId: string): Promise<ActionResult<void>> {
  return toResult(async () => {
    const userId = await requireUserId();
    await ownFood(userId, foodId);
    await prisma.foodIntro.delete({ where: { id: foodId } });
  });
}

export async function deleteFoodTry(tryId: string): Promise<ActionResult<FoodDTO>> {
  return toResult(async () => {
    const userId = await requireUserId();
    const row = await prisma.foodTry.findFirst({
      where: { id: tryId, food: { child: reachable(userId) } },
      select: { id: true, foodId: true },
    });
    if (!row) throw new UserError("Запись не найдена");
    await prisma.foodTry.delete({ where: { id: tryId } });
    return loadFood(row.foodId);
  });
}
