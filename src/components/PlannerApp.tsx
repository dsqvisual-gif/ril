"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { SegmentedControl, type ViewMode } from "./SegmentedControl";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { AchievementToast } from "./AchievementToast";
import { DoneCelebration } from "./DoneCelebration";
import { StalePrompt } from "./StalePrompt";
import { VoiceMic } from "./VoiceMic";
import type { TaskHandlers } from "./TaskRow";
import { UndoToast } from "./planner/UndoToast";
import { SearchIcon, TaskSearch } from "./planner/TaskSearch";
import {
  addTaskItem,
  createTask,
  deleteTask,
  keepTask,
  moveTask,
  removeTask,
  removeTaskItem,
  settleOpenTasks,
  toggleTask,
  toggleTaskItem,
  updateTask,
  type CreateTaskInput,
  type TaskDTO,
  type ToggleResult,
} from "@/lib/actions/tasks";
import type { FriendOption } from "@/lib/actions/friends";
import { errorText, unwrap, type ActionResult } from "@/lib/action-result";
import {
  formatMonthTitle,
  getMonthGrid,
  getWeekDays,
  plannerNavLabel,
  shiftDateKey,
  todayKey,
  fromDateKey,
  toDateKey,
} from "@/lib/dates";
import { describeUnlocked } from "@/lib/achievements";
import styles from "./PlannerApp.module.css";

type Props = {
  initialTasks: TaskDTO[];
  initialDate: string;
  friends: FriendOption[];
};

