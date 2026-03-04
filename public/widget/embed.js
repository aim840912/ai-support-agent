(function () {
  "use strict";

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var apiKey = script.getAttribute("data-api-key");
  if (!apiKey) {
    console.warn("[ai-support-agent] Missing data-api-key attribute on embed script.");
    return;
  }

  // Detect base URL from script src
  var src = script.src || "";
  var baseUrl = src.replace(/\/widget\/embed\.js.*$/, "") || window.location.origin;

  // ── Styles ──────────────────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    "#asa-bubble{position:fixed;bottom:24px;right:24px;z-index:9999;width:52px;height:52px;border-radius:50%;background:#18181b;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.25);transition:transform .2s;}",
    "#asa-bubble:hover{transform:scale(1.08);}",
    "#asa-bubble svg{width:24px;height:24px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}",
    "#asa-container{position:fixed;bottom:88px;right:24px;z-index:9998;width:360px;height:560px;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.18);transform:scale(0.95) translateY(8px);opacity:0;pointer-events:none;transition:transform .2s,opacity .2s;}",
    "#asa-container.asa-open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}",
    "#asa-iframe{width:100%;height:100%;border:none;display:block;}",
    "@media(max-width:400px){#asa-container{width:calc(100vw - 32px);right:16px;bottom:80px;height:70vh;}}",
  ].join("");
  document.head.appendChild(style);

  // ── Bubble button ────────────────────────────────────────────────────────────
  var bubble = document.createElement("button");
  bubble.id = "asa-bubble";
  bubble.setAttribute("aria-label", "Open support chat");
  bubble.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
    "</svg>";

  // ── iframe container ─────────────────────────────────────────────────────────
  var container = document.createElement("div");
  container.id = "asa-container";
  container.setAttribute("aria-live", "polite");

  var iframe = document.createElement("iframe");
  iframe.id = "asa-iframe";
  iframe.title = "Support chat";
  iframe.setAttribute("loading", "lazy");
  container.appendChild(iframe);

  document.body.appendChild(container);
  document.body.appendChild(bubble);

  // ── Toggle logic ─────────────────────────────────────────────────────────────
  var isOpen = false;
  var loaded = false;

  function open() {
    if (!loaded) {
      iframe.src = baseUrl + "/widget/" + apiKey;
      loaded = true;
    }
    container.classList.add("asa-open");
    bubble.setAttribute("aria-expanded", "true");
    bubble.setAttribute("aria-label", "Close support chat");
    bubble.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<line x1="18" y1="6" x2="6" y2="18"/>' +
      '<line x1="6" y1="6" x2="18" y2="18"/>' +
      "</svg>";
    isOpen = true;
  }

  function close() {
    container.classList.remove("asa-open");
    bubble.setAttribute("aria-expanded", "false");
    bubble.setAttribute("aria-label", "Open support chat");
    bubble.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
      "</svg>";
    isOpen = false;
  }

  bubble.addEventListener("click", function () {
    if (isOpen) close();
    else open();
  });

  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) close();
  });
})();
