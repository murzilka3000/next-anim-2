'use client';

import React, { useEffect, useRef } from 'react';
import styles from './SlideGate.module.css';

type Props = {
  children: React.ReactNode | React.ReactNode[];
  durationMs?: number;   // длительность анимации шага (динамическая, от расстояния)
  className?: string;
};

function isScrollable(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  return /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
}

function findScrollable(target: HTMLElement, within?: HTMLElement) {
  let el: HTMLElement | null = target;
  while (el && (!within || within.contains(el))) {
    if (isScrollable(el)) return el;
    el = el.parentElement;
  }
  return null;
}

// Плавная прокрутка через RAF (мягкая), возвращает стоп-функцию
function animateScrollTo(targetY: number, duration: number, onDone: () => void): () => void {
  const startY = window.scrollY;
  const delta = targetY - startY;

  const noop = () => {};
  if (Math.abs(delta) < 1 || duration <= 0) {
    window.scrollTo(0, targetY);
    onDone();
    return noop;
  }

  const easeInOutSine = (t: number) => 0.5 * (1 - Math.cos(Math.PI * t));
  const start = performance.now();
  let rafId = 0;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
  };

  const tick = () => {
    if (stopped) return;
    const now = performance.now();
    const t = Math.min(1, (now - start) / duration);
    const eased = easeInOutSine(t);
    const y = startY + delta * eased;
    window.scrollTo(0, y);
    if (t < 1) rafId = requestAnimationFrame(tick);
    else onDone();
  };

  rafId = requestAnimationFrame(tick);
  return stop;
}

