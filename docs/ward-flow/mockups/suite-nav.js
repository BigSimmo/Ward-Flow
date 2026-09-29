/**
 * ═══════════════════════════════════════════════════════════════════════
 * WARD FLOW STATISTICS SUITE MASTER CONTROLLER (suite-nav.js)
 * Coordinates cross-mockup navigation, theme persistence, and keyboard shortcuts
 * ═══════════════════════════════════════════════════════════════════════
 */

(function () {
  // 1. Theme sync on script evaluation
  function initTheme() {
    var savedTheme = null;
    try {
      savedTheme = localStorage.getItem("ward-flow-statistics-appearance") || localStorage.getItem("ward-flow-theme");
    } catch (e) {}

    if (savedTheme === "light" || savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
    updateThemeBtn();
  }

  window.toggleGlobalSuiteTheme = function () {
    var root = document.documentElement;
    var current = root.getAttribute("data-theme");
    if (!current) {
      current = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    var next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);

    try {
      localStorage.setItem("ward-flow-statistics-appearance", next);
      localStorage.setItem("ward-flow-statistics-ed-appearance", next);
      localStorage.setItem("ward-flow-theme", next);
    } catch (e) {}

    updateThemeBtn();

    // Notify any listening iframe or parent
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        window.parent.document.documentElement.setAttribute("data-theme", next);
      }
    } catch (e) {}
  };

  function updateThemeBtn() {
    var root = document.documentElement;
    var current = root.getAttribute("data-theme");
    var isDark =
      current === "dark" ||
      (!current && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

    var icon = document.getElementById("suiteThemeIcon");
    var text = document.getElementById("suiteThemeText");
    if (icon) icon.textContent = isDark ? "☀️" : "🌙";
    if (text) text.textContent = isDark ? "Light" : "Dark";

    var legacyBtn = document.getElementById("themeBtn");
    if (legacyBtn) {
      legacyBtn.innerHTML = isDark ? "<span>☀️</span> <span>Light</span>" : "<span>🌙</span> <span>Dark</span>";
    }
  }

  // 2. Active Tab Detection
  function highlightCurrentPill() {
    var path = window.location.pathname;
    var page = path.split("/").pop();
    if (!page) page = "statistics-third-edition.html";

    var pills = document.querySelectorAll(".suiteNavPill");
    pills.forEach(function (pill) {
      var href = pill.getAttribute("href");
      if (href && (href === page || page.indexOf(href.replace(".html", "")) === 0)) {
        pill.classList.add("active");
        pill.setAttribute("aria-current", "page");
      }
    });
  }

  // 3. Quick Hotkeys (Alt+1 through Alt+7)
  document.addEventListener("keydown", function (e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= "1" && e.key <= "7") {
      var idx = parseInt(e.key, 10) - 1;
      var pills = document.querySelectorAll(".suiteNavPill");
      if (pills[idx]) {
        e.preventDefault();
        window.location.href = pills[idx].getAttribute("href");
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initTheme();
      highlightCurrentPill();
    });
  } else {
    initTheme();
    highlightCurrentPill();
  }
})();
