import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../i18n";

export default function Login() {
  const { login, register } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try { await (mode === "login" ? login(email, pw) : register(email, pw)); }
    catch (ex) { setErr((ex as Error).message); }
  };

  return (
    <form className="center card" onSubmit={submit}>
      <h2>🏡 {t("appName")}</h2>
      <label>{t("email")}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>{t("password")}<input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {err && <p className="error">{err}</p>}
      <button type="submit">{mode === "login" ? t("login") : t("register")}</button>
      {mode === "register" && <small>{t("firstUserHint")}</small>}
      <button type="button" className="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? t("noAccount") : t("haveAccount")}
      </button>
      <button type="button" className="ghost" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{lang === "vi" ? "English" : "Tiếng Việt"}</button>
    </form>
  );
}
