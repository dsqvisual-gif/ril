import Image from "next/image";
import styles from "./MascotIdle.module.css";

type Props = {
  className?: string;
};

/** Маскот в режиме ожидания: дышит, покачивается, моргает и «печатает». */
export function MascotIdle({ className }: Props) {
  return (
    <div className={`${styles.wrap} ${className ?? ""}`} aria-hidden>
      <div className={styles.bubble}>
        <i />
        <i />
        <i />
      </div>
      <div className={styles.sway}>
        <div className={styles.breathe}>
          <Image
            src="/mascot.webp"
            alt=""
            width={640}
            height={1028}
            priority
            className={styles.img}
            sizes="(max-width: 860px) 150px, 280px"
          />
          <span className={`${styles.lid} ${styles.lidLeft}`} />
          <span className={`${styles.lid} ${styles.lidRight}`} />
        </div>
      </div>
      <div className={styles.shadow} />
    </div>
  );
}
