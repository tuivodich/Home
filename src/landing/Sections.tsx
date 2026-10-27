import { Link } from "react-router-dom";
import { useMoney } from "../lib/useRate";
import { useL } from "../i18n";
import { site } from "../lib/siteConfig";
import type { Room } from "../lib/types";
import type { Search } from "./availability";

export function Stats() {
  const L = useL();
  return (
    <section className="lp-stats">
      <div className="lp-wrap lp-stats-in">
        {L.stats.map((s) => (
          <div key={s.l} className="reveal"><strong>{s.n}</strong><span>{s.l}</span></div>
        ))}
      </div>
    </section>
  );
}

export function About() {
  const L = useL();
  return (
    <section id="about" className="lp-section">
      <div className="lp-wrap lp-about">
        <div className="lp-about-art reveal" aria-hidden="true">
          <div className="lp-tile t1">🏡</div><div className="lp-tile t2">🌳</div><div className="lp-tile t3">🍳</div><div className="lp-tile t4">💧</div>
        </div>
        <div className="reveal">
          <span className="lp-eyebrow">{L.about.eyebrow}</span>
          <h2>{L.about.title}</h2>
          <p>{L.about.p1}</p>
          <p>{L.about.p2}</p>
          <ul className="lp-checks">{L.about.points.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}

const hues = [150, 28, 95, 190, 12];

export function RoomsShowcase({ rooms, search, setSearch }: { rooms: Room[]; search: Search; setSearch: (s: Search) => void }) {
  const L = useL();
  const { money } = useMoney();
  const view = (id: string) => {
    setSearch({ ...search, roomId: id });
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <section id="rooms" className="lp-section alt">
      <div className="lp-wrap">
        <div className="lp-head reveal">
          <span className="lp-eyebrow">{L.rooms.eyebrow}</span>
          <h2>{L.rooms.title}</h2>
          <p>{L.rooms.sub}</p>
        </div>
        {rooms.length === 0 && <p className="lp-center lp-muted">{L.rooms.empty}</p>}
        <div className="lp-rooms">
          {rooms.map((r, i) => (
            <article key={r.id} className="lp-room reveal" style={{ ["--h" as string]: hues[i % hues.length] }}>
              <div className="lp-room-img"><span>{r.type === "wood" ? "🏡" : "🛏️"}</span></div>
              <div className="lp-room-body">
                <small>{r.type === "wood" ? L.rooms.wood : L.rooms.concrete}</small>
                <h3>{r.name}</h3>
                <div className="lp-muted">👤 {r.capacity} {L.rooms.up}</div>
                <div className="lp-price">{money(r.price)} <span>{L.rooms.perNight}</span></div>
                <button className="lp-btn primary sm" onClick={() => view(r.id)}>{L.rooms.view}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Features() {
  const L = useL();
  return (
    <section id="features" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-head reveal">
          <span className="lp-eyebrow">{L.features.eyebrow}</span>
          <h2>{L.features.title}</h2>
        </div>
        <div className="lp-grid">
          {L.features.items.map((f) => (
            <div key={f.t} className="lp-feature reveal">
              <div className="lp-ico">{f.i}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const L = useL();
  return (
    <section className="lp-section alt">
      <div className="lp-wrap">
        <div className="lp-head reveal">
          <span className="lp-eyebrow">{L.how.eyebrow}</span>
          <h2>{L.how.title}</h2>
        </div>
        <ol className="lp-steps">
          {L.how.steps.map((s, i) => (
            <li key={s.t} className="reveal"><b>{i + 1}</b><h3>{s.t}</h3><p>{s.d}</p></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Footer() {
  const L = useL();
  const rows: [string, string, string?][] = [
    [L.footer.phone, site.phone, site.phone && `tel:${site.phone}`],
    [L.footer.zalo, site.zalo, site.zalo && `https://zalo.me/${site.zalo.replace(/\D/g, "")}`],
    [L.footer.email, site.email, site.email && `mailto:${site.email}`],
    [L.footer.address, site.address, site.mapUrl || undefined],
    [L.footer.facebook, site.facebook, site.facebook || undefined],
  ];
  const shown = rows.filter(([, v]) => v);
  return (
    <footer id="contact" className="lp-footer">
      <div className="lp-wrap lp-footer-in">
        <div>
          <div className="lp-brand light"><span className="lp-logo">🏡</span><span>{site.name}</span></div>
          <p className="lp-muted-l">{L.footer.tagline}</p>
        </div>
        <div>
          <h4>{L.footer.links}</h4>
          <a href="#about">{L.nav.about}</a><a href="#rooms">{L.nav.rooms}</a>
          <a href="#features">{L.nav.features}</a><a href="#booking">{L.nav.booking}</a>
        </div>
        <div>
          <h4>{L.footer.contact}</h4>
          {shown.length === 0 && <p className="lp-muted-l">{L.footer.contactSoon}</p>}
          {shown.map(([k, v, href]) => (
            <div key={k}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{k}: {v}</a> : <span>{k}: {v}</span>}</div>
          ))}
        </div>
      </div>
      <div className="lp-wrap lp-copy">
        <span>© {new Date().getFullYear()} {site.name}. {L.footer.rights}</span>
        <Link to="/app">{L.footer.staff}</Link>
      </div>
    </footer>
  );
}
