import Image from "next/image";
import Link from "next/link";
import styles from "./Brand.module.css";

type Props = {
  href: string;
  large?: boolean;
  compact?: boolean;
};

export function Brand({ href, large = false, compact = false }: Props) {
  const size = large ? 72 : 36;
  const variant = large ? styles.large : compact ? `${styles.link} ${styles.compact}` : styles.link;

  return (
    <Link href={href} className={variant}>
      <Image
        src="/plano-mark.png"
        alt=""
        width={size}
        height={size}
        className={styles.mark}
        priority
      />
      <span className={styles.word}>PLANO</span>
    </Link>
  );
}
