"use client";

import { useEffect } from "react";
import styles from "./DoneCelebration.module.css";

const BITS = [
  { x: "-140px", y: "-90px", c: "#34c759", d: "0s" },
  { x: "130px", y: "-100px", c: "#007aff", d: "0.04s" },
  { x: "-90px", y: "80px", c: "#ff9f0a", d: "0.02s" },
  { x: "110px", y: "70px", c: "#ff375f", d: "0.06s" },
  { x: "0px", y: "-130px", c: "#64d2ff", d: "0.01s" },
  { x: "-160px", y: "10px", c: "#30d158", d: "0.05s" },
  { x: "160px", y: "-10px", c: "#bf5af2", d: "0.03s" },
  { x: "-40px", y: "120px", c: "#ffd60a", d: "0.07s" },
  { x: "50px", y: "130px", c: "#007aff", d: "0.02s" },
  { x: "-110px", y: "-40px", c: "#ff9f0a", d: "0.08s" },
  { x: "80px", y: "-50px", c: "#34c759", d: "0.04s" },
  { x: "20px", y: "-70px", c: "#ff375f", d: "0.06s" },
];

type Props = {
  onDone: () => void;
};

export function DoneCelebration({ onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2400);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.burst} aria-hidden>
        {BITS.map((bit, index) => (
          <span
            key={index}
            className={styles.bit}
            style={{
              ["--x" as string]: bit.x,
              ["--y" as string]: bit.y,
              ["--c" as string]: bit.c,
              ["--d" as string]: bit.d,
            }}
          />
        ))}
      </div>
      <div className={styles.card}>
        <div className={styles.check}>✓</div>
        <p className={styles.title}>Ты это сделал</p>
      </div>
    </div>
  );
}