export function SlideGate({
  children,
  durationMs = 900,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<HTMLDivElement[]>([]);

  const animStopRef = useRef<(() => void) | null>(null);
  const animating = useRef(false);
  const lockUntilRef = useRef(0);      // пока активен — гасим wheel внутри SlideGate
  const TAIL_MS = 350;                 // хвост после анимации (съесть инерцию)

  const setSlideRef = (el: HTMLDivElement | null, i: number) => {
    slideRefs.current[i] = el || (null as unknown as HTMLDivElement);
  };

  useEffect(() => {
    const container = containerRef.current!;
    const slides = slideRefs.current.filter(Boolean);
    if (!container || slides.length < 2) return;

    const getTopAbs = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;

    const containerTop = () => container.getBoundingClientRect().top + window.scrollY;
    const containerBottom = () => containerTop() + container.offsetHeight;
    const nearContainerTop = () => window.scrollY <= containerTop() + 1;
    const nearContainerBottom = () => window.scrollY + window.innerHeight >= containerBottom() - 1;

    const getCurrentIndex = () => {
      const y = window.scrollY;
      let idx = 0;
      for (let i = 0; i < slides.length; i++) {
        if (getTopAbs(slides[i]) <= y + 1) idx = i;
        else break;
      }
      return idx;
    };

    // Хелперы для «длинного» слайда (например, с GSAP pin/spacer)
    const getRect = (i: number) => slides[i].getBoundingClientRect();
    const isTall = (i: number) => {
      const r = getRect(i);
      return r.height > window.innerHeight + 2;
    };
    const hasInSlideScrollDown = (i: number) => {
      if (!isTall(i)) return false;
      const r = getRect(i);
      // есть ещё пространство вниз внутри слайда
      return r.bottom > window.innerHeight + 1;
    };
    const hasInSlideScrollUp = (i: number) => {
      if (!isTall(i)) return false;
      const r = getRect(i);
      // есть ещё пространство вверх внутри слайда
      return r.top < -1;
    };

    const stepToIndex = (nextIndex: number) => {
      const idx = Math.max(0, Math.min(nextIndex, slides.length - 1));
      const destY = getTopAbs(slides[idx]);
      const dist = Math.abs(destY - window.scrollY);
      // мягкость по расстоянию: 650–1400 мс
      const ms = Math.max(650, Math.min(1400, 600 + dist * 0.5));

      if (animStopRef.current) {
        animStopRef.current();
        animStopRef.current = null;
      }
      animating.current = true;
      lockUntilRef.current = Date.now() + ms + TAIL_MS;

      animStopRef.current = animateScrollTo(destY, ms, () => {
        animating.current = false;
        animStopRef.current = null;
        // хвост уже заложен в lockUntilRef
      });
    };

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (!container.contains(target)) return;

      const dir: 'down' | 'up' = e.deltaY > 0 ? 'down' : 'up';

      // 1) Выход из SlideGate — даём нативно
      if ((dir === 'up' && nearContainerTop()) || (dir === 'down' && nearContainerBottom())) {
        if (animStopRef.current) {
          animStopRef.current();
          animStopRef.current = null;
        }
        animating.current = false;
        lockUntilRef.current = 0;
        return;
      }

      // 2) Замок/анимация — гасим wheel
      const now = Date.now();
      if (animating.current || now < lockUntilRef.current) {
        e.preventDefault();
        return;
      }

      const currentIndex = getCurrentIndex();
      const currentSlide = slides[currentIndex];

      // 3) Если внутри скроллимого блока — не трогаем
      const scrollable = findScrollable(target, currentSlide);
      if (scrollable) {
        const atBottom = Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight;
        const atTop = scrollable.scrollTop <= 0;
        if (e.deltaY > 0 && !atBottom) return;
        if (e.deltaY < 0 && !atTop) return;
      }

      // 4) Если слайд «длинный» (pin/spacer — как в SportSection) и в нём ещё есть пространство — не перехватываем
      if (dir === 'down' && hasInSlideScrollDown(currentIndex)) return;
      if (dir === 'up' && hasInSlideScrollUp(currentIndex)) return;

      // 5) Шагаем ровно на 1 соседний слайд (если он есть)
      const hasNext = currentIndex < slides.length - 1;
      const hasPrev = currentIndex > 0;

      if ((dir === 'down' && !hasNext) || (dir === 'up' && !hasPrev)) {
        // крайний слайд внутри контейнера — выпускаем наружу
        return;
      }

      e.preventDefault();
      stepToIndex(currentIndex + (dir === 'down' ? 1 : -1));
    };

    // Тач: один слайд за жест; у длинного слайда — сначала нативно докручиваем внутри
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      if (animStopRef.current) {
        animStopRef.current();
        animStopRef.current = null;
      }
      animating.current = false;
      lockUntilRef.current = 0;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!container.contains(target)) return;

      const dy = e.changedTouches[0].clientY - touchStartY;
      const absY = Math.abs(dy);
      const swipeThreshold = 40;
      if (absY < swipeThreshold) return;

      const dir: 'down' | 'up' = dy < 0 ? 'down' : 'up';

      // выход наружу — пропускаем
      if ((dir === 'up' && nearContainerTop()) || (dir === 'down' && nearContainerBottom())) {
        return;
      }

      const currentIndex = getCurrentIndex();
      const currentSlide = slides[currentIndex];

      // если внутри скроллимого — не перехватываем
      const scrollable = findScrollable(target, currentSlide);
      if (scrollable) {
        const atBottom = Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight;
        const atTop = scrollable.scrollTop <= 0;
        if (dy < 0 && !atBottom) return;
        if (dy > 0 && !atTop) return;
      }

      // длинный слайд: сначала доскроллить внутри
      if (dir === 'down' && hasInSlideScrollDown(currentIndex)) return;
      if (dir === 'up' && hasInSlideScrollUp(currentIndex)) return;

      const hasNext = currentIndex < slides.length - 1;
      const hasPrev = currentIndex > 0;

      if (dir === 'down' && hasNext) stepToIndex(currentIndex + 1);
      else if (dir === 'up' && hasPrev) stepToIndex(currentIndex - 1);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel as EventListener);
      window.removeEventListener('touchstart', onTouchStart as EventListener);
      window.removeEventListener('touchend', onTouchEnd as EventListener);
      if (animStopRef.current) {
        animStopRef.current();
        animStopRef.current = null;
      }
      animating.current = false;
      lockUntilRef.current = 0;
    };
  }, [durationMs]);

  return (
    <section ref={containerRef} className={[styles.container, className].filter(Boolean).join(' ')}>
      <div className={styles.track}>
        {React.Children.toArray(children)
          .filter(Boolean)
          .map((child, i) => (
            <div key={i} ref={(el) => setSlideRef(el, i)} className={styles.slide}>
              {child}
            </div>
          ))}
      </div>
    </section>
  );
}