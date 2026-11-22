import Image from "next/image";
import Link from "next/link";
import styles from "./Brand.module.css";

type Props = {
  href: string;
  className?: string;
  /** Lettering only, without the cloud: used in the app header. */
  wordmark?: boolean;
};

export function Brand({ href, className, wordmark = false }: Props) {
  if (wordmark) {
    return (
      <Link href={href} className={`${styles.link} ${className ?? ""}`} aria-label="Uspeyka — на главную">
        <Image
          src="/wordmark.svg"
          alt="Uspeyka"
          width={1969}
          height={472}
          priority
          unoptimized
          className={`${styles.wordmark} ${styles.onLight}`}
        />
        <Image
          src="/wordmark-dark.svg"
          alt=""
          aria-hidden
          width={1969}
          height={472}
          unoptimized
          className={`${styles.wordmark} ${styles.onDark}`}
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
