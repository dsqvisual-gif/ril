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
import {
  archiveTask,
  createTask,
  deleteTask,
  keepTask,
  removeTask,
  settleOpenTasks,
  toggleTask,
  type CreateTaskInput,
  type TaskDTO,
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
import { ACHIEVEMENTS } from "@/lib/achievements";
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
  const [toast, setToast] = useState<string | null>(null);
  const [cheerKey, setCheerKey] = useState(0);
  const [prompts, setPrompts] = useState<TaskDTO[]>([]);
  const dismissed = useRef(new Set<string>());

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const localToday = todayKey();
      try {
        const stale = await settleOpenTasks(localToday);
        if (cancelled) return;
        setPrompts(stale.filter((task) => !dismissed.current.has(task.id)));
        setTasks((prev) => prev.filter((task) => task.done || task.date >= localToday));
      } catch {
        if (!cancelled) setToast("Не удалось перенести старые дела");
      }
      if (!cancelled) await loadRange(visibleDates);
    })();
    return () => {
      cancelled = true;
    };
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

  const dismissCheer = useCallback(() => setCheerKey(0), []);

  async function handleToggle(id: string) {
    const wasDone = tasks.some((task) => task.id === id && task.done);
    setBusyId(id);
    try {
      const result = unwrap(await toggleTask(id));
      setTasks((prev) => prev.map((t) => (t.id === id ? result.task : t)));
      if (!wasDone && result.task.done) {
        setCheerKey((key) => key + 1);
      }
      if (result.task.done) {
        setPrompts((prev) => prev.filter((task) => task.id !== id));
      }
      if (result.newlyUnlocked.length > 0) {
        const first = ACHIEVEMENTS.find(
          (a) => a.code === result.newlyUnlocked[0],
        );
        setToast(first?.title ?? "Достижение разблокировано");
      }
    } catch (err) {
      setToast(errorText(err, "Не удалось обновить дело"));
    } finally {
      setBusyId(null);
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

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      unwrap(await deleteTask(id));
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setPrompts((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setToast(errorText(err, "Не удалось удалить дело"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <SegmentedControl value={mode} onChange={setMode} />
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
            aria-label={date === todayKey() ? "Сегодня" : "Вернуться к сегодня"}
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

      {title ? <h2 className={styles.rangeTitle}>{title}</h2> : null}

      <StalePrompt
        tasks={prompts}
        busyId={busyId}
        onKeep={(id) => void answer(id, () => keepTask(id, todayKey()), false)}
        onArchive={(id) => void answer(id, () => archiveTask(id), true)}
        onDelete={(id) => void answer(id, () => removeTask(id), true)}
      />

      {mode === "day" ? (
        <DayView
          date={date}
          tasks={visibleTasks}
          friends={friends}
          onCreate={handleCreate}
          onToggle={handleToggle}
          onDelete={handleDelete}
          busyId={busyId}
        />
      ) : null}

      {mode === "week" ? (
        <WeekView date={date} tasks={visibleTasks} onSelectDay={selectDay} />
      ) : null}

      {mode === "month" ? (
        <MonthView date={date} tasks={visibleTasks} onSelectDay={selectDay} />
      ) : null}

      {cheerKey > 0 ? <DoneCelebration key={cheerKey} onDone={dismissCheer} /> : null}

      {toast ? (
        <AchievementToast title={toast} onClose={() => setToast(null)} />
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
