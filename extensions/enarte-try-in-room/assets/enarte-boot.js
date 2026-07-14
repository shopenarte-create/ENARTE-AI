/**
 * Tiny storefront boot — loads full ENARTE assets only when Try Now is present.
 * Keeps homepage/collection pages free of the heavy try script/CSS.
 */
(function () {
  if (window.__enarteBooted) return;
  window.__enarteBooted = true;

  // Optional post-unlock redirect (set by /dev/mobile-test flow).
  try {
    var next = sessionStorage.getItem("enarte_sf_next");
    if (next && next.charAt(0) === "/") {
      sessionStorage.removeItem("enarte_sf_next");
      if (location.pathname + location.search !== next) {
        location.replace(next);
        return;
      }
    }
  } catch (e) {}

  function assetBase() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (src.indexOf("enarte-boot") !== -1) {
        return src.replace(/enarte-boot[^/]*$/, "");
      }
    }
    return "";
  }

  function loadWhenNeeded() {
    if (window.Shopify && window.Shopify.designMode) return;
    if (!document.querySelector("[data-enarte-try-root]")) return;

    var base = assetBase();
    if (!base) return;

    if (!document.querySelector('link[data-enarte-css]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = base + "enarte-try.css";
      link.setAttribute("data-enarte-css", "1");
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-enarte-main]')) {
      var script = document.createElement("script");
      script.src = base + "enarte-try.js";
      script.defer = true;
      script.setAttribute("data-enarte-main", "1");
      document.head.appendChild(script);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadWhenNeeded, { once: true });
  } else {
    loadWhenNeeded();
  }

  document.addEventListener("shopify:section:load", loadWhenNeeded);
})();
