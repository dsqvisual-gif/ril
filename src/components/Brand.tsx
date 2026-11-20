import Link from "next/link";
import styles from "./Brand.module.css";

type Props = {
  href: string;
};

export function Brand({ href }: Props) {
  return (
    <Link href={href} className={styles.link}>
      Uspeyka
    </Link>
  );
}
