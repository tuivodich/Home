import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useI18n, useL } from "../i18n";
import { useMoney } from "../lib/useRate";
import { useTitle } from "../lib/useTitle";
import type { Room } from "../lib/types";
import SiteLayout from "../layout/SiteLayout";
import Icon from "../landing/Icon";

/** Trang chi tiết một phòng (/phong/:id): thư viện ảnh, giá, sức chứa, giới thiệu và tiện nghi; có dữ liệu có cấu trúc cho công cụ tìm kiếm. */
export default function RoomPage() {
  const { id = "" } = useParams();
  const L = useL();
  const { lang } = useI18n();
  const { money } = useMoney();
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  useEffect(() => onSnapshot(doc(db, "rooms", id), (s) => setRoom(s.exists() ? ({ ...(s.data() as object), id: s.id } as Room) : null), () => setRoom(null)), [id]);
  useEffect(() => setIdx(0), [id]);
  useTitle(room?.name ?? L.menu.rooms);

  const en = lang === "en";
  const photos = room?.photos ?? [];
  const desc = (en && room?.descEn?.trim()) || room?.desc || "";
  const feats = ((en && room?.featuresEn?.trim()) || room?.features || "").split("\n").map((x) => x.trim()).filter(Boolean);

  // Mô tả cho công cụ tìm kiếm + dữ liệu có cấu trúc của phòng.
  useEffect(() => {
    if (!room) return;
    const meta = document.querySelector('meta[name="description"]');
    const prev = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", (desc || `${room.name} – Nhà Gỗ Homestay`).slice(0, 160));
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "HotelRoom", name: room.name, description: desc || undefined, image: photos.length ? photos : undefined, occupancy: { "@type": "QuantitativeValue", maxValue: room.capacity }, url: `https://nhago.web.app/phong/${room.id}`, offers: { "@type": "Offer", price: room.price, priceCurrency: "VND" } });
    document.head.appendChild(ld);
    return () => { ld.remove(); if (prev !== null) meta?.setAttribute("content", prev); };
  }, [room, desc, photos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SiteLayout>
      <main className="lp-page lp-roompage">
        <div className="lp-wrap">
          <p className="lp-crumb"><Link to="/">{L.menu.top}</Link> › <Link to="/#rooms">{L.menu.rooms}</Link>{room ? <> › <span>{room.name}</span></> : null}</p>
          {room === undefined && <p className="lp-muted">…</p>}
          {room === null && <div className="lp-panel lp-center"><p>{en ? "This room was not found." : "Không tìm thấy phòng này."}</p><Link className="lp-btn primary" to="/#rooms">{L.menu.rooms}</Link></div>}
          {room && (
            <div className="lp-room-detail">
              <div className="lp-gallery">
                <button type="button" className="lp-gallery-main" onClick={() => photos.length && setZoom(true)} aria-label={room.name}>
                  {photos.length ? <img src={photos[idx]} alt={`${room.name} ${idx + 1}/${photos.length}`} decoding="async" /> : <Icon name={room.type === "wood" ? "home" : "bed"} />}
                </button>
                {photos.length > 1 && (
                  <div className="lp-thumbs" role="list">
                    {photos.map((u, i) => <button key={u} type="button" role="listitem" className={i === idx ? "on" : ""} onClick={() => setIdx(i)} aria-label={`${i + 1}`}><img src={u} alt="" loading="lazy" /></button>)}
                  </div>
                )}
              </div>
              <div className="lp-panel lp-room-info">
                <small className="lp-eyebrow">{room.type === "wood" ? L.rooms.wood : L.rooms.concrete}</small>
                <h1>{room.name}</h1>
                <div className="lp-muted">{L.rooms.capacity}: {room.capacity} {L.rooms.up}</div>
                <div className="lp-price">{money(room.price)} <span>{L.rooms.perNight}</span></div>
                {room.status === "maintenance" && <p className="lp-warn">{en ? "Temporarily closed." : "Phòng tạm ngưng nhận khách."}</p>}
                {desc && <p className="lp-room-desc">{desc}</p>}
                {feats.length > 0 && <ul className="lp-room-feats">{feats.map((f) => <li key={f}>{f}</li>)}</ul>}
                <div className="lp-room-actions">
                  <Link className="lp-btn primary" to={`/?roomId=${room.id}#booking`}>{L.rooms.view}</Link>
                  <Link className="lp-btn ghost" to="/#rooms">{L.menu.rooms}</Link>
                </div>
              </div>
            </div>
          )}
        </div>
        {zoom && room && photos[idx] && (
          <div className="lp-lightbox" role="dialog" aria-modal="true" onClick={() => setZoom(false)}>
            <img src={photos[idx]} alt={room.name} />
            <button type="button" className="lp-lightbox-x" aria-label="Close">✕</button>
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
