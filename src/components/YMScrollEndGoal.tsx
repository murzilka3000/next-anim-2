"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function YMScrollEndGoal() {
  const triggeredRef = useRef(false);
  const pathname = usePathname(); // чтобы переинициализировать на каждой смене страницы

  useEffect(() => {
    triggeredRef.current = false;

    let ticking = false;
    const check = () => {
      ticking = false;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 5;

      if (atBottom && !triggeredRef.current) {
        (window as any).ym?.(105181480, "reachGoal", "scrolled_to_the_end");
        triggeredRef.current = true;
        window.removeEventListener("scroll", onScroll);
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(check);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Проверяем сразу (вдруг уже внизу) + после onload
    check();
    window.addEventListener("load", check);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("load", check);
    };
  }, [pathname]);

  return null;
}