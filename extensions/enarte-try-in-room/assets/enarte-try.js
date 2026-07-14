(function () {
  // Dev override only. Storefront traffic must use the Shopify app proxy.
  var FORCED_APP_URL = "";

  var DEAD_TUNNEL_HOSTS = [
    "sophisticated-frequent-employer-ratings.trycloudflare.com",
    "saints-between-manufacturers-venice.trycloudflare.com",
    "athletes-ali-douglas-eligible.trycloudflare.com",
    "linux-harvey-mixture-ranked.trycloudflare.com",
    "referenced-complete-breaks-gadgets.trycloudflare.com",
    "promotion-indicate-breaking-recorders.trycloudflare.com",
    "mounting-alberta-cst-proof.trycloudflare.com",
    "easter-use-imperial-pencil.trycloudflare.com",
    "hospital-writes-diverse-fever.trycloudflare.com",
    "camping-ebooks-oxide-enforcement.trycloudflare.com",
    "tags-fame-roman-hispanic.trycloudflare.com",
    "hearts-org-combinations-players.trycloudflare.com",
    "klein-pushed-jewelry-evanescence.trycloudflare.com",
  ];

  function isDeadTunnel(url) {
    var value = String(url || "");
    for (var i = 0; i < DEAD_TUNNEL_HOSTS.length; i++) {
      if (value.indexOf(DEAD_TUNNEL_HOSTS[i]) !== -1) return true;
    }
    return false;
  }

  function shopifyProxyBase() {
    // Same-origin app proxy — reachable from every phone that can open the shop.
    return window.location.origin.replace(/\/$/, "") + "/apps/enarte-ai";
  }

  function onShopifyStorefront() {
    if (window.Shopify && (window.Shopify.shop || window.Shopify.cdnHost)) {
      return true;
    }
    return /\.myshopify\.com$/i.test(window.location.hostname);
  }

  function resolveAppBase(root, options) {
    options = options || {};

    // Storefront: always same-origin app proxy (API + /try navigation).
    // Avoids expired Cloudflare tunnels in theme settings or dev overrides.
    if (onShopifyStorefront()) {
      return shopifyProxyBase();
    }

    var base = ((root && root.getAttribute("data-app-url")) || "").replace(
      /\/$/,
      "",
    );
    if (base && !isDeadTunnel(base)) {
      return base;
    }

    if (FORCED_APP_URL && !isDeadTunnel(FORCED_APP_URL)) {
      return FORCED_APP_URL.replace(/\/$/, "");
    }

    return shopifyProxyBase();
  }

  function absoluteProductImage(raw) {
    var value = (raw || "").trim();
    if (!value) return "";
    if (value.indexOf("//") === 0) return "https:" + value;
    return value;
  }

  function isHomeEntry(root) {
    var entry = (root.getAttribute("data-enarte-entry") || "product").toLowerCase();
    return entry === "home" || entry === "main" || entry === "recommend";
  }

  function getRootFlow(root) {
    return String(root.getAttribute("data-enarte-flow") || "").toLowerCase();
  }

  /** Homepage assistant CTA opens chat — never the room placement flow. */
  function isAssistantHomeEntry(root) {
    if (!isHomeEntry(root)) return false;
    var flow = getRootFlow(root);
    if (flow === "try" || flow === "room-try" || flow === "image-search") {
      return false;
    }
    // Default homepage root is assistant chat.
    return flow === "assistant" || flow === "";
  }

  /** Homepage room card / explicit try flow — photo → /try until placement. */
  function isRoomTryEntry(root) {
    var flow = getRootFlow(root);
    if (flow === "try" || flow === "room-try") return true;
    return false;
  }

  /**
   * Home / “ENARTE AI Assistant” entry → chat UI.
   * Camera must NEVER open on this path (only after Recommend Lighting inside chat).
   */
  function buildAssistantUrl(root, actionOverride) {
    var url = new URL(
      resolveAppBase(root, { forNavigation: true }) + "/assistant",
    );
    var shop = root.getAttribute("data-shop") || "";
    if (shop) url.searchParams.set("shop", shop);
    url.searchParams.set("locale", "ar");
    url.searchParams.set("entry", "assistant");
    var action =
      actionOverride ||
      root.getAttribute("data-assistant-action") ||
      "";
    if (action) {
      url.searchParams.set("action", action);
      if (action === "talk_to_assistant") {
        url.searchParams.set("continue", "1");
      }
    }
    return url.toString();
  }

  function openAssistantChat(root, actionOverride) {
    window.location.assign(buildAssistantUrl(root, actionOverride));
  }

  function buildTryUrl(root, handoffId) {
    var url = new URL(resolveAppBase(root, { forNavigation: true }) + "/try");
    url.searchParams.set("shop", root.getAttribute("data-shop") || "");
    if (handoffId) {
      url.searchParams.set("handoff", handoffId);
    }
    if (isHomeEntry(root)) {
      url.searchParams.set("entry", "home");
      return url.toString();
    }
    url.searchParams.set("entry", "product");
    url.searchParams.set("productId", root.getAttribute("data-product-id") || "");
    url.searchParams.set("title", root.getAttribute("data-product-title") || "");
    url.searchParams.set(
      "image",
      absoluteProductImage(root.getAttribute("data-product-image") || ""),
    );
    url.searchParams.set("price", root.getAttribute("data-product-price") || "");
    url.searchParams.set("currency", root.getAttribute("data-product-currency") || "JOD");
    url.searchParams.set("url", root.getAttribute("data-product-url") || "");
    url.searchParams.set("collection", root.getAttribute("data-product-collection") || "");
    return url.toString();
  }

  function shouldUseMobileChooser() {
    var ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua)) {
      return true;
    }
    if (navigator.userAgentData && navigator.userAgentData.mobile) {
      return true;
    }
    var coarse =
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var noHover =
      window.matchMedia && window.matchMedia("(hover: none)").matches;
    var narrow =
      window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    return Boolean(coarse || (noHover && narrow));
  }

  function yieldToMain() {
    return new Promise(function (resolve) {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(function () {
          resolve();
        }, { timeout: 60 });
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  function compressToBlob(file, maxEdge, quality) {
    var edge = maxEdge || (shouldUseMobileChooser() ? 1024 : 1280);
    var q = quality || (shouldUseMobileChooser() ? 0.72 : 0.8);

    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file)
        .then(function (bitmap) {
          var scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
          var width = Math.max(1, Math.round(bitmap.width * scale));
          var height = Math.max(1, Math.round(bitmap.height * scale));
          var canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext("2d", { alpha: false });
          ctx.drawImage(bitmap, 0, 0, width, height);
          if (bitmap.close) bitmap.close();
          return new Promise(function (resolve, reject) {
            canvas.toBlob(
              function (blob) {
                if (!blob) reject(new Error("compress failed"));
                else resolve(blob);
              },
              "image/jpeg",
              q,
            );
          });
        })
        .catch(function () {
          return compressToBlobLegacy(file, edge, q);
        });
    }
    return compressToBlobLegacy(file, edge, q);
  }

  function compressToBlobLegacy(file, maxEdge, quality) {
    return new Promise(function (resolve, reject) {
      var objectUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("image load failed"));
      };
      img.onload = function () {
        var scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        var width = Math.max(1, Math.round(img.width * scale));
        var height = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob(
          function (blob) {
            if (!blob) {
              reject(new Error("compress failed"));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          quality,
        );
      };
      img.src = objectUrl;
    });
  }

  function showTransitOverlay(message, detail) {
    var existing = document.querySelector("[data-enarte-transit]");
    if (existing) {
      existing.querySelector("[data-enarte-transit-msg]").textContent = message;
      var d = existing.querySelector("[data-enarte-transit-detail]");
      if (d) d.textContent = detail || "لا تغلق الصفحة — جاري فتح ENARTE AI";
      return existing;
    }
    var el = document.createElement("div");
    el.setAttribute("data-enarte-transit", "");
    el.style.cssText =
      "position:fixed;inset:0;z-index:100000;background:rgba(238,243,248,0.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;direction:rtl;font-family:sans-serif;";
    el.innerHTML =
      '<div style="width:36px;height:36px;border-radius:50%;border:3px solid #c5ced9;border-top-color:#9a7b3c;animation:enarteSpin .8s linear infinite"></div>' +
      '<p data-enarte-transit-msg style="margin:0;font-size:16px;font-weight:600;color:#1c2430"></p>' +
      '<p data-enarte-transit-detail style="margin:0;font-size:13px;color:#6b7280;max-width:20rem;text-align:center"></p>' +
      "<style>@keyframes enarteSpin{to{transform:rotate(360deg)}}</style>";
    el.querySelector("[data-enarte-transit-msg]").textContent = message;
    el.querySelector("[data-enarte-transit-detail]").textContent =
      detail || "لا تغلق الصفحة — جاري فتح ENARTE AI";
    document.body.appendChild(el);
    return el;
  }

  function hideTransitOverlay() {
    var overlay = document.querySelector("[data-enarte-transit]");
    if (overlay) overlay.remove();
  }

  function humanizePrepError(error, fallback) {
    var msg = (error && (error.userMessage || error.message)) || "";
    msg = String(msg || "").trim();
    if (!msg) return fallback || "تعذر التحضير — حاول مجدداً";
    if (/failed to fetch|networkerror|load failed|network/i.test(msg)) {
      return "فشل الاتصال بالخادم — تحقق من الإنترنت وأعد المحاولة.";
    }
    if (/compress|image load/i.test(msg)) {
      return "تعذر تجهيز الصورة — جرّب صورة أوضح أو كاميرا الجهاز.";
    }
    if (/handoff failed/i.test(msg)) {
      return "تعذر حفظ صورة الغرفة — أعد المحاولة.";
    }
    return msg;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function postHandoffWithRetry(appBase, formData, attempts) {
    var max = attempts || 3;
    var attempt = 0;
    function once() {
      attempt += 1;
      showTransitOverlay(
        attempt === 1
          ? "جاري رفع الصورة..."
          : "إعادة المحاولة (" + attempt + "/" + max + ")...",
        attempt === 1
          ? "نجهّز غرفتك لتجربة ENARTE AI"
          : "الاتصال كان بطيئاً — نعيد المحاولة تلقائياً",
      );
      return fetch(appBase + "/api/try-handoff", {
        method: "POST",
        body: formData,
        keepalive: true,
      })
        .then(function (response) {
          return response.text().then(function (text) {
            var data = null;
            try {
              data = text ? JSON.parse(text) : null;
            } catch (e) {
              data = null;
            }
            if (!response.ok) {
              var err = new Error(
                (data && data.error) ||
                  "تعذر حفظ صورة الغرفة (" + response.status + ").",
              );
              err.status = response.status;
              err.code = data && data.code;
              err.userMessage = data && data.error;
              err.retryable =
                response.status >= 500 ||
                response.status === 429 ||
                response.status === 0;
              throw err;
            }
            if (!data || !data.success || !data.handoffId) {
              var err2 = new Error(
                (data && data.error) || "تعذر حفظ صورة الغرفة.",
              );
              err2.userMessage = data && data.error;
              err2.retryable = true;
              throw err2;
            }
            return data;
          });
        })
        .catch(function (error) {
          var retryable =
            error.retryable ||
            /failed to fetch|networkerror|load failed|network/i.test(
              String(error && error.message),
            );
          console.error("[enarte] handoff attempt failed", {
            attempt: attempt,
            message: error && error.message,
            code: error && error.code,
            status: error && error.status,
          });
          if (retryable && attempt < max) {
            return sleep(450 * attempt).then(once);
          }
          throw error;
        });
    }
    return once();
  }

  function warmApp(appBase) {
    if (!appBase || window.__enarteWarmed === appBase) return;
    window.__enarteWarmed = appBase;
    try {
      var link = document.createElement("link");
      link.rel = "preconnect";
      link.href = appBase;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
      var dns = document.createElement("link");
      dns.rel = "dns-prefetch";
      dns.href = appBase;
      document.head.appendChild(dns);
    } catch (e) {}
    // Warm tunnel + app shell without blocking UI.
    if (navigator.sendBeacon) {
      try {
        navigator.sendBeacon(appBase + "/api/try-handoff?id=ping");
      } catch (e2) {}
    } else {
      fetch(appBase + "/api/try-handoff?id=ping", {
        mode: "cors",
        cache: "no-store",
        keepalive: true,
      }).catch(function () {});
    }
  }

  function prefetchNextStep(root) {
    var appBase = resolveAppBase(root);
    warmApp(appBase);
    try {
      if (!document.querySelector('link[data-enarte-prefetch="try"]')) {
        var tryUrl = buildTryUrl(root, null);
        var link = document.createElement("link");
        link.rel = "prefetch";
        link.href = tryUrl;
        link.setAttribute("data-enarte-prefetch", "try");
        document.head.appendChild(link);
      }
      var imgUrl = absoluteProductImage(root.getAttribute("data-product-image") || "");
      if (imgUrl && !document.querySelector('link[data-enarte-prefetch="product-img"]')) {
        var imgLink = document.createElement("link");
        imgLink.rel = "prefetch";
        imgLink.href = imgUrl;
        imgLink.setAttribute("data-enarte-prefetch", "product-img");
        document.head.appendChild(imgLink);
      }
    } catch (e) {
      console.warn("enarte prefetch skipped", e);
    }
  }

  function startKeepAlive(appBase) {
    if (!appBase || window.__enarteKeepAlive) return;
    window.__enarteKeepAlive = setInterval(function () {
      if (document.visibilityState === "hidden") return;
      fetch(appBase + "/api/try-handoff?id=ping", {
        mode: "cors",
        cache: "no-store",
        keepalive: true,
      }).catch(function () {});
    }, 90000);
  }

  function makeFileInput(attrs) {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.className = "enarte-try-file-input";
    input.setAttribute("tabindex", "-1");
    input.setAttribute("aria-hidden", "true");
    Object.keys(attrs || {}).forEach(function (key) {
      if (attrs[key] === null) {
        input.removeAttribute(key);
      } else {
        input.setAttribute(key, attrs[key]);
      }
    });
    return input;
  }

  function isIOSDevice() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  }

  function isAndroidDevice() {
    return /Android/i.test(navigator.userAgent || "");
  }

  function ensureFileInputs(root) {
    root
      .querySelectorAll(
        "[data-enarte-try-camera], [data-enarte-try-gallery], [data-enarte-try-input]",
      )
      .forEach(function (node) {
        node.remove();
      });

    // Gallery picker — never use capture (would confuse Android into chooser).
    var gallery = makeFileInput({
      "data-enarte-try-gallery": "",
      "data-enarte-try-input": "",
    });
    gallery.setAttribute("accept", "image/*");
    gallery.removeAttribute("capture");

    // iOS-only native camera fallback. Never used on Android (opens gallery).
    var camera = makeFileInput({
      "data-enarte-try-camera": "",
    });
    camera.setAttribute("accept", "image/*");
    camera.setAttribute("capture", "environment");
    try {
      camera.capture = "environment";
    } catch (e) {}

    root.appendChild(camera);
    root.appendChild(gallery);
    return { gallery: gallery, camera: camera };
  }

  function showCameraBlocked(message, onRetry) {
    var existing = document.querySelector("[data-enarte-live-camera]");
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.className = "enarte-try-camera enarte-try-camera--blocked";
    overlay.setAttribute("data-enarte-live-camera", "");
    overlay.innerHTML =
      '<div class="enarte-try-camera-frame enarte-try-camera-blocked">' +
      '<p class="enarte-try-camera-blocked-title">تعذر فتح الكاميرا</p>' +
      '<p class="enarte-try-camera-blocked-msg" data-enarte-cam-blocked-msg></p>' +
      '<div class="enarte-try-camera-blocked-actions">' +
      '<button type="button" class="enarte-try-chooser-option" data-enarte-cam-retry>إعادة المحاولة</button>' +
      '<button type="button" class="enarte-try-chooser-cancel" data-enarte-cam-close>إغلاق</button>' +
      "</div></div>";

    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";
    var msgEl = overlay.querySelector("[data-enarte-cam-blocked-msg]");
    if (msgEl) {
      msgEl.textContent =
        message ||
        "اسمح بالوصول إلى الكاميرا من إعدادات المتصفح، ثم أعد المحاولة.";
    }

    function cleanup() {
      overlay.remove();
      document.documentElement.style.overflow = "";
    }

    overlay
      .querySelector("[data-enarte-cam-close]")
      .addEventListener("click", function (event) {
        event.preventDefault();
        cleanup();
      });
    overlay
      .querySelector("[data-enarte-cam-retry]")
      .addEventListener("click", function (event) {
        event.preventDefault();
        cleanup();
        if (typeof onRetry === "function") onRetry(event);
      });
  }

  /**
   * Kick getUserMedia in the same user-gesture tick (critical for Android/iOS).
   */
  function beginCameraStream() {
    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      return null;
    }
    var gum = function (constraints) {
      return navigator.mediaDevices.getUserMedia(constraints);
    };
    // Soft rear-camera first — exact facingMode often rejects and can burn the gesture.
    return gum({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
      .catch(function () {
        return gum({ audio: false, video: { facingMode: "environment" } });
      })
      .catch(function () {
        return gum({ audio: false, video: true });
      });
  }

  /**
   * Real device camera via getUserMedia.
   * Never falls back to <input capture> on Android (that opens the gallery).
   */
  function openLiveCamera(options) {
    options = options || {};
    var onCapture = options.onCapture;
    var onUnavailable = options.onUnavailable;
    var earlyPromise = options.earlyPromise || null;
    var preferFacing = options.facing || "environment";

    var existing = document.querySelector("[data-enarte-live-camera]");
    if (existing) existing.remove();

    var overlay = document.createElement("div");
    overlay.className = "enarte-try-camera";
    overlay.setAttribute("data-enarte-live-camera", "");
    overlay.innerHTML =
      '<div class="enarte-try-camera-frame">' +
      '<video class="enarte-try-camera-video" playsinline webkit-playsinline autoplay muted></video>' +
      '<p class="enarte-try-camera-hint" data-enarte-cam-hint>جاري فتح الكاميرا…</p>' +
      '<div class="enarte-try-camera-actions">' +
      '<button type="button" class="enarte-try-camera-close" data-enarte-cam-close>إغلاق</button>' +
      '<button type="button" class="enarte-try-camera-shutter" data-enarte-cam-shutter aria-label="Take Photo" disabled>📷</button>' +
      '<button type="button" class="enarte-try-camera-flip" data-enarte-cam-flip>عكس</button>' +
      "</div></div>";

    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";

    var video = overlay.querySelector("video");
    var hint = overlay.querySelector("[data-enarte-cam-hint]");
    var shutter = overlay.querySelector("[data-enarte-cam-shutter]");
    var stream = null;
    var facing = preferFacing;
    var starting = false;
    var ready = false;
    var failed = false;

    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("muted", "");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    function stopStream() {
      if (stream) {
        stream.getTracks().forEach(function (t) {
          try {
            t.stop();
          } catch (e) {}
        });
        stream = null;
      }
      try {
        video.srcObject = null;
      } catch (e2) {}
      ready = false;
      if (shutter) shutter.disabled = true;
    }

    function cleanup() {
      stopStream();
      overlay.remove();
      document.documentElement.style.overflow = "";
    }

    function setHint(text) {
      if (hint) hint.textContent = text;
    }

    function markReady() {
      ready = true;
      if (shutter) shutter.disabled = false;
      setHint("وجّه الكاميرا نحو السقف / الغرفة ثم اضغط 📷");
    }

    function failUnavailable(err) {
      if (failed) return;
      failed = true;
      cleanup();
      var name = (err && err.name) || "";
      var msg =
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "تم رفض إذن الكاميرا. اسمح بالكاميرا لهذا الموقع من إعدادات المتصفح ثم أعد المحاولة."
          : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? "لم يتم العثور على كاميرا على هذا الجهاز."
            : "تعذر تشغيل الكاميرا الحية. افتح الصفحة في Chrome أو Safari (ليس داخل تطبيق التواصل) ثم أعد المحاولة.";
      if (typeof onUnavailable === "function") {
        onUnavailable({ error: err, message: msg });
      } else {
        showCameraBlocked(msg);
      }
    }

    function attachStream(mediaStream) {
      starting = false;
      stream = mediaStream;
      video.srcObject = mediaStream;
      var playPromise = video.play();
      if (playPromise && playPromise.then) {
        playPromise
          .then(function () {
            if (video.videoWidth) markReady();
            else {
              video.onloadedmetadata = function () {
                markReady();
              };
            }
          })
          .catch(function () {
            video.onloadedmetadata = function () {
              markReady();
            };
            setTimeout(function () {
              if (video.videoWidth) markReady();
            }, 400);
          });
      } else {
        video.onloadedmetadata = function () {
          markReady();
        };
      }
    }

    function startCamera(reusePromise) {
      if (starting) return;
      starting = true;
      ready = false;
      if (shutter) shutter.disabled = true;
      setHint("جاري فتح الكاميرا…");
      if (!reusePromise) stopStream();

      var promise = reusePromise;
      if (!promise) {
        var gum = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
        if (!gum) {
          starting = false;
          failUnavailable(new Error("getUserMedia unavailable"));
          return;
        }
        promise = navigator.mediaDevices
          .getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          })
          .catch(function () {
            return navigator.mediaDevices.getUserMedia({
              audio: false,
              video: true,
            });
          });
      }

      promise
        .then(attachStream)
        .catch(function (err) {
          starting = false;
          console.warn("enarte camera failed", err && err.name, err);
          failUnavailable(err);
        });
    }

    overlay
      .querySelector("[data-enarte-cam-close]")
      .addEventListener("click", function (event) {
        event.preventDefault();
        cleanup();
      });

    overlay
      .querySelector("[data-enarte-cam-flip]")
      .addEventListener("click", function (event) {
        event.preventDefault();
        facing = facing === "environment" ? "user" : "environment";
        startCamera(null);
      });

    shutter.addEventListener("click", function (event) {
      event.preventDefault();
      if (!ready || !video.videoWidth) return;

      shutter.disabled = true;
      setHint("جاري التقاط الصورة…");

      var maxEdge = 1280;
      var vw = video.videoWidth;
      var vh = video.videoHeight;
      var scale = Math.min(1, maxEdge / Math.max(vw, vh));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(vw * scale));
      canvas.height = Math.max(1, Math.round(vh * scale));
      var ctx = canvas.getContext("2d", { alpha: false });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        function (blob) {
          cleanup();
          if (!blob) {
            failUnavailable(new Error("capture blob empty"));
            return;
          }
          onCapture(blob);
        },
        "image/jpeg",
        0.82,
      );
    });

    startCamera(earlyPromise);
  }

  function ensureSheet() {
    var backdrop = document.querySelector("[data-enarte-try-sheet-backdrop]");
    var sheet = document.querySelector("[data-enarte-try-sheet]");
    // Rebuild if an older sheet markup is still in the DOM (missing native file label).
    if (
      backdrop &&
      sheet &&
      sheet.querySelector("[data-enarte-sheet-gallery]")
    ) {
      return { backdrop: backdrop, sheet: sheet };
    }
    if (backdrop) backdrop.remove();
    if (sheet) sheet.remove();

    backdrop = document.createElement("div");
    backdrop.className = "enarte-try-sheet-backdrop";
    backdrop.setAttribute("data-enarte-try-sheet-backdrop", "");

    sheet = document.createElement("div");
    sheet.className = "enarte-try-sheet";
    sheet.setAttribute("data-enarte-try-sheet", "");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.innerHTML =
      '<div class="enarte-try-sheet-handle"></div>' +
      '<p class="enarte-try-sheet-title">اختر مصدر صورة الغرفة</p>' +
      '<p class="enarte-try-sheet-tip">يرجى التقاط صورة للغرفة بالكامل، وليس منطقة الثريا فقط، للحصول على أفضل نتائج التركيب.</p>' +
      '<button type="button" class="enarte-try-chooser-option" data-enarte-camera>📷 Take Photo</button>' +
      '<label class="enarte-try-chooser-option enarte-try-chooser-file" data-enarte-gallery>' +
      '<input type="file" accept="image/*" data-enarte-sheet-gallery />' +
      "🖼️ Choose from Gallery</label>" +
      '<button type="button" class="enarte-try-chooser-cancel" data-enarte-chooser-cancel>إلغاء</button>';

    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    return { backdrop: backdrop, sheet: sheet };
  }

  function openSheet(ui) {
    ui.backdrop.classList.add("is-open");
    ui.sheet.classList.add("is-open");
    document.documentElement.style.overflow = "hidden";
  }

  function closeSheet(ui) {
    ui.backdrop.classList.remove("is-open");
    ui.sheet.classList.remove("is-open");
    document.documentElement.style.overflow = "";
  }

  function findBuyAnchor() {
    // Prefer permanent buy-buttons block; never sticky cart bar.
    var buyBlock = document.querySelector(
      ".buy-buttons-block:not(.sticky-add-to-cart *), .buy-buttons-block",
    );
    if (buyBlock && buyBlock.closest(".sticky-add-to-cart")) {
      buyBlock = null;
    }

    var payment =
      (buyBlock &&
        (buyBlock.querySelector(".accelerated-checkout-block") ||
          buyBlock.querySelector(".shopify-payment-button") ||
          buyBlock.querySelector("shopify-accelerated-checkout"))) ||
      document.querySelector(
        ".buy-buttons-block .accelerated-checkout-block, .buy-buttons-block .shopify-payment-button, .buy-buttons-block shopify-accelerated-checkout",
      );

    if (payment && payment.closest(".sticky-add-to-cart")) {
      payment = null;
    }

    var formButtons =
      (buyBlock && buyBlock.querySelector(".product-form-buttons")) ||
      document.querySelector(
        ".buy-buttons-block .product-form-buttons, form.shopify-product-form .product-form-buttons",
      );

    if (formButtons && formButtons.closest(".sticky-add-to-cart")) {
      formButtons = null;
    }

    return { buyBlock: buyBlock, payment: payment, formButtons: formButtons };
  }

  function placeNearBuyButtons(root) {
    var anchor = findBuyAnchor();
    if (!anchor.buyBlock && !anchor.formButtons && !anchor.payment) {
      return false;
    }

    root.classList.add("enarte-try-wrap--at-buy");
    root.classList.remove("enarte-try-embed");
    root.style.position = "static";
    root.style.bottom = "auto";
    root.style.left = "auto";
    root.style.right = "auto";

    if (anchor.payment && anchor.payment.parentNode) {
      anchor.payment.parentNode.insertBefore(root, anchor.payment);
      return true;
    }

    if (anchor.formButtons && anchor.formButtons.parentNode) {
      anchor.formButtons.parentNode.insertBefore(
        root,
        anchor.formButtons.nextSibling,
      );
      return true;
    }

    if (anchor.buyBlock) {
      anchor.buyBlock.appendChild(root);
      return true;
    }

    return false;
  }

  function ensurePlacement(root) {
    if (isHomeEntry(root)) {
      root.classList.add("enarte-try-wrap--home");
      // Section block stays in normal page flow (now first on homepage).
      // Body embed alone gets a sticky fallback so it cannot be missed.
      var inSection = Boolean(
        root.closest(".shopify-section") ||
          (root.closest(".shopify-block") &&
            !root.classList.contains("enarte-try-embed") &&
            root.id !== "enarte-home-try-embed"),
      );
      var isEmbed =
        root.classList.contains("enarte-try-embed") ||
        root.id === "enarte-home-try-embed";
      if (isEmbed && !inSection) {
        root.classList.add("enarte-try-wrap--home-sticky");
        root.style.setProperty("position", "fixed", "important");
        root.style.setProperty("left", "12px", "important");
        root.style.setProperty("right", "12px", "important");
        root.style.setProperty(
          "bottom",
          "calc(12px + env(safe-area-inset-bottom, 0px))",
          "important",
        );
        root.style.setProperty("z-index", "99990", "important");
      } else {
        root.classList.remove("enarte-try-wrap--home-sticky");
        root.style.removeProperty("position");
        root.style.removeProperty("left");
        root.style.removeProperty("right");
        root.style.removeProperty("bottom");
        root.style.removeProperty("top");
        root.style.removeProperty("z-index");
      }
      document.documentElement.classList.add("enarte-home-cta-active");
      return;
    }
    if (placeNearBuyButtons(root)) {
      return;
    }
    var tries = 0;
    function tick() {
      tries += 1;
      if (placeNearBuyButtons(root) || tries >= 20) {
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function pickPrimaryRoot(roots) {
    var list = Array.prototype.slice.call(roots).filter(function (node) {
      return !node.closest(".sticky-add-to-cart");
    });
    // Homepage: prefer the index SECTION (in-flow, top of page) over body embed.
    var homeSection = list.find(function (node) {
      return (
        isHomeEntry(node) &&
        !node.classList.contains("enarte-try-embed") &&
        node.id !== "enarte-home-try-embed"
      );
    });
    if (homeSection) return homeSection;
    var homeEmbed = list.find(function (node) {
      return isHomeEntry(node);
    });
    if (homeEmbed) return homeEmbed;
    var section = list.find(function (node) {
      return !node.classList.contains("enarte-try-embed");
    });
    return section || list[0] || roots[0];
  }

  function scrubStickyClones() {
    document
      .querySelectorAll(".sticky-add-to-cart [data-enarte-try-root], .sticky-add-to-cart .enarte-try-wrap")
      .forEach(function (node) {
        node.remove();
      });
  }

  function initRoot(root) {
    if (root.getAttribute("data-enarte-ready") === "1") {
      return;
    }
    root.setAttribute("data-enarte-ready", "1");

    var button = root.querySelector("[data-enarte-try-button]");
    if (!button) {
      return;
    }

    var inputs = ensureFileInputs(root);
    var ui = ensureSheet();
    var label = button.getAttribute("data-label") || button.textContent.trim();

    function resetButton() {
      button.disabled = false;
      button.textContent = label;
    }

    function openInput(input) {
      // Keep user-gesture sync: click first, then close sheet.
      try {
        input.value = "";
      } catch (e) {}
      // Temporarily ensure the control can receive a synthetic click on Android.
      var prevPointer = input.style.pointerEvents;
      var prevOpacity = input.style.opacity;
      input.style.pointerEvents = "auto";
      input.style.opacity = "0.01";
      input.style.position = "fixed";
      input.style.inset = "0";
      input.style.width = "100%";
      input.style.height = "100%";
      input.style.zIndex = "100000";
      try {
        input.click();
      } finally {
        setTimeout(function () {
          input.style.pointerEvents = prevPointer;
          input.style.opacity = prevOpacity;
          input.style.position = "";
          input.style.inset = "";
          input.style.width = "";
          input.style.height = "";
          input.style.zIndex = "";
        }, 800);
      }
      closeSheet(ui);
    }

    function blobToRoomFile(blob) {
      var file;
      try {
        file = new File([blob], "room-camera.jpg", {
          type: blob.type || "image/jpeg",
          lastModified: Date.now(),
        });
      } catch (err) {
        file = blob;
        try {
          file.name = "room-camera.jpg";
        } catch (e2) {}
      }
      return file;
    }

    function openCamera(event) {
      // CRITICAL: start getUserMedia in the same user-gesture tick,
      // BEFORE closing the sheet (closing can burn gesture on Android/iOS).
      var earlyPromise = beginCameraStream();

      closeSheet(ui);

      function retryFromBlocked(retryEvent) {
        openCamera(retryEvent);
      }

      function onUnavailable(info) {
        // Android: NEVER use <input capture> — it opens the gallery.
        // iOS: capture=environment reliably opens the system camera UI.
        if (isIOSDevice() && !isAndroidDevice()) {
          try {
            openInput(inputs.camera);
            return;
          } catch (e) {}
        }
        showCameraBlocked(
          (info && info.message) ||
            "تعذر فتح الكاميرا. افتح الموقع في Chrome أو Safari وأعد المحاولة.",
          retryFromBlocked,
        );
      }

      if (!earlyPromise) {
        onUnavailable({
          message:
            "هذا المتصفح لا يدعم الكاميرا الحية. افتح الصفحة في Chrome أو Safari ثم اضغط Take Photo.",
        });
        return;
      }

      openLiveCamera({
        earlyPromise: earlyPromise,
        onCapture: function (blob) {
          handleSelectedFile(blobToRoomFile(blob));
        },
        onUnavailable: onUnavailable,
      });
    }

    function handleSelectedFile(file) {
      if (!file) {
        return;
      }

      var appBase = resolveAppBase(root);
      if (!appBase) {
        button.textContent = "رابط تطبيق ENARTE غير مضبوط";
        setTimeout(resetButton, 2800);
        console.error("[enarte] missing app base url");
        return;
      }

      warmApp(appBase);
      showTransitOverlay("جاري تجهيز صورة الغرفة...", "ضغط وتحسين الصورة قبل الرفع");
      button.disabled = true;
      button.textContent = "جاري التحضير...";
      closeSheet(ui);

      yieldToMain()
        .then(function () {
          return compressToBlob(file).catch(function (error) {
            error.userMessage =
              "تعذر تجهيز الصورة — جرّب صورة أوضح أو من الكاميرا.";
            throw error;
          });
        })
        .then(function (blob) {
          var formData = new FormData();
          formData.append("roomImage", blob, "room.jpg");
          formData.append("entry", isHomeEntry(root) ? "home" : "product");
          if (!isHomeEntry(root)) {
            formData.append(
              "productId",
              root.getAttribute("data-product-id") || "",
            );
            formData.append(
              "title",
              root.getAttribute("data-product-title") || "",
            );
            formData.append(
              "image",
              absoluteProductImage(
                root.getAttribute("data-product-image") || "",
              ),
            );
            formData.append(
              "price",
              root.getAttribute("data-product-price") || "",
            );
            formData.append(
              "currency",
              root.getAttribute("data-product-currency") || "JOD",
            );
            formData.append("url", root.getAttribute("data-product-url") || "");
            formData.append(
              "collection",
              root.getAttribute("data-product-collection") || "",
            );
          }

          return postHandoffWithRetry(appBase, formData, 3);
        })
        .then(function (data) {
          showTransitOverlay(
            "جاري فتح ENARTE AI...",
            isHomeEntry(root)
              ? "التالي: تحليل الغرفة واقتراح أفضل 3 منتجات"
              : "التالي: تحديد مكان التركيب على السقف",
          );
          window.location.assign(buildTryUrl(root, data.handoffId));
        })
        .catch(function (error) {
          hideTransitOverlay();
          var message = humanizePrepError(error);
          resetButton();
          button.textContent = message;
          button.title = message;
          console.error("[enarte] preparation failed", {
            message: error && error.message,
            code: error && error.code,
            status: error && error.status,
            appBase: appBase,
          });
          setTimeout(resetButton, 4200);
        });
    }

    function onActivate(event) {
      event.preventDefault();
      event.stopPropagation();

      // Assistant home entry: open chat immediately. Never open camera/sheet.
      if (isAssistantHomeEntry(root)) {
        openAssistantChat(root);
        return;
      }

      // Room try / product try: open camera or gallery → handoff → /try
      prefetchNextStep(root);
      if (shouldUseMobileChooser()) {
        openSheet(ui);
        return;
      }
      openInput(inputs.gallery);
    }

    // pointerdown improves INP: UI responds before click settles.
    button.addEventListener("pointerdown", function () {
      prefetchNextStep(root);
    }, { passive: true });
    button.addEventListener("click", onActivate);

    // Always use onclick so the latest product root owns the handlers.
    ui.sheet.querySelector("[data-enarte-camera]").onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      openCamera(event);
    };
    // Gallery uses a native <label><input type=file>> — no programmatic click.
    // That is the most reliable path on Android Chrome / WebViews.
    var sheetGallery = ui.sheet.querySelector("[data-enarte-sheet-gallery]");
    if (sheetGallery) {
      sheetGallery.onchange = function (event) {
        var file = event.target.files && event.target.files[0];
        closeSheet(ui);
        handleSelectedFile(file);
        try {
          event.target.value = "";
        } catch (e) {}
      };
    }
    ui.sheet.querySelector("[data-enarte-chooser-cancel]").onclick = function (event) {
      event.preventDefault();
      closeSheet(ui);
    };
    ui.backdrop.onclick = function () {
      closeSheet(ui);
    };

    function onFileChange(event) {
      var file = event.target.files && event.target.files[0];
      handleSelectedFile(file);
    }

    inputs.gallery.addEventListener("change", onFileChange);
    inputs.camera.addEventListener("change", onFileChange);
  }

  function boot() {
    if (window.Shopify && window.Shopify.designMode) {
      return;
    }

    scrubStickyClones();

    var roots = document.querySelectorAll("[data-enarte-try-root]");
    if (!roots.length) {
      return;
    }

    var primary = pickPrimaryRoot(roots);
    Array.prototype.forEach.call(roots, function (root) {
      if (root === primary) {
        return;
      }
      // Remove duplicates entirely so nothing floats/sticks at page bottom.
      root.remove();
    });

    ensurePlacement(primary);
    scrubStickyClones();
    initRoot(primary);

    // Defer network warm-up until the browser is idle (keeps first paint snappy).
    var warm = function () {
      warmApp(resolveAppBase(primary));
      startKeepAlive(resolveAppBase(primary));
      prefetchNextStep(primary);
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(warm, { timeout: 1500 });
    } else {
      setTimeout(warm, 400);
    }

    // Only watch sticky cart / buy buttons — never the whole document body.
    if (!window.__enarteTryObserver) {
      var obsTimer = null;
      window.__enarteTryObserver = new MutationObserver(function () {
        if (obsTimer) return;
        obsTimer = setTimeout(function () {
          obsTimer = null;
          scrubStickyClones();
          if (!primary.isConnected) return;
          if (
            !primary.classList.contains("enarte-try-wrap--at-buy") ||
            primary.closest(".sticky-add-to-cart")
          ) {
            placeNearBuyButtons(primary);
          }
        }, 280);
      });
      var observeTargets = [
        document.querySelector(".sticky-add-to-cart"),
        document.querySelector(".buy-buttons-block"),
        document.querySelector("product-info") ||
          document.querySelector(".product-information") ||
          document.querySelector("main"),
      ].filter(Boolean);
      if (!observeTargets.length) {
        observeTargets = [document.body];
      }
      observeTargets.forEach(function (node) {
        window.__enarteTryObserver.observe(node, {
          childList: true,
          subtree: true,
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("shopify:section:load", boot);

  /**
   * Feature-card deep links: each CTA opens a distinct flow.
   * - image-search → Shopify catalog visual match (no AI)
   * - room-try → photo → /try until chandelier placement
   * - assistant → chat
   */
  if (!window.__enarteAssistantLinkGuard) {
    window.__enarteAssistantLinkGuard = true;

    function getPrimaryTryRoot() {
      return (
        document.querySelector("#enarte-home-try[data-enarte-try-root]") ||
        document.querySelector("[data-enarte-try-root][data-enarte-entry='home']") ||
        document.querySelector("[data-enarte-try-root]")
      );
    }

    function triggerRoomTryFromHome() {
      var root = getPrimaryTryRoot();
      if (!root) {
        window.location.assign("/apps/enarte-ai/try?entry=home");
        return;
      }
      var prevFlow = root.getAttribute("data-enarte-flow");
      root.setAttribute("data-enarte-flow", "room-try");
      root.setAttribute("data-enarte-entry", "home");
      var button = root.querySelector("[data-enarte-try-button]");
      if (button) {
        button.click();
      }
      // Restore assistant flow so the hidden home CTA still opens chat.
      setTimeout(function () {
        if (prevFlow != null) {
          root.setAttribute("data-enarte-flow", prevFlow);
        } else {
          root.setAttribute("data-enarte-flow", "assistant");
        }
      }, 0);
    }

    function openImageSearchPage() {
      var shop =
        (window.Shopify && window.Shopify.shop) ||
        (document.querySelector("[data-shop]") &&
          document.querySelector("[data-shop]").getAttribute("data-shop")) ||
        "";
      var url = new URL("/apps/enarte-ai/search-by-image", window.location.origin);
      if (shop) url.searchParams.set("shop", shop);
      url.searchParams.set("locale", "ar");
      window.location.assign(url.toString());
    }

    window.EnarteStorefront = window.EnarteStorefront || {};
    window.EnarteStorefront.openRoomTry = triggerRoomTryFromHome;
    window.EnarteStorefront.openImageSearch = openImageSearchPage;
    window.EnarteStorefront.openAssistant = function (action) {
      var root = getPrimaryTryRoot();
      if (root) {
        openAssistantChat(root, action || "talk_to_assistant");
        return;
      }
      var shop =
        (window.Shopify && window.Shopify.shop) ||
        "";
      var url = new URL("/apps/enarte-ai/assistant", window.location.origin);
      if (shop) url.searchParams.set("shop", shop);
      url.searchParams.set("locale", "ar");
      url.searchParams.set("action", action || "talk_to_assistant");
      url.searchParams.set("continue", "1");
      window.location.assign(url.toString());
    };

    document.addEventListener(
      "click",
      function (event) {
        var link = event.target && event.target.closest
          ? event.target.closest(
              "a[data-enarte-flow], a[data-enarte-open-room-try], a[data-enarte-image-search], a[data-enarte-assistant-action], a[href*='/apps/enarte-ai/assistant'], a[href='#enarte-home-try'], a[href='#enarte-room-try']",
            )
          : null;
        if (!link) return;

        var flow = (link.getAttribute("data-enarte-flow") || "").toLowerCase();
        var href = link.getAttribute("href") || "";

        if (
          flow === "room-try" ||
          link.hasAttribute("data-enarte-open-room-try") ||
          href === "#enarte-room-try" ||
          href === "#enarte-home-try"
        ) {
          // Only treat bare #enarte-home-try as room-try when near a room card.
          if (href === "#enarte-home-try") {
            var card = link.closest(".enarte-ai-features__card, article");
            var styleHint = (
              (card && (card.getAttribute("data-style") || card.className)) ||
              ""
            ).toLowerCase();
            var label = (link.textContent || "").trim();
            if (
              styleHint.indexOf("room") === -1 &&
              !/جرب|room|try/i.test(label)
            ) {
              // Let assistant / search handlers below decide.
            } else {
              event.preventDefault();
              triggerRoomTryFromHome();
              return;
            }
          } else {
            event.preventDefault();
            triggerRoomTryFromHome();
            return;
          }
        }

        if (
          flow === "image-search" ||
          link.hasAttribute("data-enarte-image-search")
        ) {
          event.preventDefault();
          openImageSearchPage();
          return;
        }

        if (flow === "assistant" || link.hasAttribute("data-enarte-assistant-action")) {
          var action =
            link.getAttribute("data-enarte-assistant-action") ||
            "talk_to_assistant";
          if (href.indexOf("/apps/enarte-ai/assistant") !== -1) {
            // Allow native navigation when the href already points at assistant.
            return;
          }
          event.preventDefault();
          window.EnarteStorefront.openAssistant(action);
        }
      },
      true,
    );
  }
})();
