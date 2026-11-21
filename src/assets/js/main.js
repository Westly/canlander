// canlander.org — small progressive enhancements. Everything works without this file.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* Mobile menu */
  const toggle = $(".menu-toggle");
  const mobile = $("#mobile-nav");
  if (toggle && mobile) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      mobile.hidden = open;
      $(".menu-toggle__label", toggle).textContent = open ? "Menu" : "Close";
    });
  }

  /* Countdown to the next points update */
  $$("[data-countdown]").forEach((el) => {
    const out = $("[data-countdown-out]", el);
    const target = new Date(el.dataset.countdown + "T00:00:00");
    if (!out || isNaN(target)) return;
    const days = Math.ceil((target - new Date()) / 86400000);
    if (days > 1) out.textContent = `in ${days} days`;
    else if (days === 1) out.textContent = "tomorrow";
    else if (days === 0) out.textContent = "today";
    else out.textContent = "check the council's site for news";
  });

  /* Points sandbox */
  $$("[data-sandbox]").forEach((box) => {
    const budget = Number(box.dataset.budget) || 10;
    const pips = $$(".meter__pip", box);
    const status = $("[data-status]", box);
    const chips = $$(".chip, .pick", box);

    const render = () => {
      const picked = chips.filter((c) => c.getAttribute("aria-pressed") === "true");
      const total = picked.reduce((n, c) => n + Number(c.dataset.pts), 0);
      pips.forEach((p, i) => p.classList.toggle("is-on", i < Math.min(total, budget)));
      box.classList.toggle("is-over", total > budget);
      box.classList.toggle("is-full", total === budget);

      if (!picked.length) {
        status.textContent = "Tap cards to add them. Tap again to remove.";
      } else if (total > budget) {
        status.textContent = `${total} points. That's ${total - budget} too many. Something has to go.`;
      } else if (total === budget) {
        status.textContent = `Exactly ${budget}: ${picked.map((c) => c.dataset.name).join(", ")}. Legal. Everything else has to be free.`;
      } else {
        const left = budget - total;
        status.textContent = `${total} spent, ${left} left: ${picked.map((c) => c.dataset.name).join(", ")}.`;
      }
    };

    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        const on = chip.getAttribute("aria-pressed") === "true";
        chip.setAttribute("aria-pressed", String(!on));
        render();
      })
    );
    $("[data-reset]", box)?.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
      render();
    });
  });


  /* Deck carousel: auto-advances, pauses on hover/focus, loops */
  $$("[data-carousel]").forEach((root) => {
    const track = $("[data-track]", root);
    const slides = $$(".carousel__slide", track);
    const count = $("[data-count]", root);
    if (!track || !slides.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = () => slides[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
    const perView = () => Math.max(1, Math.round(track.clientWidth / step()));
    const index = () => Math.round(track.scrollLeft / step());
    const update = () => {
      const i = index(), n = perView();
      if (count) count.textContent = `${i + 1}–${Math.min(i + n, slides.length)} of ${slides.length}`;
    };
    const go = (dir) => {
      const max = track.scrollWidth - track.clientWidth - 2;
      if (dir > 0 && track.scrollLeft >= max) track.scrollTo({ left: 0 });
      else if (dir < 0 && track.scrollLeft <= 2) track.scrollTo({ left: track.scrollWidth });
      else track.scrollBy({ left: dir * step() });
    };
    $("[data-next]", root)?.addEventListener("click", () => { go(1); hold(); });
    $("[data-prev]", root)?.addEventListener("click", () => { go(-1); hold(); });
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    window.addEventListener("resize", update);
    let paused = false, timer;
    const hold = () => { paused = true; clearTimeout(timer); timer = setTimeout(() => (paused = false), 12000); };
    ["mouseenter", "focusin", "touchstart"].forEach((e) => root.addEventListener(e, () => (paused = true), { passive: true }));
    ["mouseleave", "focusout"].forEach((e) => root.addEventListener(e, () => (paused = false)));
    if (!reduce) setInterval(() => { if (!paused && !document.hidden) go(1); }, 5000);
    update();
  });

  /* Resources filter */
  const filter = $("[data-filter]");
  if (filter) {
    filter.hidden = false;
    const groups = $$("[data-group]");
    const buttons = $$("[data-filter-value]", filter);
    const apply = (value) => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filterValue === value)));
      groups.forEach((g) => (g.hidden = value !== "all" && g.dataset.group !== value));
    };
    buttons.forEach((b) =>
      b.addEventListener("click", () => {
        const v = b.dataset.filterValue;
        apply(v);
        history.replaceState(null, "", v === "all" ? location.pathname : `#${v}`);
      })
    );
    const hash = location.hash.slice(1);
    if (hash && groups.some((g) => g.dataset.group === hash)) apply(hash);
  }

  /* Learn page: highlight current section in the table of contents */
  const tocLinks = $$(".docs__toc a[href^='#']");
  if (tocLinks.length && "IntersectionObserver" in window) {
    const map = new Map(tocLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            tocLinks.forEach((a) => a.classList.remove("is-active"));
            map.get(e.target.id)?.classList.add("is-active");
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    map.forEach((_, id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }
})();
