"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  addFood,
  addFoodTry,
  deleteFood,
  deleteFoodTry,
  listFoods,
  setFoodStatus,
  type ChildDTO,
  type FoodDTO,
} from "@/lib/actions/baby";
import { errorText, unwrap } from "@/lib/action-result";
import {
  FOOD_CATEGORIES,
  FOOD_REACTIONS,
  FOOD_STATUS,
  FOOD_SUGGESTIONS,
  NEW_FOOD_GAP_DAYS,
  childMonths,
  nextNewFoodDate,
  type FoodCategory,
  type FoodReaction,
  type FoodStatus,
} from "@/lib/baby";
import { fromDateKey, todayKey } from "@/lib/dates";
import { AchievementToast } from "../AchievementToast";
import styles from "./Baby.module.css";

export function FoodTracker({ kids }: { kids: ChildDTO[] }) {
  const [childId, setChildId] = useState(kids[0]?.id ?? null);
  const child = kids.find((c) => c.id === childId) ?? null;

  if (!child) {
    return (
      <section className={styles.root}>
        <p className={styles.emptyBig}>
          Сначала добавьте малыша на вкладке <Link href="/app/baby">«Малыш»</Link>.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.root}>
      {kids.length > 1 ? (
        <div className={styles.children}>
          {kids.map((c) => (
            <button key={c.id} type="button" className={c.id === childId ? styles.childOn : styles.child} onClick={() => setChildId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      ) : null}
      <FoodBoard key={child.id} child={child} />
    </section>
  );
}

function FoodBoard({ child }: { child: ChildDTO }) {
  const today = todayKey();
  const [foods, setFoods] = useState<FoodDTO[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);

  useEffect(() => {
    void listFoods(child.id)
      .then((r) => setFoods(unwrap(r)))
      .catch((err) => setToast(errorText(err, "Не удалось загрузить прикорм")));
  }, [child.id]);

  const months = childMonths(child.birthDate, today);
  const nextDate = nextNewFoodDate((foods ?? []).map((f) => f.startDate));
  const canStartNew = !nextDate || nextDate <= today;
  const byStatus = useMemo(() => {
    const groups: Record<FoodStatus, FoodDTO[]> = { trying: [], reaction: [], ok: [], later: [] };
    for (const f of foods ?? []) groups[f.status].push(f);
    return groups;
  }, [foods]);

  function replace(food: FoodDTO) {
    setFoods((prev) => (prev ? prev.map((f) => (f.id === food.id ? food : f)) : prev));
  }

  async function run<T>(action: () => Promise<T>, fallback: string): Promise<T | null> {
    try {
      return await action();
    } catch (err) {
      setToast(errorText(err, fallback));
      return null;
    }
  }

  return (
    <>
      <div className={styles.headline}>
        <h1 className={styles.childName}>Прикорм</h1>
        <span className={styles.age}>
          {child.name} · {months} мес
        </span>
      </div>

      <div className={`${styles.banner} ${canStartNew ? styles.bannerGo : styles.bannerWait}`}>
        {canStartNew ? (
          <p>
            <b>Можно пробовать новый продукт</b>
            {foods && foods.length > 0 ? " — прошло достаточно дней после прошлого." : "."}
          </p>
        ) : (
          <p>
            <b>
              Новый продукт — с {format(fromDateKey(nextDate!), "d MMMM", { locale: ru })} (
              {differenceInCalendarDays(fromDateKey(nextDate!), fromDateKey(today))} дн.)
            </b>
            . Пока продолжайте давать то, что уже вводите, и наблюдайте за реакцией.
          </p>
        )}
        <button type="button" className={styles.linkBtn} onClick={() => setTipsOpen((v) => !v)}>
          {tipsOpen ? "Скрыть советы" : "Как вводить прикорм?"}
        </button>
        {tipsOpen ? (
          <ul className={styles.tips}>
            <li>Обычно прикорм начинают около 6 месяцев — когда малыш уверенно сидит с опорой и интересуется едой.</li>
            <li>Один новый продукт — раз в {NEW_FOOD_GAP_DAYS} дня, чтобы было понятно, на что реакция.</li>
            <li>Давайте новое утром или днём: так проще заметить реакцию до ночи.</li>
            <li>Начинайте с ½–1 ложечки и понемногу увеличивайте.</li>
            <li>Сыпь, покраснение, беспокойство или изменения стула — отметьте реакцию и отложите продукт.</li>
            <li>Сроки и порядок продуктов обсудите с педиатром — у каждого малыша свой план.</li>
          </ul>
        ) : null}
      </div>

      {months < 4 ? (
        <p className={styles.hint}>
          Малышу {months} мес — обычно прикорм начинают позже. Раздел будет ждать вас здесь.
        </p>
      ) : null}

      {adding ? (
        <NewFood
          existing={(foods ?? []).map((f) => f.product.toLowerCase())}
          warn={!canStartNew}
          onCancel={() => setAdding(false)}
          onSave={async (input) => {
            const created = await run(async () => unwrap(await addFood(child.id, input)), "Не удалось добавить");
            if (created) {
              setFoods((prev) => [created, ...(prev ?? [])]);
              setAdding(false);
              setOpenId(created.id);
            }
          }}
        />
      ) : (
        <button type="button" className={styles.bigBtnWide} onClick={() => setAdding(true)}>
          + Новый продукт
        </button>
      )}

      {foods === null ? <p className={styles.hint}>Загружаю…</p> : null}
      {foods && foods.length === 0 && !adding ? (
        <p className={styles.emptyBig}>Здесь появятся продукты, которые вы вводите. Начните с первого 🥄</p>
      ) : null}

      {(["trying", "reaction", "ok", "later"] as FoodStatus[]).map((status) =>
        byStatus[status].length > 0 ? (
          <div key={status} className={styles.foodGroup}>
            <h2 className={styles.groupTitle}>
              {FOOD_STATUS[status].icon} {FOOD_STATUS[status].label} · {byStatus[status].length}
            </h2>
            <div className={styles.foodGrid}>
              {byStatus[status].map((food) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  today={today}
                  open={openId === food.id}
                  onToggle={() => setOpenId((id) => (id === food.id ? null : food.id))}
                  onTry={async (input) => {
                    const updated = await run(async () => unwrap(await addFoodTry(food.id, input)), "Не удалось записать");
                    if (updated) replace(updated);
                  }}
                  onDeleteTry={async (tryId) => {
                    const updated = await run(async () => unwrap(await deleteFoodTry(tryId)), "Не удалось удалить");
                    if (updated) replace(updated);
                  }}
                  onStatus={async (next) => {
                    const updated = await run(async () => unwrap(await setFoodStatus(food.id, next)), "Не удалось обновить");
                    if (updated) replace(updated);
                  }}
                  onDelete={async () => {
                    if (!window.confirm(`Удалить «${food.product}» со всеми пробами?`)) return;
                    const ok = await run(async () => unwrap(await deleteFood(food.id)), "Не удалось удалить");
                    if (ok !== null) setFoods((prev) => (prev ?? []).filter((f) => f.id !== food.id));
                  }}
                />
              ))}
            </div>
          </div>
        ) : null,
      )}

      {toast ? <AchievementToast kind="error" title={toast} onClose={() => setToast(null)} /> : null}
    </>
  );
}

function NewFood({
  existing,
  warn,
  onSave,
  onCancel,
}: {
  existing: string[];
  warn: boolean;
  onSave: (input: { product: string; category: string; startDate: string; amount: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<FoodCategory>("veg");
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("½ ложечки");
  const [date, setDate] = useState(todayKey());
  const [pending, setPending] = useState(false);
  const suggestions = FOOD_SUGGESTIONS[category].filter((p) => !existing.includes(p.toLowerCase()));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    await onSave({ product, category, startDate: date, amount });
    setPending(false);
  }

  return (
    <form className={styles.eventForm} onSubmit={submit}>
      <h2 className={styles.formTitle}>Новый продукт</h2>
      {warn ? (
        <p className={styles.warnNote}>
          С прошлого нового продукта прошло меньше {NEW_FOOD_GAP_DAYS} дней — если начнёте сейчас, будет сложнее понять, на что реакция.
        </p>
      ) : null}
      <div className={styles.quickMl}>
        {FOOD_CATEGORIES.map((c) => (
          <button key={c.id} type="button" className={category === c.id ? styles.chipOn : styles.chip} onClick={() => setCategory(c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      {suggestions.length > 0 ? (
        <div className={styles.quickMl}>
          {suggestions.map((p) => (
            <button key={p} type="button" className={product === p ? styles.chipOn : styles.chipSoft} onClick={() => setProduct(p)}>
              {p}
            </button>
          ))}
        </div>
      ) : null}
      <label className={styles.field}>
        Продукт
        <input className={styles.input} value={product} onChange={(e) => setProduct(e.target.value)} placeholder="или впишите свой" maxLength={40} required />
      </label>
      <div className={styles.timeRow}>
        <label>
          Первая проба
          <input className={styles.input} type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Сколько дали
          <input className={styles.input} value={amount} onChange={(e) => setAmount(e.target.value)} maxLength={30} />
        </label>
      </div>
      <div className={styles.formActions}>
        <span />
        <div className={styles.btnRow}>
          <button type="button" className={styles.softBtn} onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className={styles.bigBtn} disabled={pending || !product.trim()}>
            Начать вводить
          </button>
        </div>
      </div>
    </form>
  );
}

function FoodCard({
  food,
  today,
  open,
  onToggle,
  onTry,
  onDeleteTry,
  onStatus,
  onDelete,
}: {
  food: FoodDTO;
  today: string;
  open: boolean;
  onToggle: () => void;
  onTry: (input: { date: string; amount: string; reaction: FoodReaction; note: string }) => Promise<void>;
  onDeleteTry: (id: string) => Promise<void>;
  onStatus: (status: FoodStatus) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(food.tries[food.tries.length - 1]?.amount ?? "");
  const [reaction, setReaction] = useState<FoodReaction>("none");
  const [note, setNote] = useState("");
  const day = differenceInCalendarDays(fromDateKey(today), fromDateKey(food.startDate)) + 1;
  const category = FOOD_CATEGORIES.find((c) => c.id === food.category);
  const reactions = food.tries.filter((t) => t.reaction !== "none").length;

  return (
    <article className={`${styles.food} ${open ? styles.foodOpen : ""}`}>
      <button type="button" className={styles.foodHead} onClick={onToggle}>
        <span className={styles.foodIcon}>{category?.icon ?? "🍽️"}</span>
        <span className={styles.foodBody}>
          <b>{food.product}</b>
          <small>
            {food.status === "trying"
              ? `день ${Math.max(1, day)} · проб: ${food.tries.length}`
              : `с ${format(fromDateKey(food.startDate), "d MMM", { locale: ru })} · проб: ${food.tries.length}`}
            {reactions > 0 ? ` · реакций: ${reactions}` : ""}
          </small>
        </span>
      </button>

      {open ? (
        <div className={styles.foodDetails}>
          <form
            className={styles.tryForm}
            onSubmit={(e) => {
              e.preventDefault();
              void onTry({ date: today, amount, reaction, note }).then(() => setNote(""));
            }}
          >
            <p className={styles.fieldLabel}>Сегодняшняя проба</p>
            <input className={styles.input} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сколько: 1 ложечка, 30 г…" maxLength={30} />
            <div className={styles.quickMl}>
              {(Object.keys(FOOD_REACTIONS) as FoodReaction[]).map((r) => (
                <button key={r} type="button" className={reaction === r ? styles.chipOn : styles.chip} onClick={() => setReaction(r)}>
                  {r === "none" ? "🙂 " : "⚠️ "}
                  {FOOD_REACTIONS[r]}
                </button>
              ))}
            </div>
            {reaction !== "none" ? (
              <input className={styles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что заметили" maxLength={300} />
            ) : null}
            <button type="submit" className={styles.bigBtn}>
              Записать пробу
            </button>
          </form>

          {food.tries.length > 0 ? (
            <ul className={styles.tries}>
              {[...food.tries].reverse().map((t) => (
                <li key={t.id}>
                  <span>{format(fromDateKey(t.date), "d MMM", { locale: ru })}</span>
                  <span>
                    {t.amount || "—"}
                    {t.reaction !== "none" ? ` · ⚠️ ${FOOD_REACTIONS[t.reaction]}` : ""}
                    {t.note ? ` · ${t.note}` : ""}
                  </span>
                  <button type="button" aria-label="Удалить пробу" onClick={() => void onDeleteTry(t.id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className={styles.quickMl}>
            {(Object.keys(FOOD_STATUS) as FoodStatus[])
              .filter((s) => s !== food.status)
              .map((s) => (
                <button key={s} type="button" className={styles.chipSoft} onClick={() => void onStatus(s)}>
                  {FOOD_STATUS[s].icon} {s === "ok" ? "Подходит" : s === "trying" ? "Снова вводим" : s === "reaction" ? "Была реакция" : "Отложить"}
                </button>
              ))}
            <button type="button" className={styles.dangerLink} onClick={() => void onDelete()}>
              Удалить
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
