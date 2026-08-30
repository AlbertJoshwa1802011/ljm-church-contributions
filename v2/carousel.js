// Shared carousel behaviour for the V2 home page — used by both the header
// image band and the promise card, so the swipe gesture feels the same in
// both places and is written once.
//
// The V2 promise card used to auto-rotate on a timer with no touch, pointer or
// keyboard handling at all, which is why swiping it did nothing. This module
// is what makes "swipe to the next one" actually work.
//
//   var c = LJMCarousel.create({
//     viewport: el,            // element the gestures are bound to
//     count: 5,                // number of slides
//     interval: 2500,          // ms between automatic advances (0 = no autoplay)
//     onChange: function (i) {},// called with the active index
//     dots: el                 // optional container to fill with dot buttons
//   });
//   c.next(); c.prev(); c.goTo(2); c.setCount(n); c.destroy();
//
// Autoplay pauses while the visitor is hovering, has keyboard focus inside, or
// has the tab in the background, and is disabled entirely when the operating
// system asks for reduced motion.

(function (global) {
  "use strict";

  var SWIPE_THRESHOLD = 40;   // px of horizontal travel before it counts
  var AXIS_LOCK = 10;         // px before we decide horizontal vs vertical

  function prefersReducedMotion() {
    try {
      return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {
      return false;
    }
  }

  function create(options) {
    var opts = options || {};
    var viewport = opts.viewport;
    var count = opts.count || 0;
    var interval = opts.interval || 0;
    var onChange = typeof opts.onChange === "function" ? opts.onChange : function () {};
    var dotsHost = opts.dots || null;
    var label = opts.label || "slide";

    var index = 0;
    var timer = null;
    var hovering = false;
    var focused = false;
    var destroyed = false;
    var reduced = prefersReducedMotion();

    function clampIndex(i) {
      if (count <= 0) return 0;
      return ((i % count) + count) % count;
    }

    function paintDots() {
      if (!dotsHost) return;
      if (count <= 1) { dotsHost.innerHTML = ""; return; }
      var html = "";
      for (var i = 0; i < count; i++) {
        html += '<button type="button" class="carousel-dot' + (i === index ? " is-active" : "") +
          '" data-index="' + i + '" aria-label="Show ' + label + ' ' + (i + 1) + ' of ' + count + '"' +
          (i === index ? ' aria-current="true"' : "") + "></button>";
      }
      dotsHost.innerHTML = html;
      Array.prototype.forEach.call(dotsHost.querySelectorAll(".carousel-dot"), function (dot) {
        dot.addEventListener("click", function () {
          goTo(Number(dot.getAttribute("data-index")), true);
        });
      });
    }

    function apply() {
      paintDots();
      try {
        onChange(index);
      } catch (err) {
        // A failing renderer must not take the carousel's timer down with it.
        if (global.console && global.console.error) global.console.error("carousel onChange failed", err);
      }
    }

    function goTo(i, manual) {
      if (destroyed || count <= 0) return;
      index = clampIndex(i);
      apply();
      if (manual) restart();
    }

    function next(manual) { goTo(index + 1, manual); }
    function prev(manual) { goTo(index - 1, manual); }

    function shouldRun() {
      return !destroyed && !reduced && interval > 0 && count > 1 &&
        !hovering && !focused && !(global.document && global.document.hidden);
    }

    function stop() {
      if (timer) { global.clearInterval(timer); timer = null; }
    }

    function restart() {
      stop();
      if (shouldRun()) timer = global.setInterval(function () { next(false); }, interval);
    }

    // ---- gestures -----------------------------------------------------------
    var startX = 0, startY = 0, axis = null, tracking = false;

    function pointerStart(x, y) { startX = x; startY = y; axis = null; tracking = true; }

    // Returns true once the gesture is confirmed horizontal, so the caller can
    // prevent the page from scrolling — but only then. Deciding an axis before
    // suppressing anything is what keeps vertical page scrolling working while
    // a finger passes over the carousel.
    function pointerMove(x, y) {
      if (!tracking) return false;
      var dx = x - startX, dy = y - startY;
      if (!axis && (Math.abs(dx) > AXIS_LOCK || Math.abs(dy) > AXIS_LOCK)) {
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      return axis === "x";
    }

    function pointerEnd(x) {
      if (!tracking) return;
      tracking = false;
      if (axis !== "x") return;
      var dx = x - startX;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;
      if (dx < 0) next(true); else prev(true);
    }

    var listeners = [];
    function on(target, type, fn, options) {
      if (!target) return;
      target.addEventListener(type, fn, options);
      listeners.push([target, type, fn, options]);
    }

    if (viewport) {
      on(viewport, "touchstart", function (e) {
        if (!e.touches || !e.touches.length) return;
        pointerStart(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      on(viewport, "touchmove", function (e) {
        if (!e.touches || !e.touches.length) return;
        if (pointerMove(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
      }, { passive: false });

      on(viewport, "touchend", function (e) {
        var t = (e.changedTouches && e.changedTouches[0]) || null;
        pointerEnd(t ? t.clientX : startX);
      }, { passive: true });

      // Mouse drag, so the same gesture works on a laptop.
      on(viewport, "mousedown", function (e) {
        if (e.button !== 0) return;
        pointerStart(e.clientX, e.clientY);
      });
      on(viewport, "mousemove", function (e) {
        if (pointerMove(e.clientX, e.clientY)) e.preventDefault();
      });
      on(viewport, "mouseup", function (e) { pointerEnd(e.clientX); });
      on(viewport, "mouseleave", function () { tracking = false; });

      // Dragging an image is the browser default and fights the swipe.
      on(viewport, "dragstart", function (e) { e.preventDefault(); });

      on(viewport, "keydown", function (e) {
        if (e.key === "ArrowRight") { next(true); e.preventDefault(); }
        else if (e.key === "ArrowLeft") { prev(true); e.preventDefault(); }
      });

      on(viewport, "mouseenter", function () { hovering = true; restart(); });
      on(viewport, "mouseleave", function () { hovering = false; restart(); });
      on(viewport, "focusin", function () { focused = true; restart(); });
      on(viewport, "focusout", function () { focused = false; restart(); });

      viewport.setAttribute("aria-roledescription", "carousel");
    }

    on(global.document, "visibilitychange", function () { restart(); });

    // Respect a mid-session change to the reduced-motion preference.
    try {
      var mq = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq && mq.addEventListener) {
        mq.addEventListener("change", function (e) { reduced = e.matches; restart(); });
      }
    } catch (_) { /* older browser — the initial read still applies */ }

    apply();
    restart();

    return {
      next: function () { next(true); },
      prev: function () { prev(true); },
      goTo: function (i) { goTo(i, true); },
      index: function () { return index; },
      count: function () { return count; },
      setCount: function (n) {
        count = n || 0;
        index = clampIndex(index);
        apply();
        restart();
      },
      pause: stop,
      resume: restart,
      destroy: function () {
        destroyed = true;
        stop();
        listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
        listeners = [];
      }
    };
  }

  global.LJMCarousel = { create: create };
})(window);