export function PlannerApp({ initialTasks, initialDate, friends }: Props) {
  const [mode, setMode] = useState<ViewMode>("day");
  const [date, setDate] = useState(initialDate);
  const [tasks, setTasks] = useState(initialTasks);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToastState] = useState<{
    text: string;
    kind: "achievement" | "error";
    icon?: string;
  } | null>(null);
  // Plain messages are errors; unlocked achievements go through `celebrate`.
  const setToast = useCallback(
    (text: string | null) =>
      setToastState(text ? { text, kind: "error" } : null),
    [],
  );
  const celebrate = (codes: string[]) => {
    const unlocked = describeUnlocked(codes);
    if (unlocked)
      setToastState({
        text: unlocked.title,
        icon: unlocked.icon,
        kind: "achievement",
      });
  };
  const [cheerKey, setCheerKey] = useState(0);
  const [prompts, setPrompts] = useState<TaskDTO[]>([]);
  const dismissed = useRef(new Set<string>());
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<{
    key: number;
    text: string;
    undo?: () => void;
  } | null>(null);
  const say = useCallback((text: string, undo?: () => void) => {
    setNotice({ key: Date.now(), text, undo });
  }, []);
  const closeNotice = useCallback(() => setNotice(null), []);

  const visibleDates = useMemo(() => {
    if (mode === "day") return [date];
    if (mode === "week") return getWeekDays(date);
    return getMonthGrid(date);
  }, [mode, date]);

  const rangeKey = visibleDates.join(",");

  const loadRange = useCallback(async (dates: string[]) => {
    if (dates.length === 0) return;
    const from = dates[0];
    const to = dates[dates.length - 1];
    const res = await fetch(
      `/api/tasks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    if (!res.ok) return;
    const data = (await res.json().catch(() => null)) as TaskDTO[] | null;
    if (!Array.isArray(data)) return;
    setTasks((prev) => {
      const keep = prev.filter((t) => t.date < from || t.date > to);
      return [...keep, ...data];
    });
  }, []);

  useEffect(() => {
    // The server clock can be UTC. The open day must follow the browser,
    // which is only known after hydration.
    const localToday = todayKey();
    if (localToday !== initialDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(localToday);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRef = useRef(visibleDates);
  useEffect(() => {
    visibleRef.current = visibleDates;
  }, [visibleDates]);

  // Once per visit: move overdue tasks to today and collect lingering ones.
  useEffect(() => {
    void (async () => {
      const localToday = todayKey();
      try {
        const settled = await settleOpenTasks(localToday);
        setPrompts(
          settled.prompts.filter((task) => !dismissed.current.has(task.id)),
        );
        if (settled.movedCount > 0) {
          const n = settled.movedCount;
          say(
            n === 1
              ? "Невыполненное дело перенесено на сегодня"
              : `${n} ${pluralTasks(n)} с прошлых дней перенесены на сегодня`,
          );
        }
        if (settled.moved) {
          setTasks((prev) =>
            prev.filter((task) => task.done || task.date >= localToday),
          );
          await loadRange(visibleRef.current);
        }
      } catch {
        setToast("Не удалось перенести старые дела");
      }
    })();
  }, [loadRange, setToast, say]);

  // The server already rendered the initial day; fetch only when the range changes.
  const loadedRange = useRef(initialDate);
  useEffect(() => {
    if (loadedRange.current === rangeKey) return;
    loadedRange.current = rangeKey;
    void loadRange(visibleDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, loadRange]);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => visibleDates.includes(t.date)),
    [tasks, visibleDates],
  );

  const title = useMemo(() => {
    if (mode === "month") return formatMonthTitle(date);
    if (mode === "week") {
      const days = getWeekDays(date);
      return `${format(fromDateKey(days[0]), "d MMM", { locale: ru })} — ${format(fromDateKey(days[6]), "d MMM yyyy", { locale: ru })}`;
    }
    return null;
  }, [mode, date]);

  function handleNavigate(delta: number) {
    if (mode === "day") {
      setDate((d) => shiftDateKey(d, delta));
    } else if (mode === "week") {
      setDate((d) => shiftDateKey(d, delta * 7));
    } else {
      setDate((d) => toDateKey(addMonths(startOfMonth(parseISO(d)), delta)));
    }
  }

  function goToday() {
    setDate(todayKey());
    setMode("day");
  }

  function selectDay(day: string) {
    setDate(day);
    setMode("day");
  }

  async function handleCreate(input: CreateTaskInput) {
    const task = unwrap(await createTask(input));
    setTasks((prev) => [...prev, task]);
  }

  async function handleUpdate(id: string, input: CreateTaskInput) {
    const task = unwrap(await updateTask(id, input));
    setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
    // A task moved to another day no longer lingers.
    setPrompts((prev) => prev.filter((t) => t.id !== id));
  }

  const dismissCheer = useCallback(() => setCheerKey(0), []);

  // Toggle and delete update the screen first and reconcile with the server after.
  const pending = useRef(new Set<string>());

  async function handleToggle(id: string) {
    const before = tasks.find((task) => task.id === id);
    if (!before || pending.current.has(id)) return;
    pending.current.add(id);

    const done = !before.done;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    if (done) {
      setCheerKey((key) => key + 1);
      setPrompts((prev) => prev.filter((task) => task.id !== id));
    }

    try {
      const result = unwrap(await toggleTask(id));
      setTasks((prev) => prev.map((t) => (t.id === id ? result.task : t)));
      if (result.newlyUnlocked.length > 0) {
        celebrate(result.newlyUnlocked);
      }
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === id ? before : t)));
      setToast(errorText(err, "Не удалось обновить дело"));
    } finally {
      pending.current.delete(id);
    }
  }

  async function answer(
    id: string,
    action: () => Promise<ActionResult<void>>,
    drop: boolean,
  ) {
    dismissed.current.add(id);
    setBusyId(id);
    try {
      unwrap(await action());
      if (drop) setTasks((prev) => prev.filter((task) => task.id !== id));
      setPrompts((prev) => prev.filter((task) => task.id !== id));
    } catch (err) {
      dismissed.current.delete(id);
      setToast(errorText(err, "Не удалось обновить дело"));
    } finally {
      setBusyId(null);
    }
  }

  // Deleting waits a few seconds so "Отменить" can bring the task back untouched.
  const pendingDeletes = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  const commitDelete = useCallback(
    async (task: TaskDTO) => {
      pendingDeletes.current.delete(task.id);
      const result = await deleteTask(task.id);
      if (!result.ok) {
        setTasks((prev) =>
          prev.some((t) => t.id === task.id) ? prev : [...prev, task],
        );
        setToast(result.error);
        return;
      }
      setPrompts((prev) => prev.filter((t) => t.id !== task.id));
    },
    [setToast],
  );

  const deleting = useRef(new Map<string, TaskDTO>());
  useEffect(() => {
    const timers = pendingDeletes.current;
    const tasksById = deleting.current;
    const flush = () => {
      for (const [id, timer] of timers) {
        clearTimeout(timer);
        const task = tasksById.get(id);
        if (task) void commitDelete(task);
      }
      timers.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [commitDelete]);

  function handleDelete(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task || pending.current.has(id) || pendingDeletes.current.has(id))
      return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setPrompts((prev) => prev.filter((t) => t.id !== id));
    deleting.current.set(id, task);
    pendingDeletes.current.set(
      id,
      setTimeout(() => {
        deleting.current.delete(id);
        void commitDelete(task);
      }, 5200),
    );
    const text = task.shared
      ? `Удалено у вас: «${short(task.title)}». У ${task.partners.length > 1 ? "друзей" : "друга"} дело осталось`
      : `Удалено: «${short(task.title)}»`;
    say(text, () => {
      const timer = pendingDeletes.current.get(id);
      if (!timer) return;
      clearTimeout(timer);
      pendingDeletes.current.delete(id);
      deleting.current.delete(id);
      setTasks((prev) =>
        prev.some((t) => t.id === id) ? prev : [...prev, task],
      );
    });
  }

  async function handlePostpone(id: string) {
    const before = tasks.find((t) => t.id === id);
    if (!before || pending.current.has(id)) return;
    pending.current.add(id);
    const target = shiftDateKey(before.date, 1);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, date: target, originDate: target } : t,
      ),
    );
    setPrompts((prev) => prev.filter((t) => t.id !== id));
    try {
      const moved = unwrap(await moveTask(id, target));
      setTasks((prev) => prev.map((t) => (t.id === id ? moved : t)));
      say(`«${short(before.title)}» — на завтра`, () => {
        setTasks((prev) => prev.map((t) => (t.id === id ? before : t)));
        void moveTask(id, before.date, before.originDate).then((result) => {
          if (!result.ok) setToast(result.error);
          else
            setTasks((prev) =>
              prev.map((t) => (t.id === id ? result.data : t)),
            );
        });
      });
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === id ? before : t)));
      setToast(errorText(err, "Не удалось перенести дело"));
    } finally {
      pending.current.delete(id);
    }
  }

  function applyItems(result: ToggleResult, wasDone: boolean) {
    setTasks((prev) =>
      prev.map((t) => (t.id === result.task.id ? result.task : t)),
    );
    if (result.task.done && !wasDone) {
      setCheerKey((key) => key + 1);
      setPrompts((prev) => prev.filter((t) => t.id !== result.task.id));
    }
    if (result.newlyUnlocked.length > 0) celebrate(result.newlyUnlocked);
  }

  // Item checks are queued per task so quick taps arrive in order.
  const itemQueue = useRef(new Map<string, Promise<unknown>>());
  function queued<T>(taskId: string, run: () => Promise<T>): Promise<T> {
    const previous = itemQueue.current.get(taskId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(run);
    itemQueue.current.set(taskId, next);
    return next;
  }

  function handleItemToggle(taskId: string, itemId: string) {
    const before = tasks.find((t) => t.id === taskId);
    if (!before) return;
    const items = before.items.map((it) =>
      it.id === itemId ? { ...it, done: !it.done } : it,
    );
    const done = items.every((it) => it.done);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, items, done } : t)),
    );
    if (done && !before.done) setCheerKey((key) => key + 1);
    void queued(taskId, () => toggleTaskItem(taskId, itemId)).then((result) => {
      if (!result.ok) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? before : t)));
        setToast(result.error);
        return;
      }
      // The cheer already played on the optimistic update.
      applyItems(result.data, true);
    });
  }

  async function handleItemAdd(taskId: string, text: string) {
    const before = tasks.find((t) => t.id === taskId);
    const result = await queued(taskId, () => addTaskItem(taskId, text));
    if (!result.ok) {
      setToast(result.error);
      throw new Error(result.error);
    }
    applyItems(result.data, before?.done ?? false);
  }

  function handleItemRemove(taskId: string, itemId: string) {
    const before = tasks.find((t) => t.id === taskId);
    if (!before) return;
    const items = before.items.filter((it) => it.id !== itemId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, items } : t)),
    );
    void queued(taskId, () => removeTaskItem(taskId, itemId)).then((result) => {
      if (!result.ok) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? before : t)));
        setToast(result.error);
        return;
      }
      applyItems(result.data, before.done);
    });
  }

  const handlers: TaskHandlers = {
    onToggle: (id) => void handleToggle(id),
    onDelete: handleDelete,
    onUpdate: handleUpdate,
    onPostpone: (id) => void handlePostpone(id),
    onItemToggle: handleItemToggle,
    onItemAdd: handleItemAdd,
    onItemRemove: handleItemRemove,
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <SegmentedControl value={mode} onChange={setMode} />
        <div className={styles.navGroup}>
          <button
            type="button"
            className={
              searching
                ? `${styles.searchBtn} ${styles.searchOn}`
                : styles.searchBtn
            }
            onClick={() => setSearching((value) => !value)}
            aria-label="Поиск по делам"
            aria-expanded={searching}
            title="Поиск"
          >
            <SearchIcon />
          </button>
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => handleNavigate(-1)}
              aria-label="Назад"
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.todayBtn}
              onClick={goToday}
              aria-label={
                date === todayKey() ? "Сегодня" : "Вернуться к сегодня"
              }
            >
              {mode === "day" ? plannerNavLabel(date) : "Сегодня"}
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => handleNavigate(1)}
              aria-label="Вперёд"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {searching ? (
        <TaskSearch
          onClose={() => setSearching(false)}
          onPick={(day) => {
            setSearching(false);
            selectDay(day);
          }}
        />
      ) : null}

      {title ? <h2 className={styles.rangeTitle}>{title}</h2> : null}

      <StalePrompt
        tasks={prompts}
        busyId={busyId}
        onKeep={(id) => void answer(id, () => keepTask(id, todayKey()), false)}
        onDelete={(id) => void answer(id, () => removeTask(id), true)}
      />

      {mode === "day" ? (
        <DayView
          date={date}
          tasks={visibleTasks}
          friends={friends}
          onCreate={handleCreate}
          handlers={handlers}
          busyId={busyId}
        />
      ) : null}

      {mode === "week" ? (
        <WeekView date={date} tasks={visibleTasks} onSelectDay={selectDay} />
      ) : null}

      {mode === "month" ? (
        <MonthView date={date} tasks={visibleTasks} onSelectDay={selectDay} />
      ) : null}

      {cheerKey > 0 ? (
        <DoneCelebration key={cheerKey} onDone={dismissCheer} />
      ) : null}

      {notice ? (
        <UndoToast
          key={notice.key}
          text={notice.text}
          onUndo={notice.undo}
          onClose={closeNotice}
        />
      ) : null}

      {toast ? (
        <AchievementToast
          kind={toast.kind}
          icon={toast.icon}
          title={toast.text}
          onClose={() => setToastState(null)}
        />
      ) : null}

      <VoiceMic
        focusDate={date}
        onApplied={({ created, removedIds }) => {
          if (created.length > 0) {
            setTasks((prev) => [...prev, ...created]);
          }
          if (removedIds.length > 0) {
            const gone = new Set(removedIds);
            setTasks((prev) => prev.filter((task) => !gone.has(task.id)));
            setPrompts((prev) => prev.filter((task) => !gone.has(task.id)));
          }
        }}
      />
    </div>
  );
}

function short(title: string): string {
  return title.length > 32 ? `${title.slice(0, 30)}…` : title;
}

function pluralTasks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "дело";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дела";
  return "дел";
}
