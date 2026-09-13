import type { Achievement } from "@aionix/shared";
import { ShoppingBasket, Trophy, Heart, Leaf, Gift, Crown, Star, Compass, CalendarDays, Coins, Rocket, Sparkles } from "lucide-react";
import styles from "./achievements.module.css";

const icons = { sparkles: Sparkles, basket: ShoppingBasket, trophy: Trophy, heart: Heart, leaf: Leaf, gift: Gift, crown: Crown, star: Star, compass: Compass, calendar: CalendarDays, coins: Coins, rocket: Rocket };

export function Medal({ icon, color, unlocked = true, large = false }: Pick<Achievement, "icon" | "color"> & { unlocked?: boolean; large?: boolean }) {
  const Icon = icons[icon] ?? Trophy;
  return <span aria-hidden="true" className={`${styles.medal} ${styles[color]} ${large ? styles.largeMedal : ""} ${unlocked ? "" : styles.lockedMedal}`}>
    <svg viewBox="0 0 100 114" fill="none" className={styles.medalShape}>
      <path d="M26 71 20 111 37 101 49 114 54 75M74 71 80 111 63 101 51 114 46 75" fill="currentColor" opacity=".65" />
      <path d="m50 3 12 6 13 1 7 11 11 8 1 14 4 12-7 12-3 13-13 5-10 9-15-1-15 1-10-9-13-5-3-13-7-12 4-12 1-14 11-8 7-11 13-1Z" fill="currentColor" />
      <circle cx="50" cy="48" r="33" fill="var(--medal-face)" stroke="var(--medal-edge)" strokeWidth="2" />
      <circle cx="50" cy="48" r="27" stroke="currentColor" strokeWidth="1" opacity=".42" strokeDasharray="2 4" />
    </svg>
    <Icon className={styles.medalIcon} strokeWidth={1.8} />
  </span>;
}
