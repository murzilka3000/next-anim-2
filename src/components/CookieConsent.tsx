"use client";

import { useEffect, useState } from "react";
import s from "./CookieConsent.module.scss";

const STORAGE_KEY = "cookie_consent_accepted";

function hasConsent(): boolean {
  if (typeof window === "undefined") return true; // на сервере — не показываем
  const localOk = localStorage.getItem(STORAGE_KEY) === "1";
  const cookieOk = document.cookie.includes("cookie_consent=1");
  return localOk || cookieOk;
}

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisible(!hasConsent());
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
      // 365 дней
      document.cookie =
        "cookie_consent=1; path=/; max-age=31536000; SameSite=Lax";
      // Я.Метрика (опционально)
      (window as any).ym?.(105181480, "reachGoal", "cookie_accepted");
    } catch {}
    setVisible(false);
  };

  if (!mounted || !visible) return null;

  return (
    <div className={s.cookie} role="dialog" aria-live="polite" aria-label="Сайт использует cookies">
      <p className={s.text}>
        Мы используем cookies, <br /> чтобы сайт работал лучше <br />
        <a href="https://frankmedia.ru/privacy-policy">Политика конфиденциальности</a>
      </p>
      <button className={s.btn} onClick={accept} aria-label="Принять cookies">
        Принять
      </button>
    </div>
  );
}