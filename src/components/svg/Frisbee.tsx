"use client";

import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

gsap.registerPlugin(useGSAP);

export const Frisbee = React.forwardRef<
  SVGSVGElement,
  React.SVGProps<SVGSVGElement>
>((props, ref) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useGSAP(
    () => {
      const svg = svgRef.current!;
      const discTop = svg.querySelector("#discTop") as SVGPathElement | null;
      const track = svg.querySelector("#shine-track") as SVGPathElement | null;
      const container = svg.querySelector("#shines") as SVGGElement | null;
      const content = svg.querySelector("#content") as SVGGElement | null;
      if (!discTop || !track || !container || !content) return;

      // Настройки
      const OFFSET_PCT = 0.2;                // сужаем траекторию внутрь
      const LENGTHS_PCT = [0.12, 0.1, 0.08]; // длины бликов (доля периметра)
      const STROKE_W = 6;
      const SHINES_COUNT = LENGTHS_PCT.length;
      const STEP_COUNTS = [36, 42, 48];
      const DURATIONS = [1.15, 0.95, 1.3];

      // Порог автоскрытия по масштабу SVG
      const HIDE_AT_SCALE = 12;
      const SHOW_BACK_SCALE = HIDE_AT_SCALE * 0.8;

      // Надёжное чтение текущего масштаба SVG
      const readScale = (): number => {
        const sxRaw = gsap.getProperty(svg, "scaleX") as number | string;
        const syRaw = gsap.getProperty(svg, "scaleY") as number | string;
        let sx = Number(sxRaw);
        let sy = Number(syRaw);

        if (Number.isFinite(sx) && Number.isFinite(sy) && (sx !== 0 || sy !== 0)) {
          return Math.max(sx || 1, sy || 1);
        }

        const cs = getComputedStyle(svg);
        const tr = cs.transform || (cs as any).webkitTransform || "none";
        if (tr !== "none") {
          if (tr.startsWith("matrix3d(")) {
            const v = tr.slice(9, -1).split(",").map(parseFloat);
            const sx3d = Math.hypot(v[0], v[1], v[2]);
            const sy3d = Math.hypot(v[4], v[5], v[6]);
            return Math.max(sx3d || 1, sy3d || 1);
          }
          if (tr.startsWith("matrix(")) {
            const v = tr.slice(7, -1).split(",").map(parseFloat);
            const a = v[0], b = v[1], c = v[2], d = v[3];
            const sx2d = Math.hypot(a, b);
            const sy2d = Math.hypot(c, d);
            return Math.max(sx2d || 1, sy2d || 1);
          }
        }
        return 1;
      };

      // Построение параллельного пути внутрь диска
      const buildOffsetPath = (
        source: SVGPathElement,
        offsetPx: number,
        samples = 900
      ) => {
        const L = source.getTotalLength();
        if (!L) return "";
        const step = L / samples;
        const delta = step * 0.5;

        const bb = source.getBBox();
        const cx = bb.x + bb.width / 2;
        const cy = bb.y + bb.height / 2;

        const canTestFill = typeof (source as any).isPointInFill === "function";
        const pts: { x: number; y: number }[] = [];

        for (let i = 0; i < samples; i++) {
          const s = i * step;
          const p = source.getPointAtLength(s);
          const pPrev = source.getPointAtLength(Math.max(0, s - delta));
          const pNext = source.getPointAtLength(Math.min(L, s + delta));

          let dx = pNext.x - pPrev.x;
          let dy = pNext.y - pPrev.y;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len; dy /= len;

          const n1x = -dy, n1y = dx;
          const n2x =  dy, n2y = -dx;

          let qx = p.x + n1x * offsetPx;
          let qy = p.y + n1y * offsetPx;

          if (canTestFill) {
            const inside1 = (source as any).isPointInFill(new DOMPoint(qx, qy));
            if (!inside1) {
              qx = p.x + n2x * offsetPx;
              qy = p.y + n2y * offsetPx;
            }
          } else {
            const d1 = (qx - cx) ** 2 + (qy - cy) ** 2;
            const rx2 = p.x + n2x * offsetPx;
            const ry2 = p.y + n2y * offsetPx;
            const d2 = (rx2 - cx) ** 2 + (ry2 - cy) ** 2;
            if (d2 < d1) { qx = rx2; qy = ry2; }
          }

          pts.push({ x: qx, y: qy });
        }

        const d = pts.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(" ");
        return `${d} Z`;
      };

      const setTrack = () => {
        const bb = discTop.getBBox();
        const offsetPx = Math.min(bb.width, bb.height) * OFFSET_PCT;
        const d = buildOffsetPath(discTop, offsetPx, 900);
        track.setAttribute("d", d);
      };

      // Создание и анимация бликов
      let killShines: (() => void) | null = null;

      const setupShines = (): (() => void) | null => {
        const total = track.getTotalLength();
        if (!total) return null;

        container.innerHTML = "";
        const tweens: gsap.core.Tween[] = [];

        for (let i = 0; i < SHINES_COUNT; i++) {
          const seg = track.cloneNode(false) as SVGPathElement;
          seg.removeAttribute("id");
          seg.setAttribute("fill", "none");
          seg.setAttribute("stroke", "#FFFFFF");
          seg.setAttribute("stroke-opacity", "0.95");
          seg.setAttribute("stroke-width", String(STROKE_W));
          seg.setAttribute("stroke-linecap", "round");
          seg.setAttribute("stroke-linejoin", "round");
          seg.setAttribute("vector-effect", "non-scaling-stroke");
          seg.setAttribute("data-glint", "seg");

          container.appendChild(seg);

          const visibleLen = total * LENGTHS_PCT[i];

          gsap.set(seg, {
            strokeDasharray: `${visibleLen} ${total}`,
            strokeDashoffset: (i * total) / SHINES_COUNT,
          });

          const steps = STEP_COUNTS[i % STEP_COUNTS.length];
          const duration = DURATIONS[i % DURATIONS.length];

          tweens.push(
            gsap.to(seg, {
              strokeDashoffset: `-=${total}`,
              duration,
              ease: `steps(${steps})`,
              repeat: -1,
            })
          );
        }

        return () => tweens.forEach((t) => t.kill());
      };

      const setShinesActive = (active: boolean) => {
        if (active) {
          if (killShines) killShines();
          killShines = setupShines();
          container.style.display = "block";
          container.style.visibility = "";
          container.style.opacity = "";
        } else {
          if (killShines) killShines();
          killShines = null;
          container.innerHTML = "";
          // лучше прятать visibility вместо display, чтобы не триггерить повторное растрирование
          container.style.visibility = "hidden";
          container.style.opacity = "0";
        }
      };

      // init
      container.setAttribute("data-glint", "container");
      setTrack();
      setShinesActive(true);

      // Пересчёт при ресайзе
      const rerun = () => {
        setTrack();
        if (killShines) setShinesActive(true);
      };

      let ro: ResizeObserver | null = null;
      let offResize: (() => void) | null = null;

      const isBrowser = typeof window !== "undefined";
      const supportsRO = typeof ResizeObserver !== "undefined";

      if (isBrowser && supportsRO) {
        ro = new ResizeObserver(rerun);
        ro.observe(svg);
      } else if (isBrowser) {
        window.addEventListener("resize", rerun);
        offResize = () => window.removeEventListener("resize", rerun);
      }

      // Автоскрытие/возврат бликов по масштабу SVG
      let hiddenByScale = false;
      const checkScale = () => {
        const s = readScale();

        if (!hiddenByScale && s >= HIDE_AT_SCALE) {
          hiddenByScale = true;
          gsap.to(container, {
            opacity: 0,
            duration: 0.2,
            overwrite: "auto",
            onComplete: () => setShinesActive(false),
          });
        } else if (hiddenByScale && s <= SHOW_BACK_SCALE) {
          hiddenByScale = false;
          setShinesActive(true);
          gsap.fromTo(
            container,
            { opacity: 0, visibility: "visible" },
            { opacity: 1, duration: 0.25, overwrite: "auto" }
          );
        }
      };

      gsap.ticker.add(checkScale);

      // ---------- АНТИ‑ПОВОРОТ НА МОБИЛКЕ (SVG transform, не CSS) ----------
      const readRotationRad = (): number => {
        const tr = getComputedStyle(svg).transform || "none";
        if (tr === "none") return 0;
        if (tr.startsWith("matrix3d(")) {
          const v = tr.slice(9, -1).split(",").map(parseFloat);
          const a = v[0], b = v[1];
          return Math.atan2(b, a);
        }
        if (tr.startsWith("matrix(")) {
          const v = tr.slice(7, -1).split(",").map(parseFloat);
          const a = v[0], b = v[1];
          return Math.atan2(b, a);
        }
        return 0;
      };

      const vb = svg.viewBox.baseVal;
      const cx = vb && vb.width ? vb.x + vb.width / 2 : 387;  // по viewBox 774x439
      const cy = vb && vb.height ? vb.y + vb.height / 2 : 219.5;

      let antiRotateTicker: gsap.TickerCallback | null = null;

      const enableAntiRotate = () => {
        if (!content) return;
        if (!antiRotateTicker) {
          antiRotateTicker = () => {
            const ang = readRotationRad(); // рад
            const deg = (-ang * 180) / Math.PI;
            // ВАЖНО: атрибут transform, не CSS
            content.setAttribute("transform", `rotate(${deg} ${cx} ${cy})`);
          };
          gsap.ticker.add(antiRotateTicker);
        }
      };

      const disableAntiRotate = () => {
        if (antiRotateTicker) {
          gsap.ticker.remove(antiRotateTicker);
          antiRotateTicker = null;
        }
        // снимаем атрибут, чтобы не оставалось «следов»
        content.removeAttribute("transform");
      };

      const mq = window.matchMedia("(max-width: 811px)");
      const onMQ = (e: MediaQueryListEvent | MediaQueryList) => {
        const matches = "matches" in e ? e.matches : (e as MediaQueryList).matches;
        if (matches) enableAntiRotate();
        else disableAntiRotate();
      };
      onMQ(mq);
      // @ts-ignore кроссбраузерность
      mq.addEventListener ? mq.addEventListener("change", onMQ) : mq.addListener(onMQ as any);
      // ---------- /АНТИ‑ПОВОРОТ НА МОБИЛКЕ ----------

      return () => {
        gsap.ticker.remove(checkScale);
        if (killShines) killShines();
        container.innerHTML = "";
        if (ro) ro.disconnect();
        if (offResize) offResize();

        disableAntiRotate();
        // @ts-ignore
        mq.removeEventListener ? mq.removeEventListener("change", onMQ) : mq.removeListener(onMQ as any);
      };
    },
    { scope: svgRef }
  );

  const combinedRef = (el: SVGSVGElement | null) => {
    svgRef.current = el;
    if (typeof ref === "function") ref(el as SVGSVGElement);
    else if (ref) (ref as React.MutableRefObject<SVGSVGElement | null>).current = el;
  };

  return (
    <svg
      ref={combinedRef}
      width="774"
      height="439"
      viewBox="0 0 774 439"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* ВАЖНО: у этой группы есть id="content" */}
      <g id="content" clipPath="url(#clip0_2001_63)">
        {/* Верхняя «шапка» тарелки */}
        <path
          id="discTop"
          d="M513.274 0C326.725 0 0 108.272 0 282.837C0 403.266 139.09 437.209 216.342 438.618C479.155 443.421 773.768 310.46 773.768 164.622C773.768 29.8295 625.111 0 513.274 0Z"
          fill="#FFEACF"
        />
        <path
          d="M750.127 236.813C764.668 213.395 773.768 189.64 773.768 164.622C773.768 29.8295 625.111 0 513.274 0C326.725 0 0 108.272 0 282.837C0 363.003 61.6317 405.472 125.636 424.906C125.636 424.906 22.0797 386.688 22.0797 313.769C22.0797 181.743 327.835 56.3421 527.623 56.3421C680.497 56.3421 761.629 113.427 761.629 184.5C761.629 215.065 750.127 236.805 750.127 236.805V236.813Z"
          fill="url(#paint1_linear_2001_63)"
        />

        {/* Нижняя часть тарелки */}
        <path
          d="M750.655 141.372C750.655 141.372 782.707 183.658 750.441 236.338C678.89 353.136 435.073 442.617 216.35 438.618C183.189 438.013 137.024 434.826 98.5741 414.549C30.5213 378.668 23.0518 322.916 23.0518 322.916C29.6259 342.143 85.7396 391.729 215.661 400.309C317.687 407.042 581.977 359.854 706.029 237.909C762.648 182.248 750.012 144.299 750.012 144.299"
          fill="#FCE2C1"
        />

        {/* Путь-«трек» (d выставляется скриптом) */}
        <path id="shine-track" d="" fill="none" stroke="none" />

        {/* Блики (clip + blur) */}
        <g id="shines" data-glint clipPath="url(#discClip)" filter="url(#shineBlur)" />
      </g>

      <defs>
        {/* Градиенты тарелки */}
        <linearGradient id="paint0_linear_2001_63" x1="358.096" y1="127.775" x2="463.431" y2="472.813" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCE2C1" />
          <stop offset="0.23" stopColor="#FEE7CB" />
          <stop offset="0.49" stopColor="#FFEACF" />
        </linearGradient>
        <linearGradient id="paint1_linear_2001_63" x1="0" y1="212.453" x2="773.768" y2="212.453" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFEACF" />
          <stop offset="0.15" stopColor="#FFF3E0" />
          <stop offset="0.31" stopColor="#FFF9EC" />
          <stop offset="0.49" stopColor="#FFFBF0" />
          <stop offset="0.77" stopColor="#FFF9EE" />
          <stop offset="0.87" stopColor="#FFF6E7" />
          <stop offset="0.95" stopColor="#FFF0DB" />
          <stop offset="1" stopColor="#FFEACF" />
        </linearGradient>
        <linearGradient id="paint2_linear_2001_63" x1="49.8305" y1="364.113" x2="729.302" y2="258.049" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F1D5B2" />
          <stop offset="0.45" stopColor="#F5DCBC" />
          <stop offset="1" stopColor="#FFEACF" />
        </linearGradient>

        {/* Размытие бликов */}
        <filter
          id="shineBlur"
          filterUnits="userSpaceOnUse"
          x="-200"
          y="-200"
          width="1200"
          height="1000"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" edgeMode="duplicate" />
        </filter>

        {/* Clip по верхней части */}
        <clipPath id="discClip" clipPathUnits="userSpaceOnUse">
          <path d="M513.274 0C326.725 0 0 108.272 0 282.837C0 403.266 139.09 437.209 216.342 438.618C479.155 443.421 773.768 310.46 773.768 164.622C773.768 29.8295 625.111 0 513.274 0Z" />
        </clipPath>

        <clipPath id="clip0_2001_63">
          <rect width="774" height="439" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
});

Frisbee.displayName = "Frisbee";