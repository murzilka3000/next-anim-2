"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Draggable } from "gsap/Draggable";
import styles from "./MythsDragSection.module.scss";

// Swiper (мобильный режим)
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Mousewheel, Keyboard } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { Myth, mythsData } from "@/data/questions";

gsap.registerPlugin(useGSAP, ScrollTrigger, Draggable);

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

const SHORT =
  "(?:в|к|с|у|о|и|а|но|да|на|по|за|из|от|до|об|обо|во|со|ко|не|ни|же|ли|бы)";

const RX_AFTER_SHORT = new RegExp(
  `(^|[\\s(«„"'])(${SHORT})\\s+(?=[\\p{L}\\d])`,
  "giu"
);

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

// Прелоадер изображений (без сужения типов до never)
function preloadAndDecode(src?: string | null): Promise<void> {
  return new Promise((resolve) => {
    if (!src) return resolve();

    const img = new Image();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    // Ставим обработчики заранее
    img.onload = finish;
    img.onerror = finish;

    // Подсказываем браузеру
    (img as any).decoding = "async";
    img.src = src;

    // Аккуратно проверяем поддержку decode без оператора "in" на img
    const canDecode =
      typeof (HTMLImageElement.prototype as any).decode === "function";
    if (canDecode) {
      (img as any)
        .decode?.()
        .then(finish)
        .catch(finish);
    }
  });
}

// Мобильная флип‑карта: фронт (миф) → клик → оборот (ответ)
const MobileAnswerSlide: React.FC<{ myth: Myth }> = ({ myth }) => {
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  // Для корректного скролла на мобильных при показе ответа
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStartCapture = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchMoveCapture = (e: React.TouchEvent) => {
    if (!revealed || !touchStartRef.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartRef.current.x);
    const dy = Math.abs(t.clientY - touchStartRef.current.y);
    if (dy > dx) {
      e.stopPropagation();
    }
  };

  const handleTouchEndCapture = () => {
    touchStartRef.current = null;
  };

  useEffect(() => {
    const front = frontRef.current;
    const back = backRef.current;
    if (front && back) {
      gsap.set(front, {
        autoAlpha: 1,
        rotateY: 0,
        transformPerspective: 900,
        transformOrigin: "50% 50%",
      });
      gsap.set(back, {
        autoAlpha: 0,
        rotateY: 90,
        transformPerspective: 900,
        transformOrigin: "50% 50%",
      });
    }
  }, []);

  const reveal = () => {
    if (revealed) return;
    setRevealed(true);

    const front = frontRef.current!;
    const back = backRef.current!;

    const tl = gsap.timeline();
    tl.to(front, {
      rotateY: -90,
      autoAlpha: 0,
      duration: 0.25,
      ease: "power2.in",
      transformPerspective: 900,
      transformOrigin: "50% 50%",
    }).fromTo(
      back,
      {
        rotateY: 90,
        autoAlpha: 0,
        transformPerspective: 900,
        transformOrigin: "50% 50%",
      },
      {
        rotateY: 0,
        autoAlpha: 1,
        duration: 0.5,
        ease: "power2.out",
      },
      "<0.05"
    );
  };

  return (
    <div
      className={`${styles.card} ${styles.cardMobile}`}
      onClick={reveal}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          reveal();
        }
      }}
      // Разрешаем нативные жесты, чтобы не блокировать скролл
      onTouchStartCapture={handleTouchStartCapture}
      onTouchMoveCapture={handleTouchMoveCapture}
      onTouchEndCapture={handleTouchEndCapture}
      style={{
        cursor: revealed ? "default" : "pointer",
        touchAction: "auto",
      }}
    >
      <div className={styles.cardInner} ref={frontRef} aria-hidden={revealed}>
        <div className={styles.cardLabel}>{myth.title}</div>
        <div className={styles.cardText}>{myth.text}</div>
        {!revealed && (
          <p className={styles.vtrvgtr} aria-hidden={revealed}>
            Нажмите на карточку, чтобы развеять миф
          </p>
        )}
      </div>

      <div className={styles.answer} ref={backRef} aria-hidden={!revealed}>
        <div className={styles.expertHeader}>
          {myth.expert.photo ? (
            <img
              className={styles.avatar}
              src={myth.expert.photo}
              alt={fixText(myth.expert.name)}
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className={styles.avatarPlaceholder} />
          )}
          <div>
            <div className={styles.expertName}>{myth.expert.name}</div>
            <div className={styles.expertRole}>{myth.expert.role}</div>
          </div>
        </div>
        <div className={styles.answerText}>{myth.expert.answer}</div>
      </div>
    </div>
  );
};

