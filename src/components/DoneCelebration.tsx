"use client";

import { useEffect } from "react";
import Image from "next/image";
import styles from "./DoneCelebration.module.css";

const BITS = [
  { x: "-130px", y: "-120px", c: "#1757f5", d: "0.18s" },
  { x: "125px", y: "-130px", c: "#ffcc1f", d: "0.2s" },
  { x: "-150px", y: "-30px", c: "#fc6307", d: "0.22s" },
  { x: "150px", y: "-40px", c: "#34c759", d: "0.19s" },
  { x: "-70px", y: "-170px", c: "#ffcc1f", d: "0.21s" },
  { x: "75px", y: "-175px", c: "#1757f5", d: "0.23s" },
  { x: "0px", y: "-195px", c: "#fc6307", d: "0.2s" },
  { x: "-110px", y: "40px", c: "#34c759", d: "0.24s" },
  { x: "115px", y: "35px", c: "#ffcc1f", d: "0.22s" },
  { x: "-30px", y: "-150px", c: "#bf5af2", d: "0.25s" },
];

/** How long the cheer stays on screen, in ms. */
const DURATION = 1100;

type Props = {
  onDone: () => void;
};

export function DoneCelebration({ onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, DURATION);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.stage}>
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
        <p className={styles.bubble}>Ура!</p>
        <div className={styles.jump} aria-hidden>
          <Image
            src="/mascot.webp"
            alt=""
            width={640}
            height={1028}
            className={styles.mascot}
            sizes="150px"
          />
        </div>
        <div className={styles.shadow} aria-hidden />
      </div>
    </div>
  );
}
