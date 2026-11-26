/* ============================================================
   动效：进场淡入 + 打字机
   尊重系统「减少动态效果」设置
   ============================================================ */

export const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 给 [data-reveal] 元素做进入视口时的淡入上移 */
export function initReveal(root = document) {
  const els = Array.from(root.querySelectorAll('[data-reveal]:not(.in)'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('in'));
    return;
  }

  els.forEach((el, i) => {
    el.style.transitionDelay = Math.min(i, 6) * 60 + 'ms';
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => io.observe(el));
}

/** 打字机循环：words 数组，逐字打出来再退格换下一个 */
export function typewriter(el, words, { prefix = '', speed = 90, pause = 1500 } = {}) {
  if (!el || !words || !words.length) return;

  if (reduceMotion) {
    el.textContent = prefix + words[0];
    return;
  }

  let wi = 0;
  let ci = 0;
  let deleting = false;

  const render = () => {
    el.textContent = prefix + words[wi].slice(0, ci) + '▍';
  };

  const tick = () => {
    const word = words[wi];
    if (!deleting) {
      ci += 1;
      render();
      if (ci >= word.length) {
        deleting = true;
        setTimeout(tick, pause);
      } else {
        setTimeout(tick, speed);
      }
    } else {
      ci -= 1;
      render();
      if (ci <= 0) {
        deleting = false;
        wi = (wi + 1) % words.length;
        setTimeout(tick, 320);
      } else {
        setTimeout(tick, Math.max(30, speed / 2));
      }
    }
  };

  ci = 0;
  render();
  setTimeout(tick, 400);
}
