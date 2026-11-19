"use client";

import styles from "./SegmentedControl.module.css";

export type ViewMode = "day" | "week" | "month";

const LABELS: { id: ViewMode; label: string }[] = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
];

type Props = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
};

export function SegmentedControl({ value, onChange }: Props) {
  return (
    <div className={styles.root} role="tablist" aria-label="Вид календаря">
      {LABELS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={value === item.id ? styles.active : styles.item}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
