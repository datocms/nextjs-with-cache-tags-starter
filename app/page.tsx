import styles from "./page.module.css";
import LastPosts from "./LastPosts";

export default function Home() {
  return (
    <main className={styles.main}>
      <LastPosts />
    </main>
  );
}
