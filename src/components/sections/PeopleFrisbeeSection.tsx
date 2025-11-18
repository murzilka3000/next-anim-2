"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";
import styles from "./PeopleFrisbeeSection.module.scss";
import { peopleData } from "@/data/questions";

gsap.registerPlugin(useGSAP, MotionPathPlugin);

// ===== NBSP обработчик (висячие предлоги/союзы/частицы) =====
const IGNORE_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "TEXTAREA",
  "NOSCRIPT",
]);

// Список коротких слов: предлоги/союзы/частицы и т.п.
const SHORT =
  "(?:в|к|с|у|о|и|а|но|да|на|по|за|из|от|до|об|обо|во|со|ко|не|ни|же|ли|бы)";

// NBSP после коротких предлогов/союзов/частиц
const RX_AFTER_SHORT = new RegExp(
  `(^|[\\s(«„"'])(${SHORT})\\s+(?=[\\p{L}\\d])`,
  "giu"
);

// NBSP перед последним коротким словом в текстовом фрагменте
const RX_BEFORE_LAST_SHORT = new RegExp(
  `(\\S)\\s(${SHORT})([.!?:,…»"')\\]]*\\s*$)`,
  "giu"
);

function fixText(s: string): string {
  if (!s) return s;
  let t = s.replace(RX_AFTER_SHORT, "$1$2\u00A0");
  t = t.replace(RX_BEFORE_LAST_SHORT, "$1\u00A0$2$3");
  return t;
}

function processTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentNode as HTMLElement | null;
      if (!node.nodeValue || !node.nodeValue.trim())
        return NodeFilter.FILTER_REJECT;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (IGNORE_TAGS.has(parent.nodeName)) return NodeFilter.FILTER_REJECT;
      if (parent.isContentEditable || parent.closest?.("[contenteditable]"))
        return NodeFilter.FILTER_REJECT;
      if (parent.closest?.("[data-nbsp-skip]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const n of nodes) {
    const next = fixText(n.nodeValue || "");
    if (next !== n.nodeValue) n.nodeValue = next;
  }
}
// ===== конец NBSP блока =====

