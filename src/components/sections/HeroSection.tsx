"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Frisbee } from "../svg/Frisbee";
import { Hand } from "../svg/Hand";
import styles from "./HeroSection.module.scss";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// Убираем скачки из-за появления/скрытия адресной строки на мобилках
ScrollTrigger.config({ ignoreMobileResize: true });

export const HeroSection = () => {
  const container = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const frisbeeSel = ".frisbee";
      const glintSel = `${frisbeeSel} [data-glint], ${frisbeeSel} .glint`;

      // Гарантируем масштабирование SVG из центра его bbox
      gsap.set(frisbeeSel, {
        transformOrigin: "50% 50%",
        transformBox: "fill-box",
        force3D: true,
      });

      // Хинт браузеру: контейнер будет пиниться трансформом — готовим композитинг заранее
      if (container.current) {
        gsap.set(container.current, { willChange: "transform" });
      }

      // Лёгкое парение тарелки
      gsap
        .timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } })
        .to(frisbeeSel, { y: "-=12", duration: 1.2 });

      // Скролл‑сцена
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container.current,
          start: "top top",
          end: "+=360", // комфортный ход под scrub
          scrub: 1,
          pin: true,
          pinSpacing: false, // убирает лишнее пустое место после секции
          invalidateOnRefresh: true,
          pinType: "transform", // стабилизирует поведение на iOS
          anticipatePin: 1, // сглаживает «рывок» в момент начала пина
        },
      });

      tl.to(".text-content", { opacity: 0, y: 50, duration: 0.5 })
        // Прячем блики перед зумом
        .to(glintSel, { autoAlpha: 0, duration: 0.2, ease: "none" }, ">-0.1")
        .to(
          frisbeeSel,
          {
            scale: 540,
            rotation: 0,
            duration: 2,
            ease: "power1.inOut",
            overwrite: "auto",
          },
          "<"
        )
        .to(
          ".hand",
          {
            opacity: 1,
            y: "100%",
            duration: 1,
            ease: "power1.inOut",
            overwrite: "auto",
          },
          "<"
        );
    },
    { scope: container }
  );

  return (
    <section className={styles.heroSection} ref={container}>
      <a className={styles.abs_img} href="https://www.rfdf.ru/">
        <img src="/images/4.svg" alt="" />
      </a>

      <div className={styles.wrapper}>
        <div className={`${styles.contentWrapper} text-content`}>
          <div className={styles.logos}>
            <a href="https://frankmedia.ru/?utm_source=springle.frankmedia.ru">
              <img src="/images/3.svg" alt="" />
            </a>
            <a href="">
              <img src="/images/2.svg" alt="" />
            </a>
            <a href="https://springle.ru/?erid=2SDnjeVK1nf&utm_source=springle.frankmedia.ru">
              <img src="/images/1.svg" alt="" />
            </a>
          </div>

          <div className={styles.sec_cont}>
            <h1 className={styles.title}>
              РЫВОК <br /> <span>В КАРЬЕРЕ</span>
            </h1>
            <p className={styles.description}>
              Как включить спорт в плотный график, сделать тренировки привычкой
              и вырасти по карьерной лестнице? Разберёмся, какой вид физической
              нагрузки принесёт вам наибольшую пользу и мотивацию продолжать. В
              конце — подарок от школы Springle.
            </p>
          </div>
        </div>
      </div>

      <Hand className={`${styles.hand} hand`} />
      <Frisbee className={`${styles.frisbee} frisbee`} />
    </section>
  );
};