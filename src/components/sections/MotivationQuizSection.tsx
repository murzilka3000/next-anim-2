"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./MotivationQuizSection.module.scss";
import { questions } from "@/data/questions";
import { Option, Question } from "@/data/questions";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const ICONS = {
  good: "/images/green.svg",
  warn: "/images/red.svg",
};

const ANIM = {
  speed: 0.85,
  delayBeforeResults: 0.9,
};

type Skill = { id: string; title: React.ReactNode; qId?: Question["id"] };

/* ===== NBSP обработчик ===== */
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
/* ===== конец NBSP блока ===== */

const skillsMap: Skill[] = [
  {
    id: "decision_speed",
    title: (
      <>
        Скорость принятия
        <br />
        решений
      </>
    ),
    qId: "q1",
  },
  {
    id: "teamwork",
    title: (
      <>
        Работа
        <br />в команде
      </>
    ),
    qId: "q2",
  },
  {
    id: "stress",
    title: (
      <>
        Стрессо-
        <br />
        устойчивость
      </>
    ),
    qId: "q3",
  },
  {
    id: "negotiation",
    title: (
      <>
        Умение
        <br />
        договариваться
      </>
    ),
    qId: "q4",
  },
  {
    id: "strategic",
    title: (
      <>
        Стратегическое
        <br />
        мышление
      </>
    ),
    qId: "q5",
  },
];