export const PeopleFrisbeeSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const discRef = useRef<HTMLImageElement | null>(null);
  const anchorRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mImgRefs = useRef<(HTMLImageElement | null)[]>([]);

  const people = useMemo(() => peopleData, []);
  const [holder, setHolder] = useState(0);
  const [activePopup, setActivePopup] = useState<number | null>(0);
  const [flying, setFlying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // refs для актуальных значений внутри колбеков/слушателей
  const holderRef = useRef(holder);
  const flyingRef = useRef(flying);
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    holderRef.current = holder;
  }, [holder]);
  useEffect(() => {
    flyingRef.current = flying;
  }, [flying]);
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Флаг, чтобы не запускать перелёт до завершения первичной инициализации на мобилке
  const mobileReadyRef = useRef(false);

  // NBSP: обработать все текстовые узлы внутри секции и отслеживать изменения
  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    processTextNodes(root);

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          m.type === "characterData" &&
          m.target.nodeType === Node.TEXT_NODE
        ) {
          const t = m.target as Text;
          const next = fixText(t.nodeValue || "");
          if (next !== t.nodeValue) t.nodeValue = next;
        }
        for (const n of m.addedNodes) {
          if (n.nodeType === Node.TEXT_NODE) {
            const t = n as Text;
            const next = fixText(t.nodeValue || "");
            if (next !== t.nodeValue) t.nodeValue = next;
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            processTextNodes(n);
          }
        }
      }
    });

    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.matchMedia("(max-width: 871px)").matches);
    };
    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => {
      window.removeEventListener("resize", checkDevice);
    };
  }, []);

  const toUnit = (v: string) => {
    const n = parseFloat(v);
    return isFinite(n) ? n / (v.toString().includes("%") ? 100 : 1) : 0.5;
  };

  const getAnchorCenter = (i: number) => {
    const overlay = overlayRef.current!;
    const or = overlay.getBoundingClientRect();

    if (isMobileRef.current && mImgRefs.current[i]) {
      const img = mImgRefs.current[i]!;
      const ir = img.getBoundingClientRect();
      const ax = toUnit(people[i].handX);
      const ay = toUnit(people[i].handY);
      const px = ir.left + ir.width * ax - or.left;
      const py = ir.top + ir.height * ay - or.top;
      return { x: px, y: py };
    }

    const a = anchorRefs.current[i];
    if (a) {
      const ar = a.getBoundingClientRect();
      return {
        x: ar.left + ar.width / 2 - or.left,
        y: ar.top + ar.height / 2 - or.top,
      };
    }

    return { x: or.width / 2, y: or.height / 2 };
  };

  const placeDiscAt = (i: number) => {
    const disc = discRef.current;
    const overlay = overlayRef.current;
    if (!disc || !overlay) return;

    const c = getAnchorCenter(i);
    const dw = disc.width || 58;
    const dh = disc.height || 27;

    gsap.set(disc, {
      x: c.x - dw / 2,
      y: c.y - dh / 2,
      rotation: 0,
      force3D: true,
    });
  };

  useGSAP(
    () => {
      const img = discRef.current;
      if (img && !img.complete) {
        const onLoad = () => {
          if (!flyingRef.current) {
            // Размещаем только если не летим
            placeDiscAt(holderRef.current);
          }
        };
        img.addEventListener("load", onLoad, { once: true });
      } else {
        // Первичное размещение
        requestAnimationFrame(() => {
          if (!flyingRef.current) placeDiscAt(holderRef.current);
        });
      }

      const handleResize = () => {
        // На мобилке пропускаем переразмещение, чтобы избежать «миганий»
        if (isMobileRef.current || flyingRef.current) return;
        requestAnimationFrame(() => placeDiscAt(holderRef.current));
      };

      const ro = new ResizeObserver(handleResize);
      if (overlayRef.current) ro.observe(overlayRef.current);
      if (sectionRef.current) ro.observe(sectionRef.current);
      window.addEventListener("resize", handleResize);

      return () => {
        ro.disconnect();
        window.removeEventListener("resize", handleResize);
      };
    },
    { scope: sectionRef, dependencies: [isMobile] }
  );

  const flyTo = (targetIndex: number) => {
    if (flyingRef.current || targetIndex === holderRef.current) return;

    setFlying(true);
    flyingRef.current = true;
    setActivePopup(null);

    const disc = discRef.current!;
    if (!disc) {
      setFlying(false);
      flyingRef.current = false;
      return;
    }

    // Убедимся, что нет конфликтующих твинов
    gsap.killTweensOf(disc);

    const startC = getAnchorCenter(holderRef.current);
    const endC = getAnchorCenter(targetIndex);

    const dw = disc.width || 58;
    const dh = disc.height || 27;

    // Берём текущие transform-координаты как старт
    const curX = Number(gsap.getProperty(disc, "x"));
    const curY = Number(gsap.getProperty(disc, "y"));
    const hasCurrent = !Number.isNaN(curX) && !Number.isNaN(curY);

    const startX = hasCurrent ? curX : startC.x - dw / 2;
    const startY = hasCurrent ? curY : startC.y - dh / 2;
    const endX = endC.x - dw / 2;
    const endY = endC.y - dh / 2;

    // Проставляем явную стартовую позицию перед твином
    gsap.set(disc, { x: startX, y: startY, force3D: true });

    // Если уже почти на месте — короткая подстройка
    const snapDist = Math.hypot(endX - startX, endY - startY);
    if (snapDist < 6) {
      gsap.to(disc, {
        x: endX,
        y: endY,
        duration: 0.2,
        ease: "power1.out",
        overwrite: "auto",
        immediateRender: false,
        lazy: false,
        onComplete: () => {
          setHolder(targetIndex);
          holderRef.current = targetIndex;
          setFlying(false);
          flyingRef.current = false;
          if (!isMobileRef.current) setActivePopup(targetIndex);
        },
      });
      return;
    }

    // — Настройки более «плоской» дуги —
    const ARC_FACTOR = 0.08; // 0.05..0.10 — чем меньше, тем «тупее»
    const ARC_MIN = 28; // минимальный подъём дуги
    const ARC_MAX = 90; // максимальный подъём дуги
    const CURVINESS = 0.55; // 0.3..0.7 — меньше = прямее

    // Дистанция между точками
    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.hypot(dx, dy);

    // Высота дуги (делаем её поменьше)
    const arc = gsap.utils.clamp(ARC_MIN, ARC_MAX, dist * ARC_FACTOR);

    // Контрольная точка: от середины отрезка отклоняемся перпендикулярно
    const mx = (startX + endX) / 2;
    const my = (startY + endY) / 2;
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle - Math.PI / 2) * arc;
    const ny = Math.sin(angle - Math.PI / 2) * arc;

    // Берём «верхнюю» из двух возможных перпендикулярных (чтобы дуга шла вверх)
    const c1 = { x: mx + nx, y: my + ny };
    const c2 = { x: mx - nx, y: my - ny };
    const ctrl = c1.y < c2.y ? c1 : c2;

    gsap.to(disc, {
      duration: 0.8,
      ease: "power2.out",
      motionPath: {
        path: [
          { x: startX, y: startY },
          { x: ctrl.x, y: ctrl.y },
          { x: endX, y: endY },
        ],
        curviness: CURVINESS,
        autoRotate: false,
      },
      overwrite: "auto",
      immediateRender: false,
      lazy: false,
      onComplete: () => {
        setHolder(targetIndex);
        holderRef.current = targetIndex;
        setFlying(false);
        flyingRef.current = false;
        if (!isMobileRef.current) setActivePopup(targetIndex);
        // После завершения полёта «фиксируем» позицию (без рывков)
        gsap.set(disc, { x: endX, y: endY });
      },
    });
  };

  // Мобильный режим: перелёт при скролле к карточке, ближайшей к центру экрана
  useEffect(() => {
    if (!isMobile) return;

    const HYSTERESIS = 24; // пикс. преимущество новой карточки над текущей, чтобы запустить полёт

    const computeClosestIndex = () => {
      const imgs = mImgRefs.current;
      let bestIndex = 0;
      let bestDist = Infinity;
      const centerY = window.innerHeight / 2;

      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        if (!img) continue;
        const r = img.getBoundingClientRect();
        const cy = r.top + r.height / 2;
        const d = Math.abs(cy - centerY);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }
      return { bestIndex, bestDist };
    };

    // Инициализация позиции диска на ближайшем человеке к центру
    let rafInit = 0;
    const init = () => {
      const { bestIndex } = computeClosestIndex();
      holderRef.current = bestIndex;
      setHolder(bestIndex);
      setActivePopup(null);
      placeDiscAt(bestIndex);
      mobileReadyRef.current = true; // разрешаем реагировать на скролл только после инициализации
    };

    let rafId = 0;
    const onScroll = () => {
      if (!mobileReadyRef.current) return; // не анимируем до инициализации
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const { bestIndex, bestDist } = computeClosestIndex();
        const currentIndex = holderRef.current;

        if (bestIndex === currentIndex) return;

        // Сравним, действительно ли новая карточка «лучше» текущей на заметную величину
        const curImg = mImgRefs.current[currentIndex];
        let curDist = Infinity;
        if (curImg) {
          const rr = curImg.getBoundingClientRect();
          const cy = rr.top + rr.height / 2;
          curDist = Math.abs(cy - window.innerHeight / 2);
        }

        if (bestDist + HYSTERESIS < curDist && !flyingRef.current) {
          flyTo(bestIndex);
        }
      });
    };

    rafInit = requestAnimationFrame(init);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      if (rafInit) cancelAnimationFrame(rafInit);
      mobileReadyRef.current = false;
    };
  }, [isMobile]);

  const activePersonData = activePopup !== null ? people[activePopup] : null;

  return (
    <section className={styles.section} ref={sectionRef}>
      <div className={styles.stage}>
        <div className={styles.header}>
          <p className={styles.headerText}>
            {/* Текст обработается автоматически в эффекте */}
            Вы разобрались, какие гибкие навыки у вас уже развиты, а над чем
            можно <br /> ещё поработать. Давайте выясним, какие виды физической
            нагрузки вам <br /> в этом помогут.{" "}
            <span className={styles.spanww}>
              Нажимайте на гибкий навык, который хотели бы развить.
            </span>
          </p>
        </div>

        <div className={styles.overlay} ref={overlayRef} aria-hidden>
          <img
            ref={discRef}
            className={styles.disc}
            src="/images/frisbee-mini.svg"
            alt=""
            draggable={false}
          />
        </div>

        <div className={styles.board}>
          {people.map((p, i) => (
            <div
              key={p.id}
              className={styles.person}
              style={
                {
                  ["--x" as any]: p.x,
                  ["--y" as any]: p.y,
                  ["--scale" as any]: p.scale ?? 1,
                  ["--ax" as any]: p.handX,
                  ["--ay" as any]: p.handY,
                  width: p.widthPx ? `${p.widthPx}px` : undefined,
                } as React.CSSProperties
              }
            >
              <img
                className={styles.photo}
                src={p.img}
                alt={fixText(p.name)}
                draggable={false}
                onClick={!isMobile ? () => flyTo(i) : undefined}
                role={!isMobile ? "button" : undefined}
                aria-label={!isMobile ? fixText(`Передать тарелку: ${p.name}`) : undefined}
                style={!isMobile ? { cursor: "pointer" } : undefined}
              />

              <div
                className={styles.anchor}
                ref={(el) => {
                  anchorRefs.current[i] = el;
                }}
                aria-hidden
              />

              {p.tag && (
                (() => {
                  const isRight = !p.tagSide || p.tagSide === "right";
                  const clickable = isRight && !isMobile;
                  return (
                    <div
                      className={`${styles.tag} ${
                        p.tagSide ? styles[`tag_${p.tagSide}`] : styles.tag_right
                      }`}
                      onClick={clickable ? () => flyTo(i) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                flyTo(i);
                              }
                            }
                          : undefined
                      }
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-label={
                        clickable ? fixText(`Передать тарелку: ${p.name}`) : undefined
                      }
                      style={clickable ? { cursor: "pointer" } : undefined}
                    >
                      {p.tag}
                    </div>
                  );
                })()
              )}

              {!isMobile && (
                <button
                  className={styles.glow}
                  onClick={() => flyTo(i)}
                  aria-label={fixText(`Передать тарелку: ${p.name}`)}
                />
              )}
            </div>
          ))}
        </div>

        <div className={styles.mobileGrid}>
          {people.map((p, i) => {
            const reversed = i % 2 === 1;
            return (
              <div
                key={`m-${p.id}`}
                className={`${styles.mobileRow} ${
                  reversed ? styles.mobileRowReverse : ""
                }`}
              >
                <div className={styles.mobileImgCol}>
                  <img
                    src={p.img}
                    alt={fixText(p.name)}
                    className={styles.mobileImg}
                    ref={(el) => {
                      mImgRefs.current[i] = el;
                    }}
                  />
                  {p.tag && <div className={styles.mobileSkill}>{p.tag}</div>}
                </div>
                <div className={styles.mobileCardCol}>
                  <div className={styles.mobileCard}>
                    <div className={styles.mobileCardTitle}>{p.name}</div>
                    <div className={styles.mobileCardText}>{p.popup}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activePersonData && !isMobile && (
          <div
            className={styles.popupContainer}
            style={
              {
                ["--x" as any]: activePersonData.x,
                ["--y" as any]: activePersonData.y,
              } as React.CSSProperties
            }
          >
            <div
              className={styles.popup}
              style={
                {
                  ["--dx" as any]: activePersonData.popupX ?? "0",
                  ["--dy" as any]: activePersonData.popupY ?? "-8%",
                } as React.CSSProperties
              }
            >
              <div className={styles.popupTitle}>{activePersonData.name}</div>
              <div className={styles.popupText}>{activePersonData.popup}</div>
              <button
                className={styles.popupClose}
                onClick={() => setActivePopup(null)}
                aria-label="Закрыть"
              >
                <img src="/images/close.svg" alt="" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};