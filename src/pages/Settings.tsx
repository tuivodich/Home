import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { DEFAULT_USD_RATE } from "../lib/format";
import { ROLES, type Role, type UserDoc } from "../lib/types";

export default function Settings() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const [rate, setRate] = useState(DEFAULT_USD_RATE);
  const { data: users } = useCollection<UserDoc & { id: string }>("users", profile?.role === "owner" || profile?.role === "manager");

  useEffect(() => onSnapshot(doc(db, "settings", "app"), (s) => {
    if (typeof s.data()?.usdRate === "number") setRate(s.data()!.usdRate);
  }, () => {}), []);

  return (
    <section>
      <h2>{t("settings")}</h2>
      <div className="card">
        <label>{t("usdRate")}
          <input type="number" min={1} value={rate} onChange={(e) => setRate(+e.target.value)} />
        </label>
        <small>{t("usdRateHint")}</small>
        <button onClick={() => setDoc(doc(db, "settings", "app"), { usdRate: rate }, { merge: true })}>{t("save")}</button>
      </div>
      <div className="card">
        <h3>{t("staffAccounts")}</h3>
        {users.map((u) => (
          <div className="row between" key={u.id}>
            <span>{u.email}</span>
            <select
              value={u.role}
              disabled={u.id === user?.uid || (u.role === "owner" && profile?.role !== "owner")}
              onChange={(e) => updateDoc(doc(db, "users", u.id), { role: e.target.value as Role })}
            >
              {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}
