import { useL } from "../i18n";
import { useG } from "../i18n/guest";
import { useCollection } from "../lib/useCollection";
import type { Room } from "../lib/types";
import { useAuth } from "../lib/auth";
import { useTitle } from "../lib/useTitle";
import SiteLayout from "../layout/SiteLayout";
import HashLink from "../components/HashLink";

/** Sơ đồ trang web: liệt kê mọi trang công khai theo nhóm menu (cho khách và công cụ tìm kiếm). Danh sách XML tương ứng ở /sitemap.xml. */
export default function SitemapPage() {
  const L = useL();
  const M = L.menu;
  const G = useG();
  const { data: rooms } = useCollection<Room>("rooms");
  const { user } = useAuth();
  useTitle(M.sitemap);

  const groups: { title: string; items: [string, string][] }[] = [
    { title: M.home, items: [[M.top, "/"], [M.about, "/#about"], [M.rooms, "/#rooms"], [M.features, "/#features"]] },
    ...(rooms.length ? [{ title: M.rooms, items: [...rooms].sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })).map((r): [string, string] => [r.name, `/phong/${r.id}`]) }] : []),
    { title: M.book, items: [[M.availability, "/#booking"], [M.faq, "/faq"]] },
    { title: M.exploreMenu, items: [[M.explore, "/explore"], [M.reviews, "/reviews"]] },
    { title: M.info, items: [[M.contact, "/#contact"], [M.privacy, "/privacy"], [M.sitemap, "/sitemap"]] },
    ...(user ? [{ title: M.account, items: [[G.myAccount, "/profile"], [L.account.title, "/account"]] as [string, string][] }] : []),
  ];

  return (
    <SiteLayout>
      <main className="lp-page">
        <div className="lp-wrap lp-doc">
          <h1>{M.sitemap}</h1>
          <nav className="lp-sitemap" aria-label={M.sitemap}>
            {groups.map((g) => (
              <section className="lp-panel" key={g.title}>
                <h2>{g.title}</h2>
                <ul>{g.items.map(([label, to]) => <li key={to}><HashLink to={to}>{label}</HashLink></li>)}</ul>
              </section>
            ))}
          </nav>
        </div>
      </main>
    </SiteLayout>
  );
}
