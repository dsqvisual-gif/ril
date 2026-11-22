"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { finishOnboarding } from "@/lib/actions/onboarding";
import styles from "./Onboarding.module.css";

type Step = {
  title: string;
  text: string;
  scene: React.ReactNode;
};

const STEPS: Step[] = [
  {
    title: "Привет! Я Успейка",
    text: "Помогу успевать главное и не забывать мелочи. Покажу всё за минуту — или нажми «Пропустить».",
    scene: (
      <div className={styles.hello}>
        <Image src="/mascot.webp" alt="" width={640} height={1028} className={styles.helloMascot} />
      </div>
    ),
  },
  {
    title: "Дела на день, неделю и месяц",
    text: "Записывай дела, ставь время и отмечай «Важно» или «Срочно». Из-за важных дел я буду выглядывать, чтобы они не потерялись.",
    scene: (
      <div className={styles.tasks}>
        <div className={`${styles.task} ${styles.taskImportant}`}>
          <Image src="/mascot-peek.webp" alt="" width={200} height={156} className={styles.peek} />
          <i />
          <span>Подготовить презентацию</span>
          <b>Важно</b>
        </div>
        <div className={styles.task}>
          <i className={styles.done}>✓</i>
          <span className={styles.striked}>Купить продукты</span>
        </div>
        <div className={styles.task}>
          <i />
          <span>Тренировка</span>
          <em>19:00</em>
        </div>
      </div>
    ),
  },
  {
    title: "Можно просто сказать",
    text: "Нажми на микрофон и скажи: «завтра в 10 созвон с Мариной, это важно». Я сам разложу дело по дню, времени и позову Марину.",
    scene: (
      <div className={styles.voice}>
        <span className={styles.mic}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
          </svg>
        </span>
        <p className={styles.bubble}>«Завтра в 10 созвон с Мариной, это важно»</p>
      </div>
    ),
  },
  {
    title: "Цели — большие и маленькие",
    text: "«Прочитать 12 книг» я посчитаю числом, а «стать спокойнее» — по твоей оценке. Записывай, что уже сделано, и смотри, как растёт прогресс.",
    scene: (
      <div className={styles.goal}>
        <p>Прочитать 12 книг</p>
        <div className={styles.bar}>
          <span />
        </div>
        <small>5 из 12 книг · 42%</small>
      </div>
    ),
  },
  {
    title: "Вместе веселее",
    text: "Добавляй друзей по нику и делай общие дела. А для работы заведи компанию: раздавай задачи, ставь дедлайны и смотри график команды.",
    scene: (
      <div className={styles.people}>
        <span>МК</span>
        <span>А</span>
        <span>Т</span>
        <b>+3</b>
      </div>
    ),
  },
  {
    title: "Всё под себя — в профиле",
    text: "Нажми на своё имя вверху: там оформление (8 тем, есть тёмная), письма с планом на день и регулярные напоминания — например, о чекапе 4 раза в год.",
    scene: (
      <div className={styles.swatches}>
        {["#f5f7fb", "#1b1e24", "#ffe3ee", "#e9e3ff", "#dcf5ea", "#ffe8d6"].map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </div>
    ),
  },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const last = step === STEPS.length - 1;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (event.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    void finishOnboarding();
  }

  if (!open) return null;
  const current = STEPS[step];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className={styles.card}>
        <button type="button" className={styles.skip} onClick={close}>
          Пропустить
        </button>
        <div className={styles.scene} key={step}>
          {current.scene}
        </div>
        <h2 id="onboarding-title" className={styles.title}>
          {current.title}
        </h2>
        <p className={styles.text}>{current.text}</p>

        <div className={styles.dots} aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? styles.dotActive : undefined} />
          ))}
        </div>

        <div className={styles.actions}>
          {step > 0 ? (
            <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
              Назад
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (last ? close() : setStep(step + 1))}
          >
            {last ? "Начать" : "Дальше"}
          </button>
        </div>
      </div>
    </div>
  );
}
