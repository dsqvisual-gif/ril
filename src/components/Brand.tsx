import Image from "next/image";
import Link from "next/link";
import styles from "./Brand.module.css";

type Props = {
  href: string;
  className?: string;
  /** The cloud only, without the lettering: used in the app header. */
  mark?: boolean;
};

export function Brand({ href, className, mark = false }: Props) {
  if (mark) {
    return (
      <Link href={href} className={`${styles.link} ${className ?? ""}`} aria-label="Uspeyka — на главную">
        <Image
          src="/mark.svg"
          alt="Uspeyka"
          width={770}
          height={670}
          priority
          unoptimized
          className={`${styles.mark} ${styles.onLight}`}
        />
        <Image
          src="/mark-dark.svg"
          alt=""
          aria-hidden
          width={770}
          height={670}
          unoptimized
          className={`${styles.mark} ${styles.onDark}`}
        />
      </Link>
    );
  }

  return (
    <Link href={href} className={`${styles.link} ${className ?? ""}`} aria-label="Uspeyka — на главную">
      <Image
        src="/logo.svg"
        alt="Uspeyka"
        width={2856}
        height={646}
        priority
        unoptimized
        className={`${styles.logo} ${styles.onLight}`}
      />
      {/* Light lettering for the dark themes. */}
      <Image
        src="/logo-dark.svg"
        alt=""
        aria-hidden
        width={2856}
        height={646}
        unoptimized
        className={`${styles.logo} ${styles.onDark}`}
      />
    </Link>
  );
}
