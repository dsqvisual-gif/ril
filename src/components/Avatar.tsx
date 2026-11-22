/* eslint-disable @next/next/no-img-element -- small avatars from our API or Google; no optimisation needed */
import styles from "./Avatar.module.css";

type Props = {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
};

/** A round profile photo, or the first letter of the name when there is none. */
export function Avatar({ src, name, size = 36, className }: Props) {
  const letter = name.replace(/^@/, "").trim().slice(0, 1).toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  return src ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`${styles.avatar} ${className ?? ""}`}
      style={style}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  ) : (
    <span className={`${styles.avatar} ${styles.letter} ${className ?? ""}`} style={style} aria-hidden>
      {letter}
    </span>
  );
}
