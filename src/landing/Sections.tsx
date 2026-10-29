import { Link } from "react-router-dom";
import { useMoney } from "../lib/useRate";
import { useL } from "../i18n";
import { site } from "../lib/siteConfig";
import { safeUrl, useContact, zaloHref } from "../lib/contact";
import type { Room } from "../lib/types";
import type { Search } from "./availability";
import Icon, { type IconName } from "./Icon";
import ForestScene, { Bats, Drift, Fireflies, MiniPines, Petals, Snowfall, TreeLine } from "./ForestScene";
import { useTheme } from "../lib/theme";
import HashLink from "../components/HashLink";
import Stars from "../components/Stars";
import ReviewCard from "../components/ReviewCard";
import { useApprovedReviews } from "../lib/reviews";
import { fmtDate } from "../lib/pages";
import { useI18n } from "../i18n";

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
    <section id="about" className="lp-section lp-pines">
      <div className="lp-wrap lp-about">
        <div className="lp-about-art reveal" aria-hidden="true">
          <div className="lp-tile t1"><Icon name="home" /></div><div className="lp-tile t2"><Icon name="tree" /></div>
          <div className="lp-tile t3"><Icon name="pot" /></div><div className="lp-tile t4"><Icon name="water" /></div>
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
          {rooms.map((r) => (
            <article key={r.id} className="lp-room reveal">
              <Link to={`/phong/${r.id}`} className="lp-room-img" aria-label={r.name}>
                {r.photos?.[0] ? <img src={r.photos[0]} alt={r.name} loading="lazy" decoding="async" /> : <Icon name={r.type === "wood" ? "home" : "bed"} />}
              </Link>
              <div className="lp-room-body">
                <small>{r.type === "wood" ? L.rooms.wood : L.rooms.concrete}</small>
                <h3>{r.name}</h3>
                <div className="lp-muted">{L.rooms.capacity}: {r.capacity} {L.rooms.up}</div>
                <div className="lp-price">{money(r.price)} <span>{L.rooms.perNight}</span></div>
                <div className="lp-room-actions">
                  <button className="lp-btn primary sm" onClick={() => view(r.id)}>{L.rooms.view}</button>
                  <Link className="lp-btn ghost sm" to={`/phong/${r.id}`}>{L.rooms.detail}</Link>
                </div>
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
    <section id="features" className="lp-section forest">
      <TreeLine seed={11} />
      <div className="lp-feat-bg" aria-hidden="true"><i /><i /><i /><b /></div>
      <div className="lp-wrap">
        <div className="lp-head reveal">
          <span className="lp-eyebrow">{L.features.eyebrow}</span>
          <h2>{L.features.title}</h2>
          <span className="lp-orn" aria-hidden="true"><i /><em>✦</em><i /></span>
        </div>
        <div className="lp-grid">
          {L.features.items.map((f, i) => (
            <div key={f.t} className="lp-feature reveal" style={{ ["--i" as string]: i }}>
              <span className="lp-feat-no" aria-hidden="true"><MiniPines n={(i % 3) + 1} /></span>
              <div className="lp-ico"><Icon name={f.i} /></div>
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

/** Cảm nhận đã được duyệt: 3 cảm nhận mới nhất, kèm liên kết xem tất cả và gửi cảm nhận. */
export function Testimonials() {
  const L = useL();
  const { lang } = useI18n();
  const { reviews, avg, loading } = useApprovedReviews();
  const shown = reviews.slice(0, 3);
  return (
    <section id="reviews" className="lp-section alt lp-pines">
      <div className="lp-wrap">
        <div className="lp-head reveal">
          <span className="lp-eyebrow">{L.reviews.homeEyebrow}</span>
          <h2>{L.reviews.homeTitle}</h2>
          {reviews.length > 0 && <p className="lp-avg"><Stars value={avg} label={L.reviews.stars} /> <strong>{avg.toFixed(1)}</strong> · {reviews.length} {L.reviews.count}</p>}
        </div>
        {!loading && shown.length === 0 && <p className="lp-center lp-muted">{L.reviews.homeEmpty}</p>}
        <div className="lp-reviews">
          {shown.map((r, i) => (
            <ReviewCard key={r.id} r={r} reveal featured={i === 0 && shown.length > 1} />
          ))}
        </div>
        <div className="lp-center lp-review-cta">
          {reviews.length > 0 && <Link className="lp-btn ghost" to="/reviews">{L.reviews.all}</Link>}
          <Link className="lp-btn primary" to="/reviews#write">{L.reviews.write}</Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const L = useL();
  const c = useContact();
  const rows: [string, string, string | undefined, IconName][] = [
    [L.footer.phone, c.phone, c.phone && `tel:${c.phone.replace(/[^\d+]/g, "")}`, "phone"],
    [L.footer.zalo, c.zalo, zaloHref(c.zalo), "chat"],
    [L.footer.email, c.email, c.email && `mailto:${c.email}`, "mail"],
    [L.footer.address, c.address, safeUrl(c.mapUrl), "pin"],
    [L.footer.facebook, c.facebook, safeUrl(c.facebook), "facebook"],
  ];
  const shown = rows.filter(([, v]) => v);
  const { theme, effects } = useTheme();
  return (
    <footer id="contact" className="lp-footer">
      <TreeLine seed={29} />
      <div className="lp-foot-bg" aria-hidden="true">
        <ForestScene theme={theme} id="foot" />
        {effects && <>{theme !== "mist" && <Fireflies count={10} />}<Drift />{theme === "noel" && <Snowfall count={26} />}{theme === "halloween" && <Bats count={4} />}{theme === "tet" && <Petals count={18} />}</>}
      </div>
      <div className="lp-wrap lp-footer-in">
        <div>
          <div className="lp-brand light"><span className="lp-logo"><img src="/favicon.svg" alt="" width="38" height="38" /></span><span>{site.name}</span></div>
          <p className="lp-muted-l">{L.footer.tagline}</p>
        </div>
        <div>
          <h4>{L.footer.links}</h4>
          <HashLink to="/#about">{L.menu.about}</HashLink><HashLink to="/#rooms">{L.menu.rooms}</HashLink>
          <HashLink to="/#features">{L.menu.features}</HashLink><HashLink to="/#booking">{L.menu.availability}</HashLink>
        </div>
        <div>
          <h4>{L.footer.info}</h4>
          <Link to="/explore">{L.menu.explore}</Link><Link to="/reviews">{L.menu.reviews}</Link><Link to="/faq">{L.menu.faq}</Link><Link to="/rules">{L.menu.rules}</Link><Link to="/privacy">{L.menu.privacy}</Link><Link to="/sitemap">{L.menu.sitemap}</Link>
        </div>
        <div>
          <h4>{L.footer.contact}</h4>
          {shown.length === 0 && <p className="lp-muted-l">{L.footer.contactSoon}</p>}
          {shown.map(([k, v, href, icon]) => (
            <div key={k} className="lp-contact-row">{href
              ? <a href={href} target="_blank" rel="noopener noreferrer"><Icon name={icon} />{k}: {v}</a>
              : <span><Icon name={icon} />{k}: {v}</span>}</div>
          ))}
        </div>
      </div>
      <div className="lp-wrap lp-copy">
        <span>© {new Date().getFullYear()} {site.name}. {L.footer.rights}</span>
        <button type="button" className="lp-totop" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label={L.footer.top}>↑ {L.footer.top}</button>
        <Link to="/app">{L.footer.staff}</Link>
      </div>
    </footer>
  );
}
