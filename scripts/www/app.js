// 合并并重构原 index.html 中的内联脚本（保持功能不变，改进结构与可维护性）
// 重要：此文件通过 <script src="app.js" defer></script> 引入，依赖 DOMContentLoaded 与 Chart.js（Chart.js 由 CDN defer 加载）

/* 小工具：安全的 DOMContentLoaded 注册器 */
function onReady(fn) {
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", fn);
  else fn();
}

/* 全局模态提示（替代 alert，非阻塞）
   使用：showAppModal(message, title)
   返回一个 Promise，在用户点击确定后 resolve。
*/
function showAppModal(message, title) {
  try {
    const modal = document.getElementById("appModal");
    const overlay = document.getElementById("appModalOverlay");
    const msgEl = document.getElementById("appModalMessage");
    const titleEl = document.getElementById("appModalTitle");
    const okBtn = document.getElementById("appModalOk");
    const closeBtn = document.getElementById("appModalClose");
    if (!modal || !msgEl || !okBtn) {
      // fallback to native alert if modal markup not present
      alert(message);
      return Promise.resolve();
    }
    titleEl && (titleEl.textContent = title || "提示");
    msgEl.innerHTML = typeof message === "string" ? message : String(message);
    modal.classList.remove("hidden");
    function cleanup() {
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      closeBtn && closeBtn.removeEventListener("click", onOk);
      overlay && overlay.removeEventListener("click", onOk);
    }
    function onOk() {
      cleanup();
      resolvePromise();
    }
    let resolvePromise = function () {};
    const p = new Promise((resolve) => {
      resolvePromise = resolve;
      okBtn.addEventListener("click", onOk);
      closeBtn && closeBtn.addEventListener("click", onOk);
      overlay && overlay.addEventListener("click", onOk);
    });
    return p;
  } catch (e) {
    try {
      alert(message);
    } catch (err) {}
    return Promise.resolve();
  }
  try {
    migrateOldLocalStoragePhotos();
  } catch (e) {}
}

// ========= 签名面板逻辑（来自原始 quality 区块） =========
(function setupSignaturePanel() {
  function initSignaturePanel() {
    const confirmBtn = document.getElementById("confirmBtn");
    const signaturePanel = document.getElementById("signaturePanel");
    const signatureContent = signaturePanel
      ? signaturePanel.querySelector(".signature-content")
      : null;
    const closeBtn = document.getElementById("closeSignatureBtn");
    const clearBtn = document.getElementById("clearSignatureBtn");
    const submitBtn = document.getElementById("submitSignatureBtn");
    const canvas = document.getElementById("signatureCanvas");
    if (!confirmBtn || !signaturePanel || !canvas) return;

    const ctx = canvas.getContext("2d");
    let drawing = false;
    let lastX = 0,
      lastY = 0;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      let cssHeight = null;
      try {
        cssHeight = signatureContent
          ? getComputedStyle(signatureContent).getPropertyValue("--sig-height")
          : null;
      } catch (e) {
        cssHeight = null;
      }

      let heightPx = rect.height;
      if (cssHeight) {
        const m = cssHeight.trim().match(/([0-9.]+)px/);
        if (m) heightPx = parseFloat(m[1]);
      }

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(heightPx * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#165DFF";
    }

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.addEventListener("pointerdown", function (e) {
      drawing = true;
      const p = getPos(e);
      lastX = p.x;
      lastY = p.y;
      try {
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!drawing) return;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
    });

    ["pointerup", "pointercancel", "pointerout", "pointerleave"].forEach(
      (evt) => {
        canvas.addEventListener(evt, function (e) {
          drawing = false;
          try {
            canvas.releasePointerCapture &&
              canvas.releasePointerCapture(e.pointerId);
          } catch (err) {}
        });
      },
    );

    window.addEventListener("resize", resizeCanvas);

    // 通用面板显示/隐藏函数（封装 class 操作，便于复用和维护）
    function showPanel(panel, onShow) {
      try {
        panel.classList.remove("hidden");
        panel.classList.add("flex");
      } catch (e) {}
      if (typeof onShow === "function") onShow();
    }

    function hidePanel(panel) {
      try {
        panel.classList.add("hidden");
        panel.classList.remove("flex");
      } catch (e) {}
    }

    // 如果环境不支持 PointerEvent，回退到 touch 事件（一些旧版 WebView/Android 系统）
    if (typeof window.PointerEvent === "undefined") {
      function getTouchPos(touchEvent) {
        const t = touchEvent.touches && touchEvent.touches[0];
        if (!t) return null;
        const rect = canvas.getBoundingClientRect();
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      }

      canvas.addEventListener(
        "touchstart",
        function (e) {
          e.preventDefault();
          const p = getTouchPos(e);
          if (!p) return;
          drawing = true;
          lastX = p.x;
          lastY = p.y;
        },
        { passive: false },
      );

      canvas.addEventListener(
        "touchmove",
        function (e) {
          e.preventDefault();
          if (!drawing) return;
          const p = getTouchPos(e);
          if (!p) return;
          ctx.beginPath();
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          lastX = p.x;
          lastY = p.y;
        },
        { passive: false },
      );

      canvas.addEventListener(
        "touchend",
        function (e) {
          e.preventDefault();
          drawing = false;
        },
        { passive: false },
      );
    }

    confirmBtn.addEventListener("click", function () {
      // 使用封装函数控制面板显示
      showPanel(signaturePanel, function () {
        requestAnimationFrame(resizeCanvas);
      });

      // 更新质量追溯的签收情况
      const signStatus = document.getElementById("sign-status");
      if (signStatus) {
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        signStatus.textContent = `已签收 - ${timeStr}`;
      }
    });

    closeBtn?.addEventListener("click", function () {
      hidePanel(signaturePanel);
    });

    clearBtn?.addEventListener("click", function () {
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch (e) {}
      requestAnimationFrame(resizeCanvas);
    });

    submitBtn?.addEventListener("click", function () {
      hidePanel(signaturePanel);
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch (e) {}
      // 使用页面模态提示替代 alert
      showAppModal("签名提交成功！");
    });
  }

  onReady(initSignaturePanel);
})();

// ========= 主逻辑：从原页面拆分并保留所有行为 =========
onReady(function () {
  // 配置常量（保持原名与含义）
  const PAGE_SIZE = 8;
  const AUTO_GENERATE_ORDERS = 15;
  let currentPage = 1;
  let totalPages = 1;
  let currentStatusFilter = "all";

  // Chart 懒初始化助手（保留原有轮询策略）
  function ensureChartReady(callback) {
    if (window.Chart) return callback && callback();
    const maxWait = 5000;
    const interval = 100;
    let waited = 0;
    const iv = setInterval(() => {
      if (window.Chart) {
        clearInterval(iv);
        return callback && callback();
      }
      waited += interval;
      if (waited >= maxWait) {
        clearInterval(iv);
        console.warn("Chart.js 未在预期时间内加载，跳过图表初始化。");
      }
    }, interval);
  }

  // 通用图表创建函数
  function createChart(canvasId, type, data, options) {
    if (window[`_${canvasId}Chart`]) return;
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    window[`_${canvasId}Chart`] = new Chart(ctx, {
      type: type,
      data: data,
      options: options,
    });
  }

  function createProductionChart() {
    createChart(
      "productionChart",
      "line",
      {
        labels: ["", "", "", "", "", "", ""],
        datasets: [
          {
            data: [8, 9, 10, 7, 12, 11, 13],
            borderColor: "#165DFF",
            backgroundColor: "rgba(22, 93, 255, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    );
  }

  function createEquipmentChart() {
    createChart(
      "equipmentChart",
      "doughnut",
      {
        labels: ["稼动", "停机"],
        datasets: [
          {
            data: [92.5, 7.5],
            backgroundColor: ["#36CFC9", "#F2F3F5"],
            borderWidth: 0,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: "70%",
      },
    );
  }

  function createQualityChart() {
    createChart(
      "qualityChart",
      "doughnut",
      {
        labels: ["良品", "不良"],
        datasets: [
          {
            data: [98.7, 1.3],
            backgroundColor: ["#00B42A", "#F2F3F5"],
            borderWidth: 0,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: "70%",
      },
    );
  }

  function createWorkOrderChart() {
    createChart(
      "workOrderChart",
      "bar",
      {
        labels: ["", "", "", "", ""],
        datasets: [
          {
            data: [5, 8, 6, 9, 7],
            backgroundColor: "#FF7D00",
            borderRadius: 4,
          },
        ],
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    );
  }

  function createTrendChart() {
    const ctx = document.getElementById("trendChart");
    if (!ctx) return;

    // 生成前7天的日期标签
    const labels = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      labels.push(`${month}/${day}`);
    }

    // 如果图表已存在，则更新数据
    if (window._trendChart) {
      window._trendChart.data.labels = labels;
      window._trendChart.update();
      return;
    }

    window._trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "计划产量",
            data: [12000, 12500, 13000, 12800, 13200, 13500, 13000],
            borderColor: "#86909C",
            backgroundColor: "transparent",
            borderDash: [5, 5],
            tension: 0.4,
          },
          {
            label: "实际产量",
            data: [11500, 12200, 12800, 12000, 13000, 12890, 11451],
            borderColor: "#165DFF",
            backgroundColor: "rgba(22, 93, 255, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 10,
            bottom: 10,
            left: 10,
            right: 10,
          },
        },
        plugins: {
          legend: { position: "top", align: "end" },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          y: { beginAtZero: true, grid: { drawBorder: false } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function observeChart(id, createFn) {
    const el = document.getElementById(id);
    if (!el) return;
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            ensureChartReady(() => {
              try {
                createFn();
              } catch (e) {
                console.warn("创建图表失败：", e);
              }
            });
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "200px", threshold: 0.1 },
    );
    io.observe(el);
  }

  observeChart("productionChart", createProductionChart);
  observeChart("equipmentChart", createEquipmentChart);
  observeChart("qualityChart", createQualityChart);
  observeChart("workOrderChart", createWorkOrderChart);
  observeChart("trendChart", createTrendChart);

  // 兼容性补丁：如果 IntersectionObserver 未触发（例如在某些环境下可见性检测异常），
  // 在 Chart.js 可用后立即尝试初始化一次可见的图表（createX 函数内部有幂等检查）。
  ensureChartReady(function () {
    try {
      createProductionChart();
      createEquipmentChart();
      createQualityChart();
      createWorkOrderChart();
      createTrendChart();
    } catch (e) {
      console.warn("初始化图表时发生错误：", e);
    }
  });

  // 侧边栏导航切换
  const navLinks = document.querySelectorAll("nav a");
  const sections = document.querySelectorAll("section");
  const pageTitle = document.getElementById("page-title");
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      navLinks.forEach((nav) => nav.classList.remove("sidebar-item-active"));
      this.classList.add("sidebar-item-active");
      sections.forEach((section) => section.classList.add("hidden"));
      const targetId = this.getAttribute("href").substring(1);
      document.getElementById(targetId).classList.remove("hidden");
      pageTitle.textContent = this.querySelector("span").textContent;
      // 如果切换到质量追溯页，确保质量工单已从工单管理同步并渲染
      if (targetId === "traceability") {
        try {
          const existing = loadAllQualityOrders() || {};
          if (Object.keys(existing).length === 0) {
            // 同步一次工单管理的数据到质量追溯（首次进入或空列表时自动生成）
            generateQualityOrdersFromWorkOrders();
          }
        } catch (e) {
          console.warn("同步质量工单失败：", e);
        }
        // 渲染列表（无论是否新生成），并确保折叠行也更新
        try {
          renderQualityOrders();
          renderCollapsedDetailRow();
        } catch (e) {
          console.warn("渲染质量追溯视图失败：", e);
        }
      }
    });
  });

  // 移动端侧边栏：在窄屏时展示为全屏覆盖导航并显示遮罩；在大屏保持原有行为
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("main-sidebar");
  const mobileBackdrop = document.getElementById("mobile-nav-backdrop");

  function isLargeScreen() {
    // Tailwind 默认 lg 起点是 1024px
    return window.innerWidth >= 1024;
  }

  function openMobileSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("hidden");
    sidebar.classList.add("mobile-overlay-open");
    mobileBackdrop && mobileBackdrop.classList.remove("hidden");
    // prevent body scrolling when overlay open
    try {
      document.body.style.overflow = "hidden";
    } catch (e) {}
  }

  function closeMobileSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove("mobile-overlay-open");
    sidebar.classList.add("hidden");
    mobileBackdrop && mobileBackdrop.classList.add("hidden");
    try {
      document.body.style.overflow = "";
    } catch (e) {}
  }

  sidebarToggle?.addEventListener("click", function () {
    if (isLargeScreen()) {
      // 保持原有桌面行为（如果需要折叠也适配）
      sidebar.classList.toggle("hidden");
      return;
    }
    // 窄屏：切换覆盖导航
    if (sidebar.classList.contains("mobile-overlay-open")) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  });

  // 点击遮罩关闭侧栏
  mobileBackdrop?.addEventListener("click", function () {
    closeMobileSidebar();
  });

  // 在导航链接点击后，如果是移动覆盖模式，则关闭覆盖（避免与内容同时显示）
  navLinks.forEach((link) => {
    link.addEventListener("click", function () {
      if (
        !isLargeScreen() &&
        sidebar.classList.contains("mobile-overlay-open")
      ) {
        // 小延时保证路由/切换逻辑先执行再关闭 overlay
        setTimeout(closeMobileSidebar, 120);
      }
    });
  });

  // 当窗口大小变化到大屏时，确保清理移动端状态
  window.addEventListener("resize", function () {
    if (isLargeScreen()) {
      // 还原可能被隐藏的侧栏
      sidebar && sidebar.classList.remove("hidden", "mobile-overlay-open");
      mobileBackdrop && mobileBackdrop.classList.add("hidden");
      try {
        document.body.style.overflow = "";
      } catch (e) {}
    } else {
      // 当从大屏切回小屏，确保侧栏默认隐藏（避免意外露出）
      if (sidebar && !sidebar.classList.contains("mobile-overlay-open")) {
        sidebar.classList.add("hidden");
      }
    }
  });

  // ========== localStorage 持久化函数（保持原有接口） ==========
  // 初始化 localForage（如果已引入）
  try {
    if (window.localforage) {
      // 优先使用 IndexedDB -> WebSQL -> localStorage
      localforage.config({
        name: "mes_app",
        storeName: "mes_store",
        description: "持久化 MES 数据 (work order photos etc.)",
      });
    }
  } catch (e) {
    console.warn("localforage init failed:", e);
  }
  // 迁移旧版 localStorage 中以 DataURL 保存的图片到 localforage（Blob 存储），仅在首次检测到旧数据时运行一次
  function migrateOldLocalStoragePhotos() {
    try {
      const old = localStorage.getItem("workOrderPhotos");
      if (!old) return;
      let parsed = {};
      try {
        parsed = JSON.parse(old || "{}");
      } catch (e) {
        parsed = {};
      }
      const keys = Object.keys(parsed || {});
      if (keys.length === 0) return;
      // 逐工单迁移
      keys.forEach((orderNo) => {
        const arr = parsed[orderNo] || [];
        const converted = [];
        arr.forEach((p) => {
          try {
            // 如果已是字符串 DataURL 或对象 {url: dataUrl}
            const dataUrl =
              typeof p === "string" ? p : p && p.url ? p.url : null;
            if (dataUrl && dataUrl.startsWith("data:")) {
              // convert DataURL to Blob
              const parts = dataUrl.split(",");
              const mimeMatch = parts[0].match(/:(.*?);/);
              const mime = mimeMatch ? mimeMatch[1] : "image/png";
              const bstr = atob(parts[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) u8arr[n] = bstr.charCodeAt(n);
              const blob = new Blob([u8arr], { type: mime });
              converted.push({
                id:
                  (p && p.id) ||
                  `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: (p && p.name) || "photo",
                mime: mime,
                timestamp: new Date().toISOString(),
                blob: blob,
              });
            } else if (p && p.blob) {
              converted.push(p);
            } else if (p && p.url) {
              converted.push(p);
            }
          } catch (e) {
            console.warn("迁移单张图片失败：", e);
          }
        });
        if (converted.length > 0 && window.localforage) {
          try {
            localforage
              .getItem("workOrderPhotos")
              .then((stored) => {
                const obj = stored || {};
                obj[orderNo] = converted;
                return localforage.setItem("workOrderPhotos", obj);
              })
              .catch((err) =>
                console.warn("localforage set during migrate failed:", err),
              );
          } catch (e) {}
          // 写入 meta
          try {
            const metaAll = JSON.parse(
              localStorage.getItem("workOrderPhotosMeta") || "{}",
            );
            metaAll[orderNo] = converted.map((p) => ({
              id: p.id || null,
              name: p.name || null,
              mime: p.mime || null,
              timestamp: p.timestamp || null,
            }));
            localStorage.setItem(
              "workOrderPhotosMeta",
              JSON.stringify(metaAll),
            );
          } catch (e) {}
        }
      });
      // 移除旧 key
      try {
        localStorage.removeItem("workOrderPhotos");
      } catch (e) {}
    } catch (e) {
      console.warn("迁移旧图片数据失败：", e);
    }
  }
  function loadAllWorkOrders() {
    try {
      const workOrderData = localStorage.getItem("mesWorkOrders");
      return workOrderData ? JSON.parse(workOrderData) : {};
    } catch (err) {
      console.error("加载工单数据失败：", err);
      showAppModal("加载历史工单失败，将重置工单数据！");
      localStorage.removeItem("mesWorkOrders");
      return {};
    }
  }
  function saveAllWorkOrders(workOrders) {
    try {
      localStorage.setItem("mesWorkOrders", JSON.stringify(workOrders));
    } catch (err) {
      console.error("保存工单数据失败：", err);
      showAppModal("工单保存失败，请检查浏览器存储权限！");
    }
  }
  function loadAllQualityOrders() {
    try {
      const data = localStorage.getItem("mesQualityOrders");
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.error("加载质量工单失败：", err);
      localStorage.removeItem("mesQualityOrders");
      return {};
    }
  }
  function saveAllQualityOrders(qOrders) {
    try {
      localStorage.setItem("mesQualityOrders", JSON.stringify(qOrders));
    } catch (err) {
      console.error("保存质量工单失败：", err);
      showAppModal("质量工单保存失败，请检查浏览器存储权限！");
    }
  }
  // 图片持久化：把最小化的元数据保存在 localStorage（key=workOrderPhotosMeta），
  // 把完整的照片对象（可能包含 Blob）保存在 localForage (key=workOrderPhotos) 中。
  // 这样能兼顾旧逻辑的同步读取（读取元数据）和 IndexedDB 的大容量持久化。
  function savePhotosToLocalStorage(orderNo, photos) {
    try {
      // 写入 meta 到 localStorage（仅 id/name/mime/timestamp）以保持同步性且体积小
      const metaAll = JSON.parse(
        localStorage.getItem("workOrderPhotosMeta") || "{}",
      );
      try {
        metaAll[orderNo] = (Array.isArray(photos) ? photos : []).map((p) => ({
          id: p.id || null,
          name: p.name || null,
          mime: p.mime || p.type || null,
          timestamp: p.timestamp || null,
        }));
        localStorage.setItem("workOrderPhotosMeta", JSON.stringify(metaAll));
      } catch (err) {
        console.warn("localStorage 写入图片元数据失败（可能超配额）：", err);
      }

      // 立即更新 UI（固定工单 trace 区）
      if (orderNo === "LFP250803") {
        window._traceabilityPhotos = photos;
        try {
          renderTraceabilityPhotos();
        } catch (e) {}
      }

      // 异步写入 localforage（完整对象，包括 Blob）
      if (window.localforage) {
        try {
          // Ensure we don't leave stale full-data entries in localForage. If
          // photos array is empty, remove the order's entry to avoid later
          // async loads from re-populating the UI with stale blobs.
          localforage
            .getItem("workOrderPhotos")
            .then((stored) => {
              const obj = stored || {};
              if (Array.isArray(photos) && photos.length > 0) {
                obj[orderNo] = Array.isArray(photos) ? photos : [];
              } else {
                // remove entry when no photos remain
                if (obj && Object.prototype.hasOwnProperty.call(obj, orderNo))
                  delete obj[orderNo];
              }
              return localforage.setItem("workOrderPhotos", obj);
            })
            .catch((err) => {
              console.warn("localforage get/set failed:", err);
            });
        } catch (err) {
          console.warn("写入 localforage 失败：", err);
        }
      }
    } catch (e) {
      console.warn("保存图片到持久化存储失败：", e);
    }
  }

  // 保存电池检测数据到localStorage
  function saveBatteryDataToLocalStorage(orderNo, batteryBatch) {
    try {
      const allBatteryData = JSON.parse(
        localStorage.getItem("workOrderBatteryData") || "{}",
      );
      if (!allBatteryData[orderNo]) {
        allBatteryData[orderNo] = [];
      }
      allBatteryData[orderNo].push(batteryBatch);
      localStorage.setItem(
        "workOrderBatteryData",
        JSON.stringify(allBatteryData),
      );
    } catch (e) {
      console.warn("保存电池检测数据到localStorage失败：", e);
    }
  }
  // 加载图片函数：同步返回 localStorage 快速缓存的数据，同时异步从 localForage 恢复并在数据不同时回填并触发 UI 更新
  function loadPhotosFromLocalStorage(orderNo) {
    try {
      // 读取元数据（localStorage 中只保存 meta，减少占用）
      const metaAll = JSON.parse(
        localStorage.getItem("workOrderPhotosMeta") || "{}",
      );
      const metaList = metaAll[orderNo] || [];
      // 构造默认返回结果：仅包含 meta（url 可能为空），以便 UI 能快速显示占位或名称
      const result = (metaList || []).map((m) => ({
        id: m.id || null,
        name: m.name || null,
        mime: m.mime || null,
        timestamp: m.timestamp || null,
        url: null,
      }));

      // 异步尝试从 localforage 读取（如果可用），并在读取到不同数据时回填 localStorage 并更新 UI
      if (window.localforage) {
        try {
          localforage
            .getItem("workOrderPhotos")
            .then((stored) => {
              if (stored && stored[orderNo]) {
                try {
                  const full = stored[orderNo];

                  // Compare with the synchronous meta in localStorage. If the
                  // meta for this order indicates there are NO photos (i.e.
                  // the user just deleted them), prefer the meta and delete
                  // the stale full entry from localForage to avoid "rebound".
                  const currentMetaAll = JSON.parse(
                    localStorage.getItem("workOrderPhotosMeta") || "{}",
                  );
                  const currentMetaList = currentMetaAll[orderNo] || [];

                  if (
                    Array.isArray(currentMetaList) &&
                    currentMetaList.length === 0 &&
                    Array.isArray(full) &&
                    full.length > 0
                  ) {
                    // Remove the stale entry from localForage and skip rendering
                    try {
                      const newObj = Object.assign({}, stored);
                      if (Object.prototype.hasOwnProperty.call(newObj, orderNo))
                        delete newObj[orderNo];
                      localforage
                        .setItem("workOrderPhotos", newObj)
                        .catch((err) => {
                          console.warn(
                            "failed to remove stale workOrderPhotos entry:",
                            err,
                          );
                        });
                    } catch (err) {
                      console.warn(
                        "failed to remove stale localforage entry:",
                        err,
                      );
                    }
                    return;
                  }

                  // 回填 meta 到 localStorage（如果不同）
                  try {
                    const metaObj = {};
                    metaObj[orderNo] = full.map((p) => ({
                      id: p.id || null,
                      name: p.name || null,
                      mime: p.mime || p.type || null,
                      timestamp: p.timestamp || null,
                    }));
                    localStorage.setItem(
                      "workOrderPhotosMeta",
                      JSON.stringify(
                        Object.assign(
                          JSON.parse(
                            localStorage.getItem("workOrderPhotosMeta") || "{}",
                          ),
                          metaObj,
                        ),
                      ),
                    );
                  } catch (err) {
                    // ignore localStorage write errors
                  }

                  // 触发 UI 更新：如果详情 modal 正在显示该工单，渲染历史图片；如果是固定工单，也渲染 trace 区
                  try {
                    if (typeof renderHistoryPhotos === "function") {
                      renderHistoryPhotos(full);
                    }
                  } catch (e) {}
                  if (orderNo === "LFP250803") {
                    window._traceabilityPhotos = full;
                    try {
                      renderTraceabilityPhotos();
                    } catch (e) {}
                  }
                } catch (e) {}
              }
            })
            .catch((err) => {
              console.warn("从 localforage 加载图片失败：", err);
            });
        } catch (e) {
          console.warn("localforage async load failed:", e);
        }
      }

      return result;
    } catch (e) {
      console.warn("从localStorage加载图片失败：", e);
      return [];
    }
  }
  function clearAllData() {
    localStorage.removeItem("mesWorkOrders");
    localStorage.removeItem("workOrderPhotosMeta");
    localStorage.removeItem("workOrderBatteryData");
    localStorage.removeItem("mesQualityOrders");
    // 异步清理 localforage 中的图片存储（如果可用）
    try {
      if (window.localforage) {
        localforage.removeItem("workOrderPhotos").catch((err) => {
          console.warn("清理 localforage 中的 workOrderPhotos 失败：", err);
        });
      }
    } catch (e) {
      console.warn("清理 localforage 失败：", e);
    }
  }
  function hasWorkOrdersInStorage() {
    return localStorage.getItem("mesWorkOrders") !== null;
  }

  // ========= 渲染/工具函数（原封保留，稍作封装） ==========
  function renderWorkOrders() {
    if (!hasWorkOrdersInStorage() && AUTO_GENERATE_ORDERS > 0) {
      const testOrders = generateTestWorkOrders(AUTO_GENERATE_ORDERS);
      saveAllWorkOrders(testOrders);
      var workOrders = testOrders;
    } else {
      var workOrders = loadAllWorkOrders() || {};
    }
    const workOrderList = document.getElementById("work-order-list");
    workOrderList.innerHTML = "";
    const orderArray = Object.values(workOrders).sort(
      (a, b) => new Date(b.createTime) - new Date(a.createTime),
    );
    // Ensure fixed order LFP250803 always appears first in the list.
    try {
      const idx = orderArray.findIndex((o) => o && o.orderNo === "LFP250803");
      if (idx > 0) {
        const [lfp] = orderArray.splice(idx, 1);
        orderArray.unshift(lfp);
      }
    } catch (e) {
      // ignore any unexpected structure
    }
    const statusFilter = currentStatusFilter || "all";
    const filteredArray =
      statusFilter === "all"
        ? orderArray
        : orderArray.filter((o) => o.status === statusFilter);
    const totalCount = filteredArray.length;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const displayedOrders = filteredArray.slice(startIndex, endIndex);
    const startNum = totalCount === 0 ? 0 : startIndex + 1;
    const endNum = Math.min(endIndex, totalCount);
    document.getElementById("pagination-info").innerHTML =
      `\n      显示 <span class="font-medium">${startNum}</span> 到 <span class="font-medium">${endNum}</span> 条，共 <span class="font-medium">${totalCount}</span> 条记录\n    `;
    if (displayedOrders.length === 0) {
      workOrderList.innerHTML = `\n        <tr>\n          <td colspan="9" class="py-6 text-center text-gray-500">暂无工单，请点击「创建工单」按钮新增</td>\n        </tr>\n      `;
      renderPagination();
      return;
    }
    displayedOrders.forEach((order) => {
      // 使用统一的状态徽章函数替代重复代码
      const statusBadge = getStatusBadge(order.status);

      let actionButtons = "";
      switch (order.status) {
        case "pending":
          actionButtons = `\n            <div class="flex space-x-2">\n              <button type="button" class="text-primary hover:underline view-btn" data-id="${order.orderNo}">详情</button>\n              <button type="button" class="text-primary hover:underline dispatch-btn" data-id="${order.orderNo}">派发</button>\n              <button type="button" class="text-danger hover:underline cancel-btn" data-id="${order.orderNo}">取消</button>\n            </div>\n`;
          break;
        case "processing":
          actionButtons = `\n            <div class="flex space-x-2">\n              <button type="button" class="text-primary hover:underline view-btn" data-id="${order.orderNo}">详情</button>\n              <button type="button" class="text-warning hover:underline pause-btn" data-id="${order.orderNo}">暂停</button>\n              <button type="button" class="text-success hover:underline complete-btn" data-id="${order.orderNo}">完成</button>\n            </div>\n`;
          break;
        case "paused":
          actionButtons = `\n            <div class="flex space-x-2">\n              <button type="button" class="text-primary hover:underline view-btn" data-id="${order.orderNo}">详情</button>\n              <button type="button" class="text-success hover:underline resume-btn" data-id="${order.orderNo}">恢复</button>\n              <button type="button" class="text-danger hover:underline cancel-btn" data-id="${order.orderNo}">取消</button>\n            </div>\n`;
          break;
        case "completed":
          actionButtons = `\n            <div class="flex space-x-2">\n              <button type="button" class="text-primary hover:underline view-btn" data-id="${order.orderNo}">详情</button>\n              <button type="button" class="text-gray-500 cursor-not-allowed" disabled>归档</button>\n            </div>\n`;
          break;
        case "cancelled":
          actionButtons = `\n            <div class="flex space-x-2">\n              <button type="button" class="text-primary hover:underline view-btn" data-id="${order.orderNo}">详情</button>\n              <button type="button" class="text-gray-500 cursor-not-allowed" disabled>已取消</button>\n            </div>\n`;
          break;
      }
      const completeQty =
        order.status === "completed"
          ? `${order.planQuantity}${order.unit} (100%)`
          : `0${order.unit} (0%)`;
      const row = document.createElement("tr");
      row.setAttribute("data-id", order.orderNo);
      row.setAttribute("data-status", order.status);
      row.innerHTML = `
        <td class="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-800">${order.orderNo}</td>
        <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${order.productName}</td>
        <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${order.productionLine}</td>
        <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${order.planQuantity}${order.unit}</td>
        <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${completeQty}</td>
        <td class="py-3 px-4 whitespace-nowrap">${statusBadge}</td>
        <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${order.createTime}</td>
        <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${order.deadline}</td>
        <td class="py-3 px-4 whitespace-nowrap text-sm">${actionButtons}</td>
      `;
      workOrderList.appendChild(row);
    });
    renderPagination();
  }

  function renderPagination() {
    const paginationContainer = document.querySelector(".isolate");
    if (!paginationContainer) return;
    paginationContainer.innerHTML = "";
    const prevBtn = document.createElement("button");
    prevBtn.className =
      "pagination-prev relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 hover:bg-gray-50 focus:z-20 focus:outline-offset-0";
    prevBtn.innerHTML = `<span class="sr-only">上一页</span><i class="fa-solid fa-chevron-left h-5 w-5"></i>`;
    if (currentPage <= 1) {
      prevBtn.classList.add("text-gray-300", "cursor-not-allowed");
      prevBtn.disabled = true;
    } else {
      prevBtn.addEventListener("click", () => {
        currentPage--;
        renderWorkOrders();
      });
    }
    paginationContainer.appendChild(prevBtn);
    const maxVisiblePages = 3;
    const pageButtons = [];
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++)
        pageButtons.push(createPageButton(i));
    } else {
      if (currentPage <= Math.ceil(maxVisiblePages / 2)) {
        for (let i = 1; i <= maxVisiblePages; i++)
          pageButtons.push(createPageButton(i));
        pageButtons.push(createEllipsisButton());
        pageButtons.push(createPageButton(totalPages));
      } else if (currentPage >= totalPages - Math.floor(maxVisiblePages / 2)) {
        pageButtons.push(createPageButton(1));
        pageButtons.push(createEllipsisButton());
        for (let i = totalPages - maxVisiblePages + 1; i <= totalPages; i++)
          pageButtons.push(createPageButton(i));
      } else {
        pageButtons.push(createPageButton(1));
        pageButtons.push(createEllipsisButton());
        for (let i = currentPage - 1; i <= currentPage + 1; i++)
          pageButtons.push(createPageButton(i));
        pageButtons.push(createEllipsisButton());
        pageButtons.push(createPageButton(totalPages));
      }
    }
    pageButtons.forEach((btn) => paginationContainer.appendChild(btn));
    const nextBtn = document.createElement("button");
    nextBtn.className =
      "pagination-next relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 hover:bg-gray-50 focus:z-20 focus:outline-offset-0";
    nextBtn.innerHTML = `<span class="sr-only">下一页</span><i class="fa-solid fa-chevron-right h-5 w-5"></i>`;
    if (currentPage >= totalPages) {
      nextBtn.classList.add("text-gray-300", "cursor-not-allowed");
      nextBtn.disabled = true;
    } else {
      nextBtn.addEventListener("click", () => {
        currentPage++;
        renderWorkOrders();
      });
    }
    paginationContainer.appendChild(nextBtn);
  }

  function createPageButton(pageNum) {
    const btn = document.createElement("button");
    btn.className = `relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${currentPage === pageNum ? "z-10 bg-primary text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`;
    btn.textContent = pageNum;
    if (currentPage !== pageNum) {
      btn.addEventListener("click", () => {
        currentPage = pageNum;
        renderWorkOrders();
      });
    } else {
      btn.setAttribute("aria-current", "page");
    }
    return btn;
  }
  function createEllipsisButton() {
    const btn = document.createElement("button");
    btn.className =
      "relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-500 bg-white focus:z-20 cursor-default";
    btn.textContent = "...";
    btn.disabled = true;
    return btn;
  }

  function generateTestWorkOrders(count) {
    const testOrders = {};
    const productNames = [
      "电池包组装",
      "电池包检测",
      "BMS装配",
      "电机外壳加工",
      "控制面板组装",
    ];
    const productionLines = [
      "电池包组装线1",
      "电池检测线1",
      "装配线1",
      "机加工线1",
      "焊接线2",
    ];
    const statusList = [
      "pending",
      "processing",
      "paused",
      "completed",
      "cancelled",
    ];
    const units = ["件", "套", "个"];

    // 添加固定工单 LFP250803
    const now = new Date();
    const createTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 7);
    const deadline = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, "0")}-${String(deadlineDate.getDate()).padStart(2, "0")} ${String(deadlineDate.getHours()).padStart(2, "0")}:${String(deadlineDate.getMinutes()).padStart(2, "0")}`;

    testOrders["LFP250803"] = {
      orderNo: "LFP250803",
      productName: "电池包组装",
      productionLine: "电池包组装线1",
      planQuantity: 1,
      unit: "件",
      priority: "normal",
      deadline: deadline,
      createTime: createTime,
      status: "pending",
      completedQuantity: 0,
    };

    for (let i = 1; i <= count; i++) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const random = String(i).padStart(2, "0");
      const orderNo = `W${year}${month}${day}${random}`;
      const randomProduct =
        productNames[Math.floor(Math.random() * productNames.length)];
      const randomLine =
        productionLines[Math.floor(Math.random() * productionLines.length)];
      const randomStatus =
        statusList[Math.floor(Math.random() * statusList.length)];
      const randomQty = Math.floor(Math.random() * 1000) + 100;
      const randomUnit = units[Math.floor(Math.random() * units.length)];
      const now = new Date();
      const createTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const deadlineDate = new Date();
      deadlineDate.setDate(
        deadlineDate.getDate() + Math.floor(Math.random() * 7) + 1,
      );
      const deadline = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, "0")}-${String(deadlineDate.getDate()).padStart(2, "0")} ${String(deadlineDate.getHours()).padStart(2, "0")}:${String(deadlineDate.getMinutes()).padStart(2, "0")}`;
      testOrders[orderNo] = {
        orderNo: orderNo,
        productName: randomProduct,
        productionLine: randomLine,
        planQuantity: randomQty,
        unit: randomUnit,
        priority: "normal",
        deadline: deadline,
        createTime: createTime,
        status: randomStatus,
      };
    }
    return testOrders;
  }

  function generateOrderNo() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");
    return `W${year}${month}${day}${random}`;
  }

  function renderQualityOrders() {
    const qListEl = document.getElementById("quality-order-list");
    if (!qListEl) return;
    const qOrders = loadAllQualityOrders() || {};
    const keys = Object.keys(qOrders).sort((a, b) => (a < b ? 1 : -1));
    qListEl.innerHTML = "";
    if (keys.length === 0) {
      qListEl.innerHTML = `\n              <tr>\n                <td colspan="5" class="py-6 text-center text-gray-500">暂无质量工单，请点击「生成质量工单」从工单管理同步生成</td>\n              </tr>\n            `;
      return;
    }
    keys.forEach((k) => {
      const o = qOrders[k];
      const row = document.createElement("tr");
      row.innerHTML = `\n              <td class="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-800">${o.orderNo}</td>\n              <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${o.productName || "-"}</td>\n              <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${o.productionLine || "-"}</td>\n              <td class="py-3 px-4 whitespace-nowrap text-sm">${o.status || "pending"}</td>\n              <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${o.createTime || "-"}</td>\n            `;
      qListEl.appendChild(row);
    });
  }

  function generateQualityOrdersFromWorkOrders() {
    const workOrders = loadAllWorkOrders() || {};
    const qOrders = {};
    Object.keys(workOrders).forEach((orderNo) => {
      const w = workOrders[orderNo];
      qOrders[orderNo] = {
        orderNo: orderNo,
        productName: w.productName || "-",
        productionLine: w.productionLine || "-",
        planQuantity: w.planQuantity || "",
        unit: w.unit || "",
        priority: w.priority || "normal",
        createTime: w.createTime || new Date().toLocaleString(),
        status: w.status || "pending",
      };
    });
    saveAllQualityOrders(qOrders);
    // 不在此处直接渲染或 alert，改为由调用方（如清空操作）统一处理提示与渲染
    return Object.keys(qOrders).length;
  }

  function parseOrderTitle(titleText) {
    const result = { orderNo: "-", productName: "-" };
    if (!titleText) return result;
    try {
      const parts = titleText.split("|");
      parts.forEach((p) => {
        const t = p.trim();
        if (t.startsWith("工单编号")) {
          const v = t.split("：")[1];
          if (v) result.orderNo = v.trim();
        }
        if (t.startsWith("工单名称") || t.startsWith("工单名称")) {
          const v = t.split("：")[1];
          if (v) result.productName = v.trim();
        }
      });
    } catch (e) {}
    return result;
  }

  function renderCollapsedDetailRow() {
    const container = document.getElementById("collapsed-detail-body");
    if (!container) return;
    const orderTitleEl = document.getElementById("orderTitle");
    const commonInfoTbl = document.getElementById("commonInfo");
    const parsed = parseOrderTitle(
      orderTitleEl ? orderTitleEl.textContent : "",
    );
    let createTime = "-";
    try {
      if (commonInfoTbl) {
        const firstRow = commonInfoTbl.querySelector(
          "tbody tr:first-child td:nth-child(2)",
        );
        if (firstRow) createTime = firstRow.textContent.trim();
      }
    } catch (e) {}
    // 指定生产线与状态为用户要求的内容
    const productionLine = "电池包组装线";
    const status = "completed";

    container.innerHTML = `\n            <tr class="border-t">\n              <td class="py-3 px-4 whitespace-nowrap text-sm font-medium text-gray-800">${parsed.orderNo}</td>\n              <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${parsed.productName}</td>\n              <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${productionLine}</td>\n              <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${status}</td>\n              <td class="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${createTime}</td>\n            </tr>\n          `;
    // 为折叠行添加点击展开行为（点击后恢复详情视图）
    try {
      const insertedRow = container.querySelector("tr");
      if (insertedRow) {
        insertedRow.style.cursor = "pointer";
        insertedRow.classList.add("hover:bg-gray-50");
        insertedRow.addEventListener("click", function (e) {
          // 阻止可能的行内链接或冒泡
          e.stopPropagation();
          toggleTraceDetailCollapse(false);
        });
      }
    } catch (e) {
      console.warn("绑定折叠行点击事件失败：", e);
    }
  }

  function toggleTraceDetailCollapse(forceState) {
    const commonInfo = document.getElementById("commonInfo");
    const batteries = document.getElementById("batteriesContainer");
    const detailHeader = document.getElementById("detail-header");
    const buttons = document.querySelectorAll("#trace-export-btn");
    const collapsed = document.getElementById("collapsed-detail-row-container");
    const toggleBtn = document.getElementById("toggle-detail-collapse-btn");
    const traceCard = document.getElementById("traceability-card");
    const tracePhotos = document.getElementById("trace-fixed-photos");
    if (!toggleBtn) return;
    const isCollapsed =
      typeof forceState === "boolean"
        ? forceState
        : collapsed.classList.contains("hidden");
    if (isCollapsed) {
      if (commonInfo) commonInfo.style.display = "none";
      if (batteries) batteries.style.display = "none";
      if (detailHeader) detailHeader.style.display = "none";
      if (tracePhotos) tracePhotos.style.display = "none";
      buttons.forEach((b) => (b.style.display = "none"));
      renderCollapsedDetailRow();
      collapsed.classList.remove("hidden");
      // 缩小卡片顶部内边距以减少折叠时上方空白
      try {
        traceCard && traceCard.classList.add("collapsed");
      } catch (e) {}
      toggleBtn.textContent = "展开详情";
    } else {
      if (commonInfo) commonInfo.style.display = "table";
      if (batteries) batteries.style.display = "block";
      if (detailHeader) detailHeader.style.display = "block";
      if (tracePhotos) tracePhotos.style.display = "block";
      buttons.forEach((b) => (b.style.display = "inline-block"));
      collapsed.classList.add("hidden");
      // 恢复卡片顶部内边距
      try {
        traceCard && traceCard.classList.remove("collapsed");
      } catch (e) {}
      toggleBtn.textContent = "收起详情";
    }
  }

  // ========== 电池动态显示：从代码中读取初始电压并更新 UI（如需调整请修改 initialBatteryVoltages 数组） ==========
  (function setupBatteryDisplayFromConfig() {
    try {
      // 在这里修改电压数组即可（单位：V）
      const initialBatteryVoltages = [
        3.2, 3.2, 3.19, 3.2, 3.19, 3.17, 3.18, 3.19, 3.19, 3.18,
      ];

      const packDeltaBar = document.getElementById("pack-delta-bar");
      const packDeltaValue = document.getElementById("pack-delta-value");
      const packThresholdEl = document.getElementById("pack-delta-threshold");
      const packTotalEl = document.getElementById("pack-total-voltage");
      const threshold = 100.0; // mV，用于进度条占比（可按需修改）
      if (packThresholdEl) packThresholdEl.textContent = threshold.toFixed(1);

      function renderFromArray(arr) {
        if (!Array.isArray(arr) || arr.length === 0) return;
        // 支持任意数量的电芯，根据数组长度动态生成 DOM
        const voltages = arr.map((v) => parseFloat(v) || 0);
        const cellsContainerEl = document.getElementById("cellsContainer");
        if (cellsContainerEl) {
          // 生成每个电芯的 HTML
          cellsContainerEl.innerHTML = voltages
            .map((v, idx) => {
              // 保持与原有样式一致的结构
              return `
                <div class="cell-item" data-index="${idx}">
                  <div class="flex justify-between items-center mb-2">
                    <span class="text-xs text-neutral-400">电池 #${idx + 1}</span>
                    <span class="cell-status badge bg-success text-xs" id="cell-status-${idx}">正常</span>
                  </div>
                  <div class="text-lg font-semibold text-neutral-600">
                    <span class="cell-delta" id="cell-delta-${idx}">0.0</span> mV
                  </div>
                  <div class="text-xs text-neutral-400 mt-1">
                    电压: <span id="cell-voltage-${idx}">${v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}</span> V
                  </div>
                </div>
              `.trim();
            })
            .join("\n");
        }

        // 总电压
        const total = voltages.reduce((a, b) => a + b, 0);
        if (packTotalEl) packTotalEl.textContent = total.toFixed(2);

        // 压差（mV） = max - min
        const maxV = Math.max(...voltages);
        const minV = Math.min(...voltages);
        const delta_mV = (maxV - minV) * 1000;
        if (packDeltaValue) packDeltaValue.textContent = delta_mV.toFixed(1);
        if (packDeltaBar) {
          const pct = Math.min(100, (delta_mV / threshold) * 100);
          packDeltaBar.style.width = pct + "%";
        }

        // 每块电池相对平均值的差值与状态
        const mean = total / voltages.length;
        voltages.forEach((v, idx) => {
          const deltaFromMean = Math.abs(v - mean) * 1000; // mV
          const deltaEl = document.getElementById("cell-delta-" + idx);
          const statusEl = document.getElementById("cell-status-" + idx);
          const voltageEl = document.getElementById("cell-voltage-" + idx);
          if (deltaEl) deltaEl.textContent = deltaFromMean.toFixed(1);
          if (voltageEl)
            voltageEl.textContent = v
              .toFixed(3)
              .replace(/0+$/, "")
              .replace(/\.$/, "");
          if (statusEl) {
            if (deltaFromMean <= 10) {
              statusEl.textContent = "正常";
              statusEl.className = "cell-status badge bg-success text-xs";
            } else if (deltaFromMean <= 30) {
              statusEl.textContent = "注意";
              statusEl.className =
                "cell-status badge bg-warning text-white text-xs";
            } else {
              statusEl.textContent = "危险";
              statusEl.className =
                "cell-status badge bg-danger text-white text-xs";
            }
          }
        });
      }

      // 首次渲染
      renderFromArray(initialBatteryVoltages);

      // 暴露一个全局函数，方便在控制台或其它脚本中手动更新电压数组并触发重新渲染
      window.updateBatteryVoltages = function (arr) {
        try {
          renderFromArray(arr);
        } catch (e) {
          console.warn("updateBatteryVoltages 错误：", e);
        }
      };
    } catch (e) {
      console.warn("setupBatteryDisplayFromConfig 初始化失败：", e);
    }
  })();

  function getPhotosFromPreview() {
    const photos = [];
    const photoItems = photoPreviewContainer.querySelectorAll(".relative");
    photoItems.forEach((item) => {
      // Prefer in-memory stored entry (with blob) if present
      const entry = item._photoEntry;
      if (entry) {
        photos.push(entry);
        return;
      }
      const img = item.querySelector("img");
      const name = item.querySelector("div").textContent.trim();
      photos.push({ id: null, name: name, url: img ? img.src : null });
    });
    return photos;
  }

  function renderHistoryPhotos(photos) {
    photoPreviewContainer.innerHTML = "";
    if (!Array.isArray(photos) || photos.length === 0) {
      photoPreviewContainer.innerHTML =
        '<div class="text-sm text-gray-400 text-center py-4">暂无图片</div>';
      return;
    }
    photos.forEach((photo) => {
      // photo may be {url,name} or {id,name,blob,...} or meta-only {id,name}
      if (photo && (photo.blob || photo.file)) {
        // real binary/file entry -> render in upload preview
        addPhotoToPreview(photo, photo.name);
      } else if (photo && photo.url) {
        // If the URL is the default placeholder (1.svg), do NOT show it in the
        // upload preview area. The default should only appear in the quality
        // traceability area.
        if (!photo.url.includes("1.svg")) {
          addPhotoToPreview(photo.url, photo.name || "");
        }
      } else if (photo && (photo.id || photo.name)) {
        // meta-only entry: do NOT render the default image in the upload
        // preview. Keep the preview area empty (will show '暂无图片'). This
        // prevents the project-included ./1.svg from appearing inside the
        //现场图片上传区 while still allowing the traceability view to use it.
        // no-op
      }
    });
    // 如果循环结束后没有任何预览被加入（例如所有条目都是 meta-only 或者被过滤掉），
    // 则显示默认的“暂无图片”占位，保证上传区不会留空白。
    if (photoPreviewContainer.children.length === 0) {
      photoPreviewContainer.innerHTML =
        '<div class="text-sm text-gray-400 text-center py-4">暂无图片</div>';
    }
  }

  function renderBatteryRecords(orderNo) {
    const list = document.getElementById("batteryRecordList");
    try {
      const allBatteryData = JSON.parse(
        localStorage.getItem("workOrderBatteryData") || "{}",
      );
      const orderBatteryData = allBatteryData[orderNo] || [];

      if (orderBatteryData.length === 0) {
        list.innerHTML =
          '<div class="text-sm text-gray-400 text-center py-2">暂无记录</div>';
        return;
      }

      list.innerHTML = "";
      orderBatteryData.forEach((batch, batchIndex) => {
        const batchDiv = document.createElement("div");
        batchDiv.className = "mb-4 border rounded p-3";

        const batchHeader = document.createElement("div");
        batchHeader.className = "flex justify-between items-center mb-2";
        batchHeader.innerHTML = `
          <span class="text-sm font-medium text-gray-700">检测时间: ${batch.time}</span>
          ${batch.remark ? `<span class="text-xs text-gray-500">备注: ${batch.remark}</span>` : ""}
        `;
        batchDiv.appendChild(batchHeader);

        const table = document.createElement("table");
        table.className = "w-full text-sm border-collapse";
        table.innerHTML = `
          <thead>
            <tr class="border-b">
              <th class="text-left py-1 px-2">序号</th>
              <th class="text-left py-1 px-2">电池类型</th>
              <th class="text-left py-1 px-2">电压(mV)</th>
              <th class="text-left py-1 px-2">电阻(Ω)</th>
              <th class="text-left py-1 px-2">容量(mAh)</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");
        batch.batteries.forEach((battery, index) => {
          const tr = document.createElement("tr");
          tr.className = "border-b";
          tr.innerHTML = `
            <td class="py-1 px-2">${index + 1}</td>
            <td class="py-1 px-2">${battery.type}</td>
            <td class="py-1 px-2">${battery.voltage}</td>
            <td class="py-1 px-2">${battery.resistance}</td>
            <td class="py-1 px-2">${battery.capacity}</td>
          `;
          tbody.appendChild(tr);
        });

        batchDiv.appendChild(table);
        list.appendChild(batchDiv);
      });
    } catch (e) {
      console.warn("加载电池检测历史记录失败：", e);
      list.innerHTML =
        '<div class="text-sm text-gray-400 text-center py-2">加载记录失败</div>';
    }
  }

  /**
   * 在电池明细表中追加一行。
   * 使用方法（控制台或其它脚本中调用）：
   *   addBatteryDetailRow('BAT-123456', '三元锂电池（NCM）', '3.7V/4.2V', '4.8mΩ', '50.2Ah', '合格');
   */
  function addBatteryDetailRow(
    sn,
    type,
    voltage,
    resistance,
    capacity,
    result,
  ) {
    try {
      const container = document.getElementById("batteriesContainer");
      if (!container) return false;
      const table = container.querySelector("table");
      if (!table) return false;
      let tbody = table.querySelector("tbody");
      if (!tbody) {
        tbody = document.createElement("tbody");
        table.appendChild(tbody);
      }

      const tr = document.createElement("tr");
      tr.className = "border-t";
      tr.innerHTML = `
        <td class="py-2 px-3">${sn}</td>
        <td class="py-2 px-3">${type}</td>
        <td class="py-2 px-3">${voltage}</td>
        <td class="py-2 px-3">${resistance}</td>
        <td class="py-2 px-3">${capacity}</td>
        <td class="py-2 px-3">${result}</td>
      `;
      tbody.appendChild(tr);
      return true;
    } catch (e) {
      console.warn("添加电池明细失败：", e);
      return false;
    }
  }

  // 暴露到 window，方便在浏览器控制台直接调用测试
  window.addBatteryDetailRow = addBatteryDetailRow;

  function addPhotoToPreview(photoDataOrEntry, photoName) {
    // Accept either a URL string or an entry object {id,name,blob,mime,timestamp}
    if (photoPreviewContainer.querySelector(".text-gray-400"))
      photoPreviewContainer.innerHTML = "";
    const photoItem = document.createElement("div");
    photoItem.className = "relative border rounded overflow-hidden bg-white";

    let src = "";
    let entry = null;
    if (typeof photoDataOrEntry === "string") {
      src = photoDataOrEntry;
      entry = { id: null, name: photoName || "", url: src };
    } else if (
      photoDataOrEntry &&
      (photoDataOrEntry.blob || photoDataOrEntry.file)
    ) {
      entry = photoDataOrEntry;
      if (!entry.id)
        entry.id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const blob = entry.blob || entry.file;
      try {
        src = URL.createObjectURL(blob);
        photoItem._objectUrl = src;
      } catch (e) {
        src = "";
      }
    } else if (photoDataOrEntry && photoDataOrEntry.url) {
      entry = photoDataOrEntry;
      src = entry.url;
    }

    if (entry) photoItem._photoEntry = entry;

    photoItem.innerHTML = `
      <img src="${src}" alt="${entry ? entry.name : photoName || ""}" class="w-full h-40 object-cover">
      <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
        ${entry ? entry.name : photoName || ""}
      </div>
      <button class="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-red-600 text-white rounded-full hover:bg-red-700 delete-photo-btn">
        <i class="fa-solid fa-xmark text-xs"></i>
      </button>
    `;
    photoPreviewContainer.appendChild(photoItem);
    photoItem
      .querySelector(".delete-photo-btn")
      .addEventListener("click", function () {
        showAppModal(
          `确定删除图片"${entry ? entry.name : photoName || ""}"吗？`,
          "确认操作",
        ).then(() => {
          try {
            if (photoItem._objectUrl) URL.revokeObjectURL(photoItem._objectUrl);
          } catch (e) {}

          // Compute remaining real photo items (elements with class 'relative')
          const remainingBefore =
            photoPreviewContainer.querySelectorAll(".relative").length;

          // Remove the item and update UI based on remaining count
          photoItem.remove();

          const remainingAfter = Math.max(0, remainingBefore - 1);
          if (remainingAfter === 0) {
            photoPreviewContainer.innerHTML =
              '<div class="text-sm text-gray-400 text-center py-4">暂无图片</div>';
          }

          const orderNo =
            document.getElementById("detail-order-no").textContent;
          if (orderNo) {
            const photos = getPhotosFromPreview();
            savePhotosToLocalStorage(orderNo, photos);
          }
        });
      });
  }

  // ========== 事件绑定与交互逻辑（尽量保持原结构） ==========
  const createWorkOrderBtn = document.getElementById("create-work-order-btn");
  const statusFilterSelect = document.getElementById("status-filter");
  const createWorkOrderModal = document.getElementById(
    "create-work-order-modal",
  );
  const closeCreateModalBtn = document.getElementById("close-create-modal-btn");
  const cancelCreateBtn = document.getElementById("cancel-create-btn");
  const createWorkOrderForm = document.getElementById("create-work-order-form");
  const workOrderDetailModal = document.getElementById(
    "work-order-detail-modal",
  );
  const closeModalBtn = document.getElementById("close-modal-btn");
  const closeDetailBtn = document.getElementById("close-detail-btn");
  const batteryInputArea = document.getElementById("battery-input-area");
  const imageUploadArea = document.getElementById("image-upload-area");
  const uploadPhotoBtn = document.getElementById("upload-photo-btn");
  // generateQualityOrdersBtn 已移除（质量工单由清空操作触发）
  const photoFileInput = document.getElementById("photo-file-input");
  const capturePhotoBtn = document.getElementById("capture-photo-btn");
  const photoCaptureInput = document.getElementById("photo-capture-input");
  const photoPreviewContainer = document.getElementById(
    "photo-preview-container",
  );
  const photoOperationArea = document.getElementById("photo-operation-area");

  // 统一处理选中的图片文件（上传区与拍照输入共用）
  function processImageFiles(files, inputEl) {
    if (!files || files.length === 0) return;
    let validCount = 0;
    const orderNo = document.getElementById("detail-order-no").textContent;
    Array.from(files).forEach((file) => {
      if (!file.type || !file.type.startsWith("image/")) return;
      validCount++;
      try {
        const entry = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mime: file.type,
          timestamp: new Date().toISOString(),
          blob: file,
        };
        addPhotoToPreview(entry);
        if (orderNo) {
          const photos = getPhotosFromPreview();
          savePhotosToLocalStorage(orderNo, photos);
        }
      } catch (err) {
        console.warn("处理上传图片失败：", err);
      }
    });
    if (inputEl) inputEl.value = "";
    showAppModal(
      validCount > 0
        ? `成功选择 ${validCount} 张图片！${orderNo ? "已自动保存。" : ""}`
        : "未检测到有效图片文件。",
    );
  }

  // 为质量管理中的按钮添加可调整的样式类，便于通过 CSS 变量快速修改外观
  try {
    const confirmBtnGlobal = document.getElementById("confirmBtn");
    if (confirmBtnGlobal) confirmBtnGlobal.classList.add("confirm-action-btn");
    // 页面底部的 "保存质检结果" 按钮在 #quality 区块内，选择第一个 .btn.btn-primary
    const qualitySaveBtn =
      document.getElementById("save-quality-btn") ||
      document.querySelector("#quality .btn.btn-primary");
    if (qualitySaveBtn) qualitySaveBtn.classList.add("quality-action-btn");
    // 为"导出追溯报告"和"保存质检结果"添加点击提示（保留原有行为）
    const traceExportBtn = document.getElementById("trace-export-btn");
    traceExportBtn?.addEventListener("click", function () {
      showAppModal("正在导出追溯报告，请稍候...");
      // 保留原有导出逻辑（如果存在）——此处只添加提示
    });
    const saveQualityBtnEl = document.getElementById("save-quality-btn");
    saveQualityBtnEl?.addEventListener("click", function () {
      showAppModal("质检结果已保存。");
      // 更新质量追溯的签收情况
      const signStatus = document.getElementById("sign-status");
      if (signStatus) {
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        signStatus.textContent = `已签收 - ${timeStr}`;
      }
      // 保留原有保存逻辑（如果存在）——此处只添加提示
    });
  } catch (e) {
    console.warn("给质量管理按钮添加样式类失败：", e);
  }

  // ========= 追溯区固定工单图片显示 API =========
  // 在 traceability 区块中显示 N 张可点击放大的缩略图。
  // 使用方法（在代码中调用）：
  //   setTraceabilityPhotos([ {url: '...', name: '现场图1'}, 'https://...jpg', ... ])
  // 或者： addTraceabilityPhoto('https://...jpg', '说明')
  window._traceabilityPhotos = window._traceabilityPhotos || [];
  function renderTraceabilityPhotos() {
    try {
      const container = document.getElementById("trace-fixed-photos");
      if (!container) return;

      // 如果追溯图片为空，尝试从localStorage加载LFP250803工单的图片
      if (
        !window._traceabilityPhotos ||
        window._traceabilityPhotos.length === 0
      ) {
        const lfpPhotos = loadPhotosFromLocalStorage("LFP250803");
        if (lfpPhotos && lfpPhotos.length > 0) {
          window._traceabilityPhotos = lfpPhotos;
        }
      }

      const photos = window._traceabilityPhotos || [];
      container.innerHTML = "";

      if (!photos || photos.length === 0) {
        // 当没有图片时，显示1.svg
        const defaultPhoto = { url: "./1.svg", name: "默认图片" };
        photos.push(defaultPhoto);
      }

      const grid = document.createElement("div");
      grid.className = "trace-photo-grid";
      photos.forEach((p, idx) => {
        const item = document.createElement("div");
        item.className = "trace-photo-item";
        const img = document.createElement("img");
        img.loading = "lazy";
        let name = "";
        // Determine src: support string URL, object with url, or object with blob/file
        if (typeof p === "string") {
          img.src = p;
          name = "";
        } else if (p && p.url) {
          img.src = p.url;
          name = p.name || "";
        } else if (p && (p.blob || p.file)) {
          try {
            const blob = p.blob || p.file;
            const objectUrl = URL.createObjectURL(blob);
            img.src = objectUrl;
            // store objectUrl to revoke later if needed
            img._objectUrl = objectUrl;
            name = p.name || "";
          } catch (e) {
            img.src = "./1.svg";
            name = p.name || "";
          }
        } else {
          img.src = "./1.svg";
        }
        img.alt = name || `追溯图片 ${idx + 1}`;
        img.addEventListener("click", function () {
          showAppModal(
            `<div style="text-align:center;"><img src="${img.src}" style="max-width:100%;height:auto;border-radius:8px;"><div class=\"text-sm text-gray-500 mt-2\">${name || ""}</div></div>`,
            "图片预览",
          );
        });
        item.appendChild(img);
        grid.appendChild(item);
      });
      container.appendChild(grid);
      // 添加固定的"图片"标题
      const title = document.createElement("div");
      title.className = "trace-photo-caption";
      title.textContent = "图片";
      container.appendChild(title);

      // 更新上传图片数量（排除1.svg）
      const uploadPhotoCount = document.getElementById("upload-photo-count");
      if (uploadPhotoCount) {
        // 只统计真实上传的图片：
        // - 包含 blob/file 的条目视为真实图片
        // - 有非空 url 且不是默认 ./1.svg 的条目也视为真实图片
        const countWithoutDefault = (photos || []).filter((p) => {
          try {
            if (!p) return false;
            if (typeof p === "string") return !p.includes("1.svg");
            if (p.blob || p.file) return true;
            const url = p.url || "";
            return url !== "" && !url.includes("1.svg");
          } catch (e) {
            return false;
          }
        }).length;
        uploadPhotoCount.textContent = `${countWithoutDefault}张`;
      }

      // 更新生产时间，与工单管理的LFP250803工单的创立时间挂钩
      const workOrders = loadAllWorkOrders();
      const lfpOrder = workOrders["LFP250803"];
      if (lfpOrder && lfpOrder.createTime) {
        const productionTime = document.getElementById("production-time");
        if (productionTime) {
          productionTime.textContent = lfpOrder.createTime;
        }
      }
    } catch (e) {
      console.warn("渲染追溯图片失败：", e);
    }
  }

  window.setTraceabilityPhotos = function (photos) {
    window._traceabilityPhotos = Array.isArray(photos) ? photos : [];
    renderTraceabilityPhotos();
  };

  window.addTraceabilityPhoto = function (photo, name) {
    const entry =
      typeof photo === "string" ? (name ? { url: photo, name } : photo) : photo;
    window._traceabilityPhotos = window._traceabilityPhotos || [];
    window._traceabilityPhotos.push(entry);
    renderTraceabilityPhotos();
  };

  // 初始渲染（如果代码中已设置 window._traceabilityPhotos）
  try {
    renderTraceabilityPhotos();
  } catch (e) {}

  // --- 示例：尝试加载项目根目录下的 ./1.svg（如果存在会优先显示），否则展示内嵌示例图 ---
  try {
    // 这里调用 setTraceabilityPhotos 用于示范。你可以在代码任意位置替换或移除此示例。
    window.setTraceabilityPhotos([
      { url: "./1.svg", name: "示例 - 1.svg (已添加到项目中)" },
    ]);
  } catch (e) {
    console.warn("示例图片设置失败：", e);
  }

  function openCreateWorkOrderModal() {
    createWorkOrderModal.classList.remove("hidden");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formattedDate = tomorrow.toISOString().slice(0, 16);
    createWorkOrderForm.querySelector('input[name="deadline"]').value =
      formattedDate;
  }

  // 支持 click 与 touchstart 双触发（在某些嵌入式 WebView 中，click 可能延迟或不触发）
  createWorkOrderBtn?.addEventListener("click", openCreateWorkOrderModal);
  createWorkOrderBtn?.addEventListener("touchstart", function (e) {
    // 阻止可能的双触发（浏览器会在 touchend 后触发 click）
    e.preventDefault();
    openCreateWorkOrderModal();
  });
  // 生成质量工单按钮事件处理已删除（由清空操作统一触发）
  document
    .getElementById("toggle-detail-collapse-btn")
    ?.addEventListener("click", function () {
      try {
        toggleTraceDetailCollapse();
      } catch (e) {
        console.warn("切换追溯详情折叠状态失败：", e);
      }
    });
  statusFilterSelect?.addEventListener("change", function () {
    currentStatusFilter = this.value || "all";
    currentPage = 1;
    renderWorkOrders();
  });

  function closeCreateModal() {
    createWorkOrderModal.classList.add("hidden");
    createWorkOrderForm.reset();
  }
  closeCreateModalBtn?.addEventListener("click", closeCreateModal);
  cancelCreateBtn?.addEventListener("click", closeCreateModal);

  createWorkOrderForm?.addEventListener("submit", function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    const productName = formData.get("productName");
    const productionLine = formData.get("productionLine");
    const planQuantity = formData.get("planQuantity");
    const unit = formData.get("unit");
    const priority = formData.get("priority");
    const deadline = formData.get("deadline");

    // 检查是否是固定工单 LFP250803
    const workOrders = loadAllWorkOrders();
    const isFixedOrder =
      productName === "电池包组装" &&
      productionLine === "电池包组装线1" &&
      planQuantity == 1;

    let orderNo;
    let newOrder;

    if (isFixedOrder) {
      // 使用固定工单 LFP250803
      orderNo = "LFP250803";
      const deadlineDate = new Date(deadline);
      const formattedDeadline = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, "0")}-${String(deadlineDate.getDate()).padStart(2, "0")} ${String(deadlineDate.getHours()).padStart(2, "0")}:${String(deadlineDate.getMinutes()).padStart(2, "0")}`;
      const now = new Date();
      const createTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      newOrder = {
        orderNo: orderNo,
        productName: productName,
        productionLine: productionLine,
        planQuantity: planQuantity,
        unit: unit,
        priority: priority,
        deadline: formattedDeadline,
        createTime: createTime,
        status: "pending",
        completedQuantity: 0,
      };
    } else {
      // 使用普通工单
      orderNo = generateOrderNo();
      const deadlineDate = new Date(deadline);
      const formattedDeadline = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth() + 1).padStart(2, "0")}-${String(deadlineDate.getDate()).padStart(2, "0")} ${String(deadlineDate.getHours()).padStart(2, "0")}:${String(deadlineDate.getMinutes()).padStart(2, "0")}`;
      const now = new Date();
      const createTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      newOrder = {
        orderNo: orderNo,
        productName: productName,
        productionLine: productionLine,
        planQuantity: planQuantity,
        unit: unit,
        priority: priority,
        deadline: formattedDeadline,
        createTime: createTime,
        status: "pending",
      };
    }

    workOrders[orderNo] = newOrder;
    saveAllWorkOrders(workOrders);
    renderWorkOrders();
    closeCreateModal();
    showAppModal(`工单创建成功！工单号：${orderNo}`);
  });

  document.addEventListener("click", function (e) {
    const viewBtn = e.target.closest && e.target.closest(".view-btn");
    if (viewBtn) {
      const orderId = viewBtn.getAttribute("data-id");
      const row = document.querySelector(`tr[data-id="${orderId}"]`);
      if (!row) return;
      const orderStatus = row.getAttribute("data-status");
      if (orderStatus === "pending") {
        showAppModal("该工单尚未派发，无法填写数据！请先点击「派发」按钮。");
        return;
      } else if (orderStatus === "completed") {
        showAppModal("该工单已完成，仅可查看历史记录，无法修改/新增数据！");
        document.getElementById("modal-title").textContent =
          `工单生产操作 - ${row.cells[1].textContent}`;
        document.getElementById("detail-order-no").textContent = orderId;
        document.getElementById("detail-product-name").textContent =
          row.cells[1].textContent;
        batteryInputArea.classList.add("hidden");
        photoOperationArea.classList.add("hidden");
        imageUploadArea.classList.remove("hidden");
        workOrderDetailModal.classList.remove("hidden");
        if (orderId) {
          const historyPhotos = loadPhotosFromLocalStorage(orderId);
          renderHistoryPhotos(historyPhotos);
          renderBatteryRecords(orderId);
          // 更新截止时间
          const workOrders = loadAllWorkOrders();
          const order =
            workOrders && workOrders[orderId] ? workOrders[orderId] : null;
          if (order && order.deadline) {
            const detailDeadlineEl = document.getElementById("detail-deadline");
            if (detailDeadlineEl) {
              detailDeadlineEl.textContent = order.deadline;
            }
          }
          try {
            updateDetailViewForOrder(orderId);
          } catch (e) {
            console.warn(
              "updateDetailViewForOrder failed on open(completed):",
              e,
            );
          }
        }
      } else if (orderStatus === "cancelled") {
        showAppModal("该工单已取消，无法查看/填写数据！");
        return;
      } else {
        document.getElementById("modal-title").textContent =
          `工单生产操作 - ${row.cells[1].textContent}`;
        document.getElementById("detail-order-no").textContent = orderId;
        document.getElementById("detail-product-name").textContent =
          row.cells[1].textContent;
        batteryInputArea.classList.remove("hidden");
        photoOperationArea.classList.remove("hidden");
        imageUploadArea.classList.remove("hidden");
        workOrderDetailModal.classList.remove("hidden");
        if (orderId) {
          const historyPhotos = loadPhotosFromLocalStorage(orderId);
          renderHistoryPhotos(historyPhotos);
          renderBatteryRecords(orderId);
          // 更新截止时间
          const workOrders = loadAllWorkOrders();
          const order =
            workOrders && workOrders[orderId] ? workOrders[orderId] : null;
          if (order && order.deadline) {
            const detailDeadlineEl = document.getElementById("detail-deadline");
            if (detailDeadlineEl) {
              detailDeadlineEl.textContent = order.deadline;
            }
          }
          try {
            updateDetailViewForOrder(orderId);
          } catch (e) {
            console.warn("updateDetailViewForOrder failed on open:", e);
          }
        }
      }
    }
  });

  function closeDetailModal() {
    workOrderDetailModal.classList.add("hidden");
    photoPreviewContainer.innerHTML =
      '<div class="text-sm text-gray-400 text-center py-4">暂无图片</div>';
    document.getElementById("batteryRecordList").innerHTML =
      '<div class="text-sm text-gray-400 text-center py-2">暂无记录</div>';
  }
  closeModalBtn?.addEventListener("click", closeDetailModal);
  closeDetailBtn?.addEventListener("click", closeDetailModal);

  document
    .getElementById("addBatteryRow")
    ?.addEventListener("click", function () {
      const container = document.getElementById("batteryFormContainer");
      const newRow = document.createElement("div");
      newRow.className = "battery-row grid grid-cols-1 md:grid-cols-2 gap-4";
      newRow.innerHTML = `\n      <div>\n        <label class="block text-sm mb-1">电池类型</label>\n        <select class="w-full border p-2 rounded battery-type">\n          <option value="三元锂电池">三元锂电池</option>\n          <option value="磷酸铁锂电池">磷酸铁锂电池</option>\n          <option value="锰酸锂电池">锰酸锂电池</option>\n          <option value="钴酸锂电池">钴酸锂电池</option>\n        </select>\n        <label class="block text-sm mt-2 mb-1">电池容量 (mAh)</label>\n        <input type="number" step="1" placeholder="例如：5000" class="w-full border p-2 rounded battery-capacity mb-2">\n      </div>\n      <div>\n        <div class="flex items-center justify-between">\n          <label class="block text-sm mb-1">电池电压 (V)</label>\n          <button type="button" class="text-red-600 hover:text-red-800 text-sm remove-battery-row">\n            <i class="fa-solid fa-minus-circle"></i> 删除\n          </button>\n        </div>\n        <input  type="number"  step="0.001"  placeholder="例如：3750 (mV) 或 3.75 (V)"  class="w-full border p-2 rounded battery-voltage mb-2">\n        <label class="block text-sm mb-1">电池电阻 (Ω)</label>\n        <input  type="number"  step="0.001"  placeholder="例如：0.025"  class="w-full border p-2 rounded battery-resistance">\n      </div>\n    `;
      container.appendChild(newRow);
      newRow
        .querySelector(".remove-battery-row")
        .addEventListener("click", function () {
          newRow.remove();
        });
    });

  document
    .getElementById("submitBatteryData")
    ?.addEventListener("click", function () {
      const orderNo = document.getElementById("detail-order-no").textContent;
      if (!orderNo) {
        showAppModal("无法获取工单号，数据保存失败！");
        return;
      }
      const batteryTypes = document.querySelectorAll(".battery-type");
      const batteryVoltages = document.querySelectorAll(".battery-voltage");
      const batteryResistances = document.querySelectorAll(
        ".battery-resistance",
      );
      const batteryRemark = document.querySelector(".battery-remark").value;
      let hasEmptyValue = false;
      batteryVoltages.forEach((v) => {
        if (!v.value) hasEmptyValue = true;
      });
      batteryResistances.forEach((r) => {
        if (!r.value) hasEmptyValue = true;
      });
      const batteryCapacities = document.querySelectorAll(".battery-capacity");
      batteryCapacities.forEach((c) => {
        if (!c.value) hasEmptyValue = true;
      });
      if (hasEmptyValue) {
        showAppModal("请填写所有电池的电压、电阻和容量值！");
        return;
      }
      const now = new Date();
      const timeStr = now.toLocaleString();
      const batteryBatch = {
        time: timeStr,
        batteries: [],
        remark: batteryRemark,
      };
      batteryTypes.forEach((typeSelect, index) => {
        const type = typeSelect.value;
        const originalVoltage = batteryVoltages[index].value;
        const convertedVoltage =
          parseFloat(originalVoltage) >= 100
            ? parseFloat(originalVoltage).toFixed(0)
            : (parseFloat(originalVoltage) * 1000).toFixed(0);
        const resistance = batteryResistances[index].value;
        const capacity =
          document.querySelectorAll(".battery-capacity")[index]?.value || "";
        batteryBatch.batteries.push({
          type: type,
          voltage: convertedVoltage,
          resistance: resistance,
          capacity: capacity,
        });
      });
      const photos = getPhotosFromPreview();
      savePhotosToLocalStorage(orderNo, photos);
      saveBatteryDataToLocalStorage(orderNo, batteryBatch);
      renderBatteryRecords(orderNo);
      batteryVoltages.forEach((i) => (i.value = ""));
      batteryResistances.forEach((i) => (i.value = ""));
      document
        .querySelectorAll(".battery-capacity")
        .forEach((i) => (i.value = ""));
      document.querySelector(".battery-remark").value = "";
      showAppModal("电池检测数据和图片已保存成功！（电压已统一为mV单位）");
    });

  // 摄像头拍照功能已移除；保留上传图片功能
  // 点击“上传图片”触发文件选择；拍照上传触发带 capture 的 file input
  uploadPhotoBtn?.addEventListener("click", function () {
    photoFileInput && photoFileInput.click();
  });
  photoFileInput?.addEventListener("change", function (e) {
    processImageFiles(e.target.files, photoFileInput);
  });

  // 拍照上传（移动设备会打开原生相机）
  capturePhotoBtn?.addEventListener("click", function () {
    photoCaptureInput && photoCaptureInput.click();
  });
  photoCaptureInput?.addEventListener("change", function (e) {
    processImageFiles(e.target.files, photoCaptureInput);
  });

  function getStatusBadge(status) {
    const map = {
      pending:
        '<span class="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">待派发</span>',
      processing:
        '<span class="px-2 py-1 text-xs rounded-full bg-warning/10 text-warning">生产中</span>',
      paused:
        '<span class="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-600">已暂停</span>',
      completed:
        '<span class="px-2 py-1 text-xs rounded-full bg-success/10 text-success">已完成</span>',
      cancelled:
        '<span class="px-2 py-1 text-xs rounded-full bg-danger/10 text-danger">已取消</span>',
    };
    return map[status] || status;
  }

  function updateDetailViewForOrder(orderId, forceStatus) {
    try {
      const detailModal = document.getElementById("work-order-detail-modal");
      const detailOrderNoEl = document.getElementById("detail-order-no");
      const detailStatusEl = document.getElementById("detail-status");
      const detailDeadlineEl = document.getElementById("detail-deadline");
      const remarkArea = document.getElementById("detail-remark-area");
      const submitBtn = document.getElementById("submitBatteryData");
      if (
        detailModal &&
        !detailModal.classList.contains("hidden") &&
        detailOrderNoEl
      ) {
        const shownOrderNo = (detailOrderNoEl.textContent || "").trim();
        if (
          shownOrderNo &&
          (shownOrderNo === orderId || shownOrderNo.includes(orderId))
        ) {
          const workOrders = loadAllWorkOrders();
          const order =
            workOrders && workOrders[orderId] ? workOrders[orderId] : null;
          const status = forceStatus || (order ? order.status : null);

          // 统一处理状态为已完成或已取消的情况
          if (status === "completed" || status === "cancelled") {
            if (remarkArea) remarkArea.style.display = "none";
            if (submitBtn) {
              submitBtn.style.display = "none";
              submitBtn.disabled = true;
            }
          } else {
            if (remarkArea) remarkArea.style.display = "block";
            if (submitBtn) {
              submitBtn.style.display = "inline-block";
              submitBtn.disabled = false;
            }
          }

          // 更新状态显示
          if (detailStatusEl && status)
            detailStatusEl.innerHTML = getStatusBadge(status);

          // 更新截止时间
          if (detailDeadlineEl && order && order.deadline) {
            detailDeadlineEl.textContent = order.deadline;
          }
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn("updateDetailViewForOrder error:", err);
      return false;
    }
  }

  document.addEventListener("click", function (e) {
    const workOrders = loadAllWorkOrders();
    const dispatchEl = e.target.closest && e.target.closest(".dispatch-btn");
    const pauseEl = e.target.closest && e.target.closest(".pause-btn");
    const resumeEl = e.target.closest && e.target.closest(".resume-btn");
    const completeEl = e.target.closest && e.target.closest(".complete-btn");
    const cancelEl = e.target.closest && e.target.closest(".cancel-btn");

    // 使用统一的处理函数替代重复代码
    handleOrderAction(dispatchEl, "dispatch", workOrders);
    handleOrderAction(pauseEl, "pause", workOrders);
    handleOrderAction(resumeEl, "resume", workOrders);
    handleOrderAction(completeEl, "complete", workOrders);
    handleOrderAction(cancelEl, "cancel", workOrders);
  });

  // 新增统一的订单操作处理函数
  function handleOrderAction(element, action, workOrders) {
    if (element) {
      const orderId = element.getAttribute("data-id");
      const actionConfig = {
        dispatch: {
          status: "processing",
          confirmMsg: `确定派发工单 ${orderId} 吗？派发后可进入详情页填写生产数据！`,
          successMsg: `工单 ${orderId} 派发成功！现在可点击「详情」按钮填写生产数据。`,
          additionalActions: () => {
            savePhotosToLocalStorage(orderId, []);
          },
        },
        pause: {
          status: "paused",
          confirmMsg: `确定暂停工单 ${orderId} 吗？暂停后仍可查看/编辑已填写数据！`,
          successMsg: `工单 ${orderId} 已暂停。`,
        },
        resume: {
          status: "processing",
          confirmMsg: `确定恢复工单 ${orderId} 吗？`,
          successMsg: `工单 ${orderId} 已恢复。`,
        },
        complete: {
          status: "completed",
          confirmMsg: `确定标记工单 ${orderId} 为已完成吗？完成后将无法修改数据！`,
          successMsg: `工单 ${orderId} 已标记为完成，所有数据（包括图片和电池数据）已保存！`,
          additionalActions: () => {
            updateDetailViewForOrder(orderId, "completed");
          },
        },
        cancel: {
          status: "cancelled",
          confirmMsg: `确定取消工单 ${orderId} 吗？此操作不可恢复！`,
          successMsg: `工单 ${orderId} 已取消。`,
        },
      };

      const config = actionConfig[action];
      if (workOrders[orderId] && confirm(config.confirmMsg)) {
        workOrders[orderId].status = config.status;
        saveAllWorkOrders(workOrders);

        if (config.additionalActions) {
          config.additionalActions();
        }

        renderWorkOrders();
        showAppModal(config.successMsg);
      }
    }
  }

  document
    .getElementById("clear-all-work-orders")
    ?.addEventListener("click", function () {
      if (
        !confirm(
          "⚠️ 确定要清空【所有工单 + 所有图片记录】吗？此操作不可恢复！清空后会自动生成 " +
            AUTO_GENERATE_ORDERS +
            " 条测试工单。",
        )
      )
        return;
      if (!confirm("⚠️ 再次确认：清空后所有数据将永久丢失，是否继续？")) return;
      // 清空所有持久化数据（含质量工单）
      clearAllData();
      // 重新渲染（renderWorkOrders 内会在无存储时根据 AUTO_GENERATE_ORDERS 自动生成测试工单）
      renderWorkOrders();
      // 根据最新（自动生成或手动）工单同步生成质量工单并渲染
      let genCount = 0;
      try {
        genCount = generateQualityOrdersFromWorkOrders();
      } catch (e) {
        console.warn("生成质量工单失败：", e);
      }
      renderQualityOrders();

      // 更新质量追溯的生产时间，与工单管理的LFP250803工单的创立时间挂钩
      const workOrders = loadAllWorkOrders();
      const lfpOrder =
        workOrders && workOrders["LFP250803"] ? workOrders["LFP250803"] : null;
      if (lfpOrder && lfpOrder.createTime) {
        const productionTime = document.getElementById("production-time");
        if (productionTime) {
          productionTime.textContent = lfpOrder.createTime;
        }
      }

      // 重置签收情况为未签收状态
      const signStatus = document.getElementById("sign-status");
      if (signStatus) {
        signStatus.textContent = "未签收";
      }

      // 重置质量追溯图片显示区域为1.svg
      window._traceabilityPhotos = [{ url: "./1.svg", name: "默认图片" }];
      renderTraceabilityPhotos();

      showAppModal(
        `✅ 所有工单与图片已清空完成！\n✅ 已自动生成 ${AUTO_GENERATE_ORDERS} 条测试工单，并已同步生成 ${genCount} 条质量追溯工单（与工单管理数量对应）。`,
      );
    });

  try {
    renderWorkOrders();
    try {
      renderQualityOrders();
    } catch (e) {
      console.warn("渲染质量工单失败：", e);
    }
  } catch (e) {
    console.error("首次渲染工单失败：", e);
  }
});
