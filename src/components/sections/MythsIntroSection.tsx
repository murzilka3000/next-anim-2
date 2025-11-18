"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./MythsDragSection.module.scss";

gsap.registerPlugin(useGSAP, ScrollTrigger);

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

export const MythsIntroSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);

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

  // Плавное исчезновение интро при скролле
  useGSAP(() => {
    const intro = introRef.current!;
    gsap.fromTo(
      intro,
      { opacity: 1, y: 0 },
      {
        opacity: 0,
        y: -10,
        ease: "none",
        scrollTrigger: {
          trigger: intro,
          start: "center center",
          end: "+=550",
          scrub: true,
          // без snap — никакого автоперелистывания
          refreshPriority: -1,
        },
      }
    );
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className={styles.section}>
      <div ref={introRef} className={styles.intro}>
        <h2 className={styles.title}>
          Очень хочется делать <br /> силовые каждый день
        </h2>
        <div className={styles.subtitle_cont}>
          <p className={styles.subtitle}>
            как Джефф Безос, однако между <br /> намерением и действием часто{" "}
            <br /> появляется надоедливое «но».
          </p>
        </div>
        <p className={styles.lead}>
          Давайте вместе с тренерами школы Springle разберём <br />
          мифы, которые мешают вам сделать занятия спортом <br />
          лёгкой привычкой.
        </p>
      </div>
    </section>
  );
};