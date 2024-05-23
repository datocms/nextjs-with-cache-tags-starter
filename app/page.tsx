import styles from "./page.module.css";
import LastPosts from "./LastPosts";

export const dynamic = "error";

export default function Home() {
  return (
    <main className={styles.main}>
      <LastPosts />
    </main>
  );
}
