import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { useL } from "../i18n";

/** Hộp thoại đăng nhập / đăng ký. Tự đóng khi đăng nhập thành công (user xuất hiện). */
export default function AuthModal({ onClose }: { onClose: () => void }) {
  const L = useL();
  const { user, login, register, loginGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) onClose(); }, [user, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (fn: () => Promise<void>) => {
    setErr(""); setBusy(true);
    try { await fn(); }
    catch (ex) {
      const code = (ex as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setErr(L.auth.errors[code] ?? `${L.auth.fallback} (${code})`);
    } finally { setBusy(false); }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); run(() => (mode === "login" ? login(email, pw) : register(email, pw))); };

  return (
    <div className="lm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="lm-x" onClick={onClose} aria-label={L.auth.close}>×</button>
        <h3>{mode === "login" ? L.auth.title : L.auth.titleRegister}</h3>
        <p className="lm-muted">{L.auth.sub}</p>
        <button type="button" className="lm-google" disabled={busy} onClick={() => run(loginGoogle)}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
          </svg>
          {L.auth.google}
        </button>
        <div className="lm-or"><span>{L.auth.or}</span></div>
        <form onSubmit={submit}>
          <label>{L.auth.email}<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>{L.auth.password}<input type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          {err && <p className="lm-err">{err}</p>}
          <button className="lm-btn" type="submit" disabled={busy}>{mode === "login" ? L.auth.login : L.auth.register}</button>
        </form>
        <button type="button" className="lm-link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? L.auth.toRegister : L.auth.toLogin}
        </button>
        <p className="lm-muted lm-small">{L.auth.inApp}</p>
      </div>
    </div>
  );
}
