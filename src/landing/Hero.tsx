import { useL } from "../i18n";
import DateInput from "../components/DateInput";
import { todayStr } from "../lib/format";
import type { Room } from "../lib/types";
import type { Search } from "./availability";
import { useTheme } from "../lib/theme";
import ForestScene, { Bats, Drift, Fireflies, Garland, Lanterns, Petals, Snowfall } from "./ForestScene";
import NumInput from "../components/NumInput";

export default function Hero({ rooms, search, setSearch }: { rooms: Room[]; search: Search; setSearch: (s: Search) => void }) {
  const L = useL();
  const { theme, effects } = useTheme();
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  };
  const set = (patch: Partial<Search>) => setSearch({ ...search, ...patch });

  return (
    <section id="home" className="lp-hero">
      <div className="lp-scene"><ForestScene theme={theme} id="hero" />{theme === "noel" && <Garland />}{theme === "tet" && <Lanterns />}{effects && <><Fireflies /><Drift />{theme === "noel" && <Snowfall />}{theme === "halloween" && <Bats />}{theme === "tet" && <Petals />}</>}</div>
      <div className="lp-wrap lp-hero-in">
        <div className="lp-hero-l reveal">
          <span className="lp-eyebrow">{L.hero.eyebrow}</span>
          <h1>{L.hero.title1} <em>{L.hero.title2}</em></h1>
          <p>{L.hero.sub}</p>
          <div className="lp-cta">
            <a className="lp-btn primary" href="#booking">{L.hero.cta1}</a>
            <a className="lp-btn ghost" href="#about">{L.hero.cta2}</a>
          </div>
        </div>
        <div className="lp-hero-badges">
          <div className="lp-float f1">{L.hero.badge1}</div>
          <div className="lp-float f2">{L.hero.badge2}</div>
        </div>
      </div>
      <form className="lp-wrap lp-quick reveal" onSubmit={go}>
        <label>{L.search.checkIn}
          <DateInput min={todayStr()} value={search.checkIn} onChange={(v) => set({ checkIn: v })} required />
        </label>
        <label>{L.search.checkOut}
          <DateInput min={search.checkIn} value={search.checkOut} onChange={(v) => set({ checkOut: v })} required />
        </label>
        <label>{L.search.room}
          <select value={search.roomId} onChange={(e) => set({ roomId: e.target.value })}>
            <option value="">{L.search.allRooms}</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label>{L.search.guests}
          <NumInput min={1} max={30} value={search.guests} onChange={(e) => set({ guests: Math.max(1, +e.target.value || 1) })} />
        </label>
        <button className="lp-btn primary" type="submit">{L.search.go}</button>
      </form>
    </section>
  );
}
