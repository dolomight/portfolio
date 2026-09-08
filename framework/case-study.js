/* ==========================================================================
   Case Study Framework — case-study.js
   Zero-dependency behaviours for portfolio case-study pages.

   Auto-initialises on DOMContentLoaded. Behaviours are opt-in via markup:

     [data-split]              word-by-word reveal when scrolled into view
     [data-reveal]             block fade/slide reveal
     .gallery                  sticky media gallery (captions drive active media)
     [data-video]              Vimeo background video that covers its box
     [data-count]              number counts up when scrolled into view
     [data-hero-fade]          pinned hero media fades out over the first screen
     [data-scrollfade]         opacity tracks scroll position (objective rows)
     [data-scrollscale]        frame grows 87.5% → 100% as it scrolls up (large media)
     [data-media-scroll]       frame grows, pins, and the tall screenshot scrolls inside it
     [data-footer-veil]        footer veil fades away as the footer scrolls in
     .archive-media iframe     Vimeo fullscreen button enabled on phones only
     .site-nav                 gets .is-scrolled after the hero

   Public API:  window.CaseStudy.init(root?)  — re-run for injected content
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- utils */
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function onInview(els, cb, opts) {
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { cb(el); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { cb(e.target); io.unobserve(e.target); }
      });
    }, opts || { rootMargin: "0px 0px -12% 0px", threshold: 0.01 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* --------------------------------------------------- word-split reveal */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "1";
    var index = 0;

    function walk(node) {
      if (node.nodeType === 3) {
        var parts = node.textContent.split(/(\s+)/);
        var frag = document.createDocumentFragment();
        parts.forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
          var w = document.createElement("span");
          w.className = "w";
          var i = document.createElement("span");
          i.className = "w__i";
          i.style.setProperty("--i", index++);
          i.textContent = part;
          w.appendChild(i);
          frag.appendChild(w);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1 && node.tagName !== "BR") {
        Array.prototype.slice.call(node.childNodes).forEach(walk);
      }
    }
    Array.prototype.slice.call(el.childNodes).forEach(walk);
  }

  function initSplit(root) {
    var els = $all("[data-split]", root);
    els.forEach(splitWords);
    if (reduceMotion) { els.forEach(function (el) { el.classList.add("is-inview"); }); return; }
    onInview(els, function (el) { el.classList.add("is-inview"); });
  }

  function initReveal(root) {
    var els = $all("[data-reveal]", root);
    if (reduceMotion) { els.forEach(function (el) { el.classList.add("is-inview"); }); return; }
    onInview(els, function (el) { el.classList.add("is-inview"); });
  }

  /* --------------------------------------------------------- count-up */
  function initCount(root) {
    var els = $all("[data-count]", root);
    onInview(els, function (el) {
      var target = parseFloat(el.dataset.count);
      var decimals = (el.dataset.count.split(".")[1] || "").length;
      var suffix = el.dataset.suffix || "";
      var prefix = el.dataset.prefix || "";
      if (reduceMotion || isNaN(target)) { el.textContent = prefix + el.dataset.count + suffix; return; }
      var dur = 1400, start = null;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, { threshold: 0.4 });
  }

  /* ---------------------------------------------------- sticky gallery */
  function initGallery(root) {
    $all(".gallery", root).forEach(function (gallery) {
      var items = $all(".gallery__item", gallery);
      var captions = $all(".gallery__caption", gallery);
      if (!items.length || !captions.length) return;
      var active = -1, ticking = false;

      function setActive(i) {
        if (i === active) return;
        active = i;
        items.forEach(function (it, k) { it.classList.toggle("is-active", k === i); });
        captions.forEach(function (c, k) { c.classList.toggle("is-active", k === i); });
      }

      function update() {
        ticking = false;
        var rect = gallery.getBoundingClientRect();
        var vh = window.innerHeight;
        // before the gallery: first item, after: last item
        if (rect.top > vh * 0.5) { setActive(0); return; }
        if (rect.bottom < vh * 0.5) { setActive(items.length - 1); return; }
        var mid = vh * 0.5, best = 0, bestDist = Infinity;
        captions.forEach(function (c, k) {
          var r = c.getBoundingClientRect();
          var center = r.top + r.height / 2;
          var d = Math.abs(center - mid);
          if (d < bestDist) { bestDist = d; best = k; }
        });
        setActive(best);
      }

      function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      update();
    });
  }

  /* ------------------------------------------------- vimeo cover video */
  var vimeoCount = 0, vimeoBoxes = {}, vimeoListening = false;

  function listenToVimeo() {
    if (vimeoListening) return;
    vimeoListening = true;
    window.addEventListener("message", function (e) {
      if (e.origin !== "https://player.vimeo.com") return;
      var data = e.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch (err) { return; } }
      if (!data || !data.player_id) return;
      var entry = vimeoBoxes[data.player_id];
      if (!entry) return;
      if (data.event === "ready") {
        ["play", "timeupdate"].forEach(function (ev) {
          entry.iframe.contentWindow.postMessage(
            JSON.stringify({ method: "addEventListener", value: ev }), "https://player.vimeo.com");
        });
      } else if (data.event === "play" || data.event === "timeupdate") {
        entry.box.classList.add("is-playing");
      }
    });
  }

  function initVideo(root) {
    listenToVimeo();
    $all("[data-video]", root).forEach(function (box) {
      if (box.dataset.videoDone) return;
      box.dataset.videoDone = "1";
      var kind = box.dataset.video; // "vimeo" | "file"
      var ratio = parseFloat(box.dataset.ratio || "1.7778");
      var media;

      if (kind === "vimeo" && box.dataset.vimeoId) {
        var playerId = "cs-vimeo-" + (++vimeoCount);
        var params = [
          "background=1", "autoplay=1", "loop=1", "muted=1", "autopause=0",
          "dnt=1", "title=0", "byline=0", "portrait=0", "controls=0", "playsinline=1",
          "api=1", "player_id=" + playerId
        ];
        if (box.dataset.vimeoHash) params.unshift("h=" + box.dataset.vimeoHash);
        media = document.createElement("iframe");
        media.id = playerId;
        media.src = "https://player.vimeo.com/video/" + box.dataset.vimeoId + "?" + params.join("&");
        media.allow = "autoplay; fullscreen; picture-in-picture";
        media.setAttribute("title", box.dataset.title || "Background video");
        media.setAttribute("tabindex", "-1");
        media.setAttribute("aria-hidden", "true");
        // Only reveal the player once Vimeo confirms it is actually playing.
        // A private, password-protected or domain-locked video therefore
        // leaves the poster in place instead of showing Vimeo's error/gate.
        vimeoBoxes[playerId] = { box: box, iframe: media };
      } else if (kind === "file" && box.dataset.src) {
        media = document.createElement("video");
        media.src = box.dataset.src;
        if (box.dataset.poster) media.poster = box.dataset.poster;
        media.muted = true; media.loop = true; media.autoplay = true; media.playsInline = true;
        media.setAttribute("aria-hidden", "true");
        media.addEventListener("playing", function () { box.classList.add("is-playing"); });
        // Missing/unsupported file: quietly fall back to the poster
        media.addEventListener("error", function () { box.classList.remove("is-playing"); media.remove(); });
      }
      if (!media) return;
      box.appendChild(media);

      function fit() {
        var w = box.clientWidth, h = box.clientHeight;
        if (!w || !h) return;
        var boxRatio = w / h;
        if (boxRatio > ratio) { media.style.width = w + "px"; media.style.height = (w / ratio) + "px"; }
        else { media.style.height = h + "px"; media.style.width = (h * ratio) + "px"; }
      }
      fit();
      window.addEventListener("resize", fit);

      // Save bandwidth: pause/unload iframes far outside the viewport
      if ("IntersectionObserver" in window && kind === "vimeo") {
        var src = media.src;
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { if (!media.src) media.src = src; }
            else if (media.src && Math.abs(e.boundingClientRect.top) > window.innerHeight * 3) {
              media.removeAttribute("src"); box.classList.remove("is-playing");
            }
          });
        }, { rootMargin: "100% 0px" }).observe(box);
      }
    });
  }

  /* ------------------------------------------- pinned scroll-through media
     [data-media-scroll] (optional data-scroll-speed, default 0.75 = how many
     px of page scroll per px of screenshot scroll). */
  function initMediaScroll(root) {
    $all("[data-media-scroll]", root).forEach(function (block) {
      var frame = block.querySelector(".media-scroll__frame");
      var view = block.querySelector(".browser-frame__view");
      var img = view && view.querySelector("img");
      if (!frame || !view || !img) return;
      var speed = parseFloat(block.dataset.scrollSpeed || "0.75");
      var scrollMax = 0, ticking = false;

      function size() {
        var vh = window.innerHeight;
        scrollMax = Math.max(0, img.offsetHeight - view.clientHeight);
        img.style.setProperty("--scroll-max", scrollMax + "px");
        block.style.height = Math.round(vh + scrollMax * speed) + "px";
        update();
      }

      function update() {
        ticking = false;
        var vh = window.innerHeight;
        var rect = block.getBoundingClientRect();
        // Phase 1 — grow: frame's laid-out top travels from below the fold to its centred spot
        var centredTop = (vh - frame.offsetHeight) / 2;
        var frameTop = Math.max(rect.top, 0) + centredTop;
        var p = reduceMotion ? 1 : clamp01((vh - frameTop) / Math.max(1, vh - centredTop));
        frame.style.setProperty("--ss", (1 - (1 - p) * (1 - p)).toFixed(3));
        // Phase 2 — pinned: scroll the screenshot inside the frame
        var travel = Math.max(1, block.offsetHeight - vh);
        img.style.setProperty("--sp", clamp01(-rect.top / travel).toFixed(4));
      }

      function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", size);
      if (img.complete && img.naturalHeight) size(); else img.addEventListener("load", size);
      size();
    });
  }

  /* --------------------------------------------------------------- nav */
  /* Every project, in home-page order. Paths are relative to the site root,
     which is worked out from this script's own URL so the list works from
     any page depth. */
  var WORK_ITEMS = [
    { path: "case-studies/jobsohio/index.html", thumb: "assets/menu/jobsohio.jpg", title: "JobsOhio", kind: "Case study", desc: "Selling Ohio to companies deciding where to build, hire and invest" },
    { path: "case-studies/ccg/index.html", thumb: "assets/menu/ccg.jpg", title: "Creative Composites Group", kind: "Case study", desc: "Rebuilding the FRP infrastructure leader’s site for the engineers who use it" },
    { path: "case-studies/bbw/index.html", thumb: "assets/menu/bbw.jpg", title: "Bath & Body Works", kind: "Case study", desc: "A corporate home built around People, Product and Planet" },
    { path: "case-studies/smucker/index.html", thumb: "assets/menu/smucker.jpg", title: "The J.M. Smucker Co.", kind: "Case study", desc: "Telling the story of a family company behind 40+ brands" },
    { path: "archive/exal/index.html", thumb: "assets/menu/exal.jpg", title: "Exal Visualizer", kind: "Archive", desc: "A browser configurator that puts the customer’s brand on the bottle" },
    { path: "archive/stryker/index.html", thumb: "assets/menu/stryker.jpg", title: "Stryker Knee", kind: "Archive", desc: "A patient-education iPad app for a dual-radius knee implant" },
    { path: "archive/ticktracker/index.html", thumb: "assets/menu/ticktracker.jpg", title: "TickTracker", kind: "Archive", desc: "Brand, UX and UI for a crowdsourced tick tracking app" },
    { path: "archive/cm1000/index.html", thumb: "assets/menu/cm1000.jpg", title: "CM1000 Sales Tool", kind: "Archive", desc: "A live-data cost calculator for a new marine pump" },
    { path: "archive/nationwide/index.html", thumb: "assets/menu/nationwide.jpg", title: "Nationwide Life", kind: "Archive", desc: "A 360° video and browser VR pilot for life insurance" },
    { path: "archive/ge/index.html", thumb: "assets/menu/ge.jpg", title: "GE Healthcare", kind: "Archive", desc: "Putting everyday and medical radiation exposure on one scale" },
    { path: "archive/tradeshow/index.html", thumb: "assets/menu/tradeshow.jpg", title: "Trade Show Experiences", kind: "Archive", desc: "Kiosks, virtual booths and sales aids for four brands" },
    { path: "archive/qn2a/index.html", thumb: "assets/menu/qn2a.jpg", title: "QN2A · Stand Up To Cancer", kind: "Archive", desc: "Where cancer patients shared the questions they wish they’d asked" }
  ];
  var scriptSrc = (document.currentScript && document.currentScript.src) || "";
  var siteRoot = scriptSrc.replace(/framework\/[^\/]*$/, "");

  function buildWorkList(menu) {
    if (!siteRoot || menu.querySelector(".site-menu__work")) return;
    var list = document.createElement("div");
    list.className = "site-menu__work";
    list.setAttribute("aria-label", "All projects");
    var here = location.pathname.replace(/\/index\.html$/, "/");
    var HEADINGS = { "Case study": "Case studies", "Archive": "Archive" };
    var lastKind = null;
    WORK_ITEMS.forEach(function (item, i) {
      if (item.kind !== lastKind) {   // sub-header above each group
        lastKind = item.kind;
        var h = document.createElement("p");
        h.className = "site-menu__heading";
        h.textContent = HEADINGS[item.kind] || item.kind;
        h.style.setProperty("--i", i);
        list.appendChild(h);
      }
      var a = document.createElement("a");
      a.className = "work-card";
      a.href = siteRoot + item.path;
      a.style.setProperty("--i", i);
      var itemPath = new URL(a.href).pathname.replace(/\/index\.html$/, "/");
      if (itemPath === here) a.classList.add("is-current");
      a.innerHTML =
        '<span class="work-card__thumb"><img src="' + siteRoot + item.thumb + '" alt="" width="480" height="300"></span>' +
        '<span class="work-card__body"><span class="work-card__num">' + (i < 9 ? "0" : "") + (i + 1) + " · " + item.title + "</span>" +
        '<span class="work-card__title">' + item.desc + "</span>" +
        '<span class="work-card__kind">' + item.kind + "</span></span>";
      list.appendChild(a);
    });
    menu.appendChild(list);
  }

  function initNav() {
    var nav = document.querySelector(".site-nav");
    if (!nav || nav.dataset.navDone) return;
    nav.dataset.navDone = "1";
    var toggle = nav.querySelector(".site-nav__toggle");
    var menu = toggle && document.getElementById(toggle.getAttribute("aria-controls"));
    if (menu) buildWorkList(menu);

    // Brand: split "Sean Cowan" into letters so they can fade out left→right
    var brandName = nav.querySelector(".brand-name");
    if (brandName && !brandName.dataset.split) {
      brandName.dataset.split = "1";
      var text = brandName.textContent; brandName.textContent = ""; brandName.style.setProperty("--n", text.length);
      Array.prototype.forEach.call(text, function (ch, i) {
        var sp = document.createElement("span"); sp.textContent = ch; sp.style.setProperty("--i", i); brandName.appendChild(sp);
      });
    }
    function update() { nav.classList.toggle("is-scrolled", window.scrollY > 40); }
    window.addEventListener("scroll", update, { passive: true });
    update();

    if (!toggle || !menu) return;
    function setOpen(open) {
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.setAttribute("aria-hidden", open ? "false" : "true");
    }
    setOpen(false);
    toggle.addEventListener("click", function () {
      var open = !document.body.classList.contains("menu-open");
      setOpen(open);
      var list = menu.querySelector(".site-menu__work");
      if (open && list) list.scrollTop = 0;   // reveal always runs from the top card down
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  /* ---------------------------------------------- scroll-linked effects
     One rAF-throttled scroll loop drives:
       [data-hero-fade]    pinned hero media fades out over the first screen
       [data-scrollfade]   element opacity follows its position in the viewport
       [data-footer-veil]  footer veil fades away as the footer scrolls in   */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function initScrollLinked(root) {
    var heroMedia = $all("[data-hero-fade]", root);
    var fades = $all("[data-scrollfade]", root);
    var scales = $all("[data-scrollscale]", root);
    var veils = $all("[data-footer-veil]", root);
    var pageEnd = document.querySelector("main > .page-end");
    if (!heroMedia.length && !fades.length && !scales.length && !veils.length && !pageEnd) return;

    if (reduceMotion) {
      heroMedia.forEach(function (el) { el.style.opacity = ""; });
      fades.forEach(function (el) { el.style.setProperty("--sf", 1); });
      scales.forEach(function (el) { el.style.setProperty("--ss", 1); });
      veils.forEach(function (el) { el.style.setProperty("--veil", 0); });
    }

    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight, y = window.scrollY;

      // Page turns light once the end block is on screen (curtain ending);
      // the nav follows while the light page still covers the top of the viewport
      if (pageEnd) {
        var main = pageEnd.parentElement;
        var light = pageEnd.getBoundingClientRect().top < vh * 0.85;
        main.classList.toggle("is-light", light);
        var nav = document.querySelector(".site-nav");
        if (nav) nav.classList.toggle("is-light", light && main.getBoundingClientRect().bottom > nav.offsetHeight);
      }
      if (reduceMotion) return;

      heroMedia.forEach(function (el) {
        var p = clamp01(y / (vh * 0.9));
        el.style.opacity = (1 - p).toFixed(3);
        el.classList.toggle("is-hidden", p >= 1);
      });

      fades.forEach(function (el) {
        var top = el.getBoundingClientRect().top;
        var start = vh * 0.95, end = vh * 0.62;
        el.style.setProperty("--sf", clamp01((start - top) / (start - end)).toFixed(3));
      });

      // Grows from 87.5% as its top travels from the bottom of the viewport to the top (ease-out)
      scales.forEach(function (el) {
        var p = clamp01(1 - el.getBoundingClientRect().top / vh);
        el.style.setProperty("--ss", (1 - (1 - p) * (1 - p)).toFixed(3));
      });

      veils.forEach(function (el) {
        var footer = el.parentElement;
        var top = footer.getBoundingClientRect().top;
        var p = clamp01((vh - top) / (vh * 0.85));
        el.style.setProperty("--veil", (0.92 * (1 - p)).toFixed(3));
      });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  /* ------------------------------------------ archive player: mobile fullscreen
     Archive pages embed a stripped-down Vimeo player (fullscreen=0). On phones
     the small inline frame is hard to watch, so allow the fullscreen button
     there only — desktop keeps the bare player. */
  function initArchiveFullscreen(root) {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    $all(".archive-media iframe[src*='player.vimeo.com']", root).forEach(function (f) {
      if (f.src.indexOf("fullscreen=0") === -1) return;
      f.src = f.src.replace("fullscreen=0", "fullscreen=1");
      f.setAttribute("allowfullscreen", "");
      var allow = f.getAttribute("allow") || "";
      if (allow.indexOf("fullscreen") === -1) f.setAttribute("allow", (allow ? allow + "; " : "") + "fullscreen");
    });
  }

  /* -------------------------------------------------------------- init */
  function init(root) {
    root = root || document;
    initSplit(root);
    initReveal(root);
    initCount(root);
    initGallery(root);
    initVideo(root);
    initScrollLinked(root);
    initMediaScroll(root);
    initArchiveFullscreen(root);
    initNav();
  }

  window.CaseStudy = { init: init, splitWords: splitWords };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
  else init();
})();