export const MotivationQuizSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);
  const quizRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const optionsRef = useRef<HTMLUListElement | null>(null);
  const explainElRef = useRef<HTMLDivElement | null>(null);
  const explainWrapRef = useRef<HTMLDivElement | null>(null);

  const transitionTimeline = useRef<gsap.core.Timeline | null>(null);
  const entryTlRef = useRef<gsap.core.Timeline | null>(null);

  // Определяем мобильный брейкпоинт (на мобилке — квиз в попапе)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 811px)");
    const onChange = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsMobile("matches" in e ? e.matches : (e as MediaQueryList).matches);
    onChange(mq);
    if (mq.addEventListener) mq.addEventListener("change", onChange as any);
    else (mq as any).addListener(onChange as any);
    return () => {
      if (mq.removeEventListener)
        mq.removeEventListener("change", onChange as any);
      else (mq as any).removeListener(onChange as any);
    };
  }, []);

  // Мобильный попап
  const [modalOpen, setModalOpen] = useState(false);

  // Лок скролла страницы, пока попап открыт
  const savedScrollY = useRef(0);
  const prevBody = useRef({
    overflow: "",
    position: "",
    top: "",
    left: "",
    right: "",
    width: "",
    paddingRight: "",
  });
  const prevHtmlScrollBehavior = useRef("");
  const isScrollLockedRef = useRef(false);

  const lockPageScroll = () => {
    if (typeof window === "undefined" || isScrollLockedRef.current) return;
    const body = document.body;
    const html = document.documentElement;

    savedScrollY.current =
      window.scrollY ||
      window.pageYOffset ||
      html.scrollTop ||
      document.scrollingElement?.scrollTop ||
      0;

    prevBody.current = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    };
    prevHtmlScrollBehavior.current = html.style.scrollBehavior;

    html.style.scrollBehavior = "auto";

    const scrollbarW = window.innerWidth - html.clientWidth;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`;

    isScrollLockedRef.current = true;
  };

  const unlockPageScroll = () => {
    if (typeof window === "undefined" || !isScrollLockedRef.current) return;
    const body = document.body;
    const html = document.documentElement;

    const y = savedScrollY.current || 0;

    body.style.overflow = prevBody.current.overflow;
    body.style.position = prevBody.current.position;
    body.style.top = prevBody.current.top;
    body.style.left = prevBody.current.left;
    body.style.right = prevBody.current.right;
    body.style.width = prevBody.current.width;
    body.style.paddingRight = prevBody.current.paddingRight;

    requestAnimationFrame(() => {
      window.scrollTo(0, y);
      requestAnimationFrame(() => {
        html.style.scrollBehavior = prevHtmlScrollBehavior.current;
      });
    });

    isScrollLockedRef.current = false;
  };

  // Лочим скролл и после монтирования портала гарантированно показываем Quiz и скрываем Results
  useEffect(() => {
    if (isMobile && modalOpen) {
      lockPageScroll();
      const rafId = requestAnimationFrame(() => {
        if (quizRef.current)
          gsap.set(quizRef.current, { autoAlpha: 1, pointerEvents: "auto" });
        if (resultsRef.current)
          gsap.set(resultsRef.current, { autoAlpha: 0, pointerEvents: "none" });
      });
      return () => {
        cancelAnimationFrame(rafId);
        unlockPageScroll();
      };
    }
  }, [isMobile, modalOpen]);

  // На размонтировании гарантированно вернуть скролл
  useEffect(() => {
    return () => unlockPageScroll();
  }, []);

  // Закрытие по Esc внутри попапа
  useEffect(() => {
    if (!isMobile || !modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobile, modalOpen]);

  // NBSP
  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;
    processTextNodes(root);
    const mo = new MutationObserver((mut) => {
      for (const m of mut) {
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

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [answers, setAnswers] = useState<
    Record<string, { selectedId: string; correct: boolean }>
  >({});

  const q = questions[idx];
  const total = questions.length;

  useGSAP(
    () => {
      if (quizRef.current)
        gsap.set(quizRef.current, { autoAlpha: 0, pointerEvents: "none" });
      if (resultsRef.current)
        gsap.set(resultsRef.current, { autoAlpha: 0, pointerEvents: "none" });

      const mm = gsap.matchMedia();

      // Таймлайн перехода интро → квиз (десктоп)
      transitionTimeline.current = gsap
        .timeline({ paused: true })
        .to(introRef.current, {
          autoAlpha: 0,
          pointerEvents: "none",
          duration: 0.4,
          ease: "power2.inOut",
        })
        .to(
          quizRef.current,
          {
            autoAlpha: 1,
            pointerEvents: "auto",
            duration: 0.4,
            ease: "power2.inOut",
          },
          "<"
        )
        .timeScale(ANIM.speed);

      mm.add("(min-width: 812px)", () => {
        return () => {};
      });

      mm.add("(max-width: 811px)", () => {
        return () => {};
      });

      return () => {
        mm.revert();
      };
    },
    { scope: sectionRef }
  );

  const handleStart = (e: React.MouseEvent) => {
    e.preventDefault();

    // Yandex.Metrica goal
    (window as any).ym?.(105181480, "reachGoal", "take_test");

    if (isMobile) {
      setModalOpen(true);
    } else {
      transitionTimeline.current?.play();
    }
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const goToResults = () => {
    const tl = gsap
      .timeline()
      .to(quizRef.current, {
        autoAlpha: 0,
        pointerEvents: "none",
        duration: 0.4,
        ease: "power2.inOut",
      })
      .to(
        resultsRef.current,
        {
          autoAlpha: 1,
          pointerEvents: "auto",
          duration: 0.4,
          ease: "power2.inOut",
        },
        "<"
      );

    tl.timeScale(ANIM.speed);
  };

  const restartQuiz = () => {
    setIdx(0);
    setSelected(null);
    setAnswers({});
  };

  const selectOption = (opt: Option) => {
    if (selected) return;
    setSelected(opt.id);

    setAnswers((prev) => ({
      ...prev,
      [q.id]: { selectedId: opt.id, correct: opt.correct },
    }));
  };

  const nextQuestion = () => {
    if (isTransitioning) return;

    const isLast = idx >= total - 1;
    if (isLast) {
      goToResults();
      return;
    }

    const header = headerRef.current;
    const optionsList = optionsRef.current;
    const card = cardRef.current;

    if (!header || !optionsList || !card) return;

    setIsTransitioning(true);

    // Закрываем explain (CSS-анимация через grid-template-rows/opacity)
    setSelected(null);

    const optionEls = Array.from(
      optionsList.querySelectorAll(`.${styles.option}`)
    ) as HTMLElement[];

    const topCards = Array.from(
      card.querySelectorAll(`.${styles.top_card}`)
    ) as HTMLElement[];

    gsap.killTweensOf([header, ...optionEls, ...topCards]);

    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: () => {
        setIdx((i) => i + 1);
        setIsTransitioning(false);
      },
    });

    if (optionEls.length) {
      tl.to(
        optionEls,
        {
          y: 12,
          autoAlpha: 0,
          duration: 0.3,
          stagger: 0.08,
        },
        0
      );
    }

    tl.to(
      header,
      { y: -20, rotate: 5, autoAlpha: 0, duration: 0.32, ease: "power2.in" },
      0.05
    );

    if (topCards.length) {
      tl.to(
        topCards,
        {
          y: "-=10",
          autoAlpha: 0,
          duration: 0.3,
          stagger: 0.06,
          ease: "power2.in",
        },
        0.05
      );
    }

    tl.timeScale(ANIM.speed);
  };

  // Вход новой карточки
  useEffect(() => {
    if (!headerRef.current || !optionsRef.current || !cardRef.current) return;

    const header = headerRef.current;
    const optionsList = optionsRef.current;
    const optionEls = Array.from(
      optionsList.querySelectorAll(`.${styles.option}`)
    ) as HTMLElement[];

    const topCards = Array.from(
      cardRef.current.querySelectorAll(`.${styles.top_card}`)
    ) as HTMLElement[];

    gsap.set(header, { y: 20, rotate: -3, autoAlpha: 0 });
    if (topCards.length) gsap.set(topCards, { y: 15, autoAlpha: 0 });
    if (optionEls.length) gsap.set(optionEls, { y: 12, autoAlpha: 0 });

    entryTlRef.current?.kill();
    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
    });

    if (topCards.length) {
      tl.to(topCards, { y: 0, autoAlpha: 1, duration: 0.34, stagger: 0.06 }, 0);
    }
    tl.to(header, { y: 0, rotate: 0, autoAlpha: 1, duration: 0.45 }, 0.04);

    if (optionEls.length) {
      tl.to(
        optionEls,
        { y: 0, autoAlpha: 1, duration: 0.34, stagger: 0.08 },
        "-=0.1"
      );
    }

    tl.timeScale(ANIM.speed);
    entryTlRef.current = tl;

    return () => {
      tl.kill();
    };
  }, [idx]);

  const nextDisabled = selected === null || isTransitioning;
  const isLastQuestion = idx === total - 1;

  const remaining = Math.max(0, total - (idx + 1));
  const topCount = Math.min(4, remaining);

  const modalStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "#ffeacf",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
    padding: "55px 10px 55px 10px",
    margin: "auto 0",
    overflowX: "hidden",
  };

  const closeBtnStyle: React.CSSProperties = {
    position: "fixed",
    top: 12,
    right: 12,
    zIndex: 10000,
    background: "rgba(0,0,0,0.0)",
    border: "none",
  };

  const QuizAndResults = (
    <>
      {/* QUIZ */}
      <div id="quiz" ref={quizRef} className={styles.quiz}>
        <div className={styles.quizInner}>
          <div className={styles.card} ref={cardRef}>
            <div className={styles.card_abs}>
              <div className={styles.cardHeader} ref={headerRef}>
                <div className={styles.counter}>
                  {q.title ?? `ВОПРОС ${idx + 1}/${total}`}
                </div>
                <div className={styles.prompt}>{q.prompt}</div>
              </div>

              {Array.from({ length: topCount }).map((_, i) => {
                const modClass = (styles as any)[`modifier_class_${i + 1}`];
                return (
                  <div
                    key={`tc-${i}`}
                    className={`${styles.top_card} ${modClass}`}
                  />
                );
              })}
            </div>

            <ul className={styles.options} ref={optionsRef}>
              {q.options.map((opt) => {
                const selectedThis = selected === opt.id;

                let stateClass;
                if (selected) {
                  if (opt.correct) stateClass = styles.correct;
                  else if (selectedThis) stateClass = styles.wrong;
                }

                return (
                  <li
                    key={opt.id}
                    className={`${styles.option} ${stateClass ?? ""}`}
                    onClick={() => selectOption(opt)}
                    role="button"
                    aria-pressed={selectedThis}
                    aria-disabled={!!selected}
                  >
                    <span className={styles.radio}>
                      <span className={styles.dot} />
                    </span>
                    <span className={styles.optionText}>{opt.text}</span>
                  </li>
                );
              })}
            </ul>

            {/* Обёртка для плавного появления объяснения — без GSAP, чистый CSS */}
            <div
              ref={explainWrapRef}
              data-nbsp-skip
              style={{
                display: "grid",
                gridTemplateRows: selected ? "1fr" : "0fr",
                transition:
                  "grid-template-rows 380ms cubic-bezier(0.22, 1, 0.36, 1)",
                overflow: "hidden",
              }}
            >
              <div
                ref={explainElRef}
                className={styles.explain}
                style={{
                  opacity: selected ? 1 : 0,
                  transform: selected ? "translateY(0)" : "translateY(6px)",
                  transition: "opacity 380ms ease, transform 380ms ease",
                }}
              >
                {q.explanation}
              </div>
            </div>
          </div>

          <button
            className={`${styles.nextFab} ${
              nextDisabled ? styles.disabled : ""
            }`}
            onClick={nextQuestion}
            disabled={nextDisabled}
            aria-label={isLastQuestion ? "К результатам" : "Следующий вопрос"}
            title={isLastQuestion ? "К результатам" : "Следующий вопрос"}
          >
            <span className={styles.arrow}>
              <img src="/images/str.svg" alt="" />
            </span>
          </button>
        </div>
      </div>

      {/* RESULTS */}
      <div ref={resultsRef} className={styles.results}>
        <div className={styles.resultsInner}>
          <div className={styles.resultsHeader}>
            <h3 className={styles.resultsTitle}>
              <span className={styles.titlePrimary}>Ваша карта</span>
              <span className={styles.titleAccent}>гибких навыков</span>
            </h3>
          </div>

          <ul className={styles.skills}>
            {skillsMap.map((s) => {
              const raw = s.qId ? answers[s.qId] : undefined;
              const state: true | false | null =
                s.qId && raw !== undefined ? raw.correct : null;

              let cls = styles.skill;
              if (state === true) cls += ` ${styles.skillGood}`;
              if (state === false) cls += ` ${styles.skillWarn}`;

              return (
                <li key={s.id} className={cls}>
                  <span
                    className={`${styles.skillIcon} ${
                      state === true
                        ? styles.iconGood
                        : state === false
                        ? styles.iconWarn
                        : ""
                    }`}
                    aria-hidden
                  >
                    {state !== null && (
                      <img
                        className={styles.skillGlyph}
                        src={state ? ICONS.good : ICONS.warn}
                        alt=""
                        loading="lazy"
                      />
                    )}
                  </span>
                  <span className={styles.skillTitle}>{s.title}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );

  return (
    <section className={styles.section} ref={sectionRef}>
      {/* INTRO (всегда в потоке) */}
      <div ref={introRef} className={styles.intro}>
        <div className={styles.introInner}>
          <h2 className={styles.title}>
            Теперь вам легче вписать тренировки в расписание.
          </h2>
          <div className={styles.cont__cont}>
            <div className={styles.cont}>
              <p className={styles.subtitle}>
                Осталось найти верную мотивацию.
              </p>
              <p className={styles.lead}>
                Регулярная физическая нагрузка помогает держать себя в форме, а
                ещё развивает навыки, на которых строится успех в карьере и
                повседневной жизни.
              </p>
              <p className={styles.leadMuted}>
                Давайте проверим, какие софт‑скиллы спорт поможет прокачать вам?
              </p>
              <button className={styles.cta} onClick={handleStart}>
                Пройти тест
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Десктоп: квиз и результаты в потоке */}
      {!isMobile && <div>{QuizAndResults}</div>}

      {/* Мобилка: попап через портал */}
      {isMobile &&
        modalOpen &&
        createPortal(
          <div
            className={styles.frgfww}
            style={modalStyle}
            role="dialog"
            aria-modal
          >
            <button
              aria-label="Закрыть"
              onClick={closeModal}
              style={closeBtnStyle}
            >
              <img src="/images/clo.svg" alt="" />
            </button>
            {QuizAndResults}
          </div>,
          document.body
        )}
    </section>
  );
};