export const MythsDragSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);

  // desktop
  const playgroundRef = useRef<HTMLDivElement | null>(null);
  const dragCardRef = useRef<HTMLDivElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const answerRef = useRef<HTMLDivElement | null>(null);

  // mobile
  const mobileRef = useRef<HTMLDivElement | null>(null);

  // hint (desktop)
  const hintImgRef = useRef<HTMLImageElement | null>(null);
  const hintTweenRef = useRef<gsap.core.Tween | null>(null);

  // Draggable/RO refs для избежания гонок
  const draggableRef = useRef<ReturnType<typeof Draggable.create>[number] | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  // NBSP
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

  const [index, setIndex] = useState(0);
  const [answeredIdx, setAnsweredIdx] = useState<number | null>(null);

  // скрыть карточку на десктопе после последнего дропа
  const [desktopCardHidden, setDesktopCardHidden] = useState(false);

  // показывать подсказку только ПОСЛЕ первого успешного дропа и пока есть что перетаскивать
  const [hasDroppedOnce, setHasDroppedOnce] = useState(false);
  const hintVisible = hasDroppedOnce && !desktopCardHidden;

  // Определяем мобильный брейкпоинт
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 811px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsMobile("matches" in e ? (e as MediaQueryListEvent).matches : (e as MediaQueryList).matches);
    setIsMobile(mq.matches);
    // @ts-ignore
    mq.addEventListener
      ? mq.addEventListener("change", handler)
      : mq.addListener(handler as any);
    return () => {
      // @ts-ignore
      mq.removeEventListener
        ? mq.removeEventListener("change", handler)
        : mq.removeListener(handler as any);
    };
  }, []);

  // Включаем/выключаем анимацию хинта (desktop) — только когда hintVisible
  useEffect(() => {
    if (isMobile) {
      hintTweenRef.current?.kill();
      hintTweenRef.current = null;
      if (hintImgRef.current) gsap.set(hintImgRef.current, { x: 0 });
      return;
    }
    if (hintVisible && hintImgRef.current) {
      hintTweenRef.current?.kill();
      hintTweenRef.current = gsap.to(hintImgRef.current, {
        x: 14,
        duration: 0.9,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    } else {
      hintTweenRef.current?.kill();
      hintTweenRef.current = null;
      if (hintImgRef.current) gsap.set(hintImgRef.current, { x: 0 });
    }
    return () => {
      hintTweenRef.current?.kill();
      hintTweenRef.current = null;
    };
  }, [isMobile, hintVisible]);

  const myths = useMemo(() => mythsData, []);
  const current = myths[index];
  const answered = answeredIdx !== null ? myths[answeredIdx] : null;

  // Прелоадим все фото экспертов один раз
  const photoUrls = useMemo(
    () => Array.from(new Set(myths.map((m) => m.expert.photo).filter(Boolean))) as string[],
    [myths]
  );

  useEffect(() => {
    photoUrls.forEach((src) => preloadAndDecode(src));
  }, [photoUrls]);

  useGSAP(
    () => {
      const play = playgroundRef.current;
      const mm = gsap.matchMedia();

      // Десктоп
      mm.add("(min-width: 812px)", () => {
        if (!play) return;

        // Плавное появление интерактива при входе в секцию
        gsap.set(play, { opacity: 0, y: 24 });
        gsap.to(play, {
          opacity: 1,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: play,
            start: "top 85%",
            end: "top 60%",
            scrub: true,
            refreshPriority: -1,
          },
        });
        setDesktopCardHidden(false);

        const card = dragCardRef.current;
        const zone = dropZoneRef.current;
        const sectionEl = sectionRef.current;

        if (!card || !zone || !sectionEl) return;

        const isOverZone = () => {
          const cr = card.getBoundingClientRect();
          const zr = zone.getBoundingClientRect();
          const cx = cr.left + cr.width / 2;
          const cy = cr.top + cr.height / 2;
          return cx >= zr.left && cx <= zr.right && cy >= zr.top && cy <= zr.bottom;
        };

        const onDropSuccess = () => {
          // помечаем, что был первый успешный дроп
          setHasDroppedOnce(true);

          const nextPhoto = myths[index]?.expert?.photo;
          const wait = preloadAndDecode(nextPhoto);

          setAnsweredIdx(index);
          const isLast = index >= myths.length - 1;

          const tl = gsap.timeline();
          tl.to(card, {
            opacity: 0,
            scale: 0.95,
            duration: 0.22,
            ease: "power2.out",
          }).set(card, { x: 0, y: 0 });

          if (isLast) {
            tl.call(() => setDesktopCardHidden(true));
          } else {
            tl.call(() => setIndex((i) => Math.min(i + 1, myths.length - 1))).to(card, {
              opacity: 1,
              scale: 1,
              duration: 0.28,
              ease: "power2.out",
            });
          }

          wait.then(() => {
            requestAnimationFrame(() => {
              const ans = answerRef.current;
              if (!ans) return;
              gsap.killTweensOf(ans);
              gsap.fromTo(
                ans,
                {
                  rotateY: 90,
                  opacity: 0,
                  transformPerspective: 900,
                  transformOrigin: "50% 50%",
                },
                { rotateY: 0, opacity: 1, duration: 0.55, ease: "power2.out" }
              );
            });
          });
        };

        // Создаём Draggable
        const created = Draggable.create(card, {
          type: "x,y",
          edgeResistance: 0.2,
          bounds: sectionEl,
          onDrag() {
            if (isOverZone()) zone.classList.add(styles.active);
            else zone.classList.remove(styles.active);
          },
          onDragEnd() {
            zone.classList.remove(styles.active);
            if (isOverZone()) onDropSuccess();
            else gsap.to(card, { x: 0, y: 0, duration: 0.25, ease: "power2.out" });
          },
        });

        const dr = created?.[0];
        if (!dr) return;

        draggableRef.current = dr;
        dr.applyBounds(sectionEl);

        // ResizeObserver с защитой
        const ro = new ResizeObserver(() => {
          const inst = draggableRef.current;
          const sec = sectionRef.current;
          if (!inst || !sec) return;
          inst.applyBounds(sec);
        });
        ro.observe(sectionEl);
        roRef.current = ro;

        return () => {
          roRef.current?.disconnect();
          roRef.current = null;
          draggableRef.current?.kill();
          draggableRef.current = null;
        };
      });

      return () => {
        mm.revert();
      };
    },
    { scope: sectionRef, dependencies: [index, myths.length] }
  );

  return (
    <section ref={sectionRef} className={styles.section}>
      {/* Этап 2: playground (десктоп) */}
      {!isMobile && (
        <div ref={playgroundRef} className={styles.playground}>
          <div className={styles.left}>
            {/* ВАЖНО: слот для карточки с позиц. относительно, чтобы заглушка легла поверх */}
            <div className={styles.cardSlot} style={{ position: "relative" }}>
              <div
                className={styles.card}
                ref={dragCardRef}
                style={
                  desktopCardHidden
                    ? { opacity: 0, pointerEvents: "none" }
                    : undefined
                }
                aria-hidden={desktopCardHidden}
              >
                <div className={styles.cardInner}>
                  <div className={styles.cardLabel}>{current.title}</div>
                  <div className={styles.cardText}>{current.text}</div>
                </div>
              </div>

              {/* Заглушка поверх карточки того же размера и в том же месте */}
              {desktopCardHidden && (
                <div
                  className={styles.card}
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1,
                  }}
                >
                  <div
                    className={styles.dropHint}
                    style={{ textAlign: "center" }}
                  >
                    <img
                      className={styles.cursor}
                      src="/images/stack.svg"
                      alt=""
                    />
                    <p style={{ textAlign: "center" }}>
                      {" "}
                      <span style={{ whiteSpace: "nowrap" }}>
                        Ура! Вы развеяли все мифы&nbsp;—
                      </span>
                      <br />{" "}
                      <span style={{ whiteSpace: "nowrap" }}>
                        переходите к блоку ниже
                      </span>{" "}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.right}>
            <div className={styles.dropZone} ref={dropZoneRef}>
              {answered ? (
                <div className={styles.answer} ref={answerRef}>
                  <div className={styles.expertHeader}>
                    {answered.expert.photo ? (
                      <img
                        className={styles.avatar}
                        src={answered.expert.photo}
                        alt={fixText(answered.expert.name)}
                        loading="eager"
                        decoding="async"
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder} />
                    )}
                    <div>
                      <div className={styles.expertName}>
                        {answered.expert.name}
                      </div>
                      <div className={styles.expertRole}>
                        {answered.expert.role}
                      </div>
                    </div>
                  </div>
                  <div className={styles.answerText}>
                    {answered.expert.answer}
                  </div>
                </div>
              ) : (
                <div className={styles.dropHint}>
                  <img
                    className={styles.cursor}
                    src="/images/cursor.svg"
                    alt=""
                  />
                  Перетащите миф в экспертное поле, чтобы развеять его
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Мобильный: один слайд на миф — клик по карточке переворачивает на ответ */}
      {isMobile && (
        <div ref={mobileRef} className={styles.mobileSlider}>
          <Swiper
            modules={[Pagination, Mousewheel, Keyboard]}
            className={styles.swiper}
            pagination={{ el: `.${styles.mobilePagination}`, clickable: true }}
            mousewheel={{ forceToAxis: true, releaseOnEdges: true }}
            keyboard={{ enabled: true }}
            slidesPerView={1}
            speed={450}
            spaceBetween={16}
            touchStartPreventDefault={false}
          >
            {myths.map((m) => (
              <SwiperSlide className={styles.mobileSlide} key={`myth-${m.id}`}>
                <MobileAnswerSlide myth={m} />
              </SwiperSlide>
            ))}
          </Swiper>

          <div className={styles.mobilePagination} />
        </div>
      )}

      {/* Подсказка: только десктоп; видна ПОСЛЕ первого дропа и пропадает, когда карточки закончились */}
      {!isMobile && (
        <div
          className={styles.abs_434}
          style={{
            opacity: hintVisible ? 1 : 0,
            transition: "opacity 0.25s ease",
            pointerEvents: "none",
          }}
        >
          <img
            ref={hintImgRef}
            className={styles.abs_434_img}
            src="/images/abs-4334.svg"
            alt=""
            draggable={false}
          />
          <p>
            Перетащите миф в экспертное <br />
            поле, чтобы развеять его
          </p>
        </div>
      )}
    </section>
  );
};