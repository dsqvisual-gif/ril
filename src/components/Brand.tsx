import Image from "next/image";
import Link from "next/link";
import styles from "./Brand.module.css";

type Props = {
  href: string;
  className?: string;
};

export function Brand({ href, className }: Props) {
  return (
    <Link href={href} className={`${styles.link} ${className ?? ""}`} aria-label="Uspeyka — на главную">
      <Image
        src="/logo.svg"
        alt="Uspeyka"
        width={2856}
        height={646}
        priority
        unoptimized
        className={styles.logo}
      />
    </Link>
  );
}
