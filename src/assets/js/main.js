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
    const chips = $$(".chip", box);

    const render = () => {
      const picked = chips.filter((c) => c.getAttribute("aria-pressed") === "true");
      const total = picked.reduce((n, c) => n + Number(c.dataset.pts), 0);
      pips.forEach((p, i) => p.classList.toggle("is-on", i < Math.min(total, budget)));
      box.classList.toggle("is-over", total > budget);
      box.classList.toggle("is-full", total === budget);

      if (!picked.length) {
        status.textContent = "Tap cards below to add them to your deck.";
      } else if (total > budget) {
        status.textContent = `${total} points. That's ${total - budget} too many. Something has to go.`;
      } else if (total === budget) {
        status.textContent = `Exactly ${budget}. That's a legal deck. Everything else has to be free.`;
      } else {
        const left = budget - total;
        status.textContent = `${total} spent, ${left} left.`;
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
