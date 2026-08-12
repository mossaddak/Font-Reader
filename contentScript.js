(function () {
  if (window.__fontReaderContentScriptInstalled) {
    return;
  }
  window.__fontReaderContentScriptInstalled = true;

  let selectedElement = null;
  let selectedText = "";
  let selectionModeActive = false;
  let selectionBanner = null;
  let highlightPanel = null;
  let panelDragState = null;

  function getSelectionElement() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const anchor = selection.anchorNode || selection.focusNode;
      if (anchor) {
        return anchor.nodeType === Node.ELEMENT_NODE
          ? anchor
          : anchor.parentElement;
      }
    }
    return null;
  }

  function getBestTargetElement() {
    const active = document.activeElement;
    const selectionElement = getSelectionElement();

    if (selectedElement) {
      return selectedElement;
    }

    if (
      active &&
      active !== document.body &&
      active !== document.documentElement
    ) {
      return active;
    }

    if (selectionElement) {
      return selectionElement;
    }

    return (
      document.elementFromPoint(
        window.innerWidth / 2,
        window.innerHeight / 2,
      ) || document.body
    );
  }

  function normalizeText(value) {
    if (!value) return "unknown";
    return value.trim().replace(/\s{2,}/g, " ");
  }

  function isValidHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value);
  }

  function normalizeColor(value) {
    if (!value) return "unknown";
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return value;
      ctx.fillStyle = value;
      const computed = ctx.fillStyle.toString().trim();
      const rgb = computed.match(/\d+/g);
      if (computed.startsWith("#")) {
        const normalized = computed.toLowerCase();
        return isValidHexColor(normalized) ? normalized : "unknown";
      }
      if (rgb && rgb.length >= 3) {
        return (
          "#" +
          [rgb[0], rgb[1], rgb[2]]
            .map((channel) => Number(channel).toString(16).padStart(2, "0"))
            .join("")
        );
      }
    } catch (error) {
      return "unknown";
    }
    return "unknown";
  }

  function getFontInfo() {
    const targetElement = getBestTargetElement();
    const style = targetElement ? window.getComputedStyle(targetElement) : null;
    const selector = targetElement
      ? `${targetElement.tagName.toLowerCase()}${targetElement.id ? `#${targetElement.id}` : ""}${targetElement.className ? `.${String(targetElement.className).trim().replace(/\s+/g, ".")}` : ""}`
      : "unknown";

    return {
      found: !!style,
      selectedText: selectedText || "none",
      fontFamily: normalizeText(style?.fontFamily),
      fontSize: style?.fontSize || "unknown",
      fontWeight: style?.fontWeight || "unknown",
      fontStyle: style?.fontStyle || "unknown",
      textDecoration: style?.textDecoration || "unknown",
      textTransform: style?.textTransform || "unknown",
      color: normalizeColor(style?.color || "unknown"),
      lineHeight: style?.lineHeight || "unknown",
      letterSpacing: style?.letterSpacing || "unknown",
      selector,
    };
  }

  function showInstructionBanner() {
    if (selectionBanner) return;
    selectionBanner = document.createElement("div");
    selectionBanner.style.position = "fixed";
    selectionBanner.style.left = "16px";
    selectionBanner.style.top = "16px";
    selectionBanner.style.zIndex = "2147483647";
    selectionBanner.style.padding = "10px 14px";
    selectionBanner.style.background = "rgba(0, 112, 244, 0.95)";
    selectionBanner.style.color = "white";
    selectionBanner.style.fontSize = "13px";
    selectionBanner.style.borderRadius = "10px";
    selectionBanner.style.boxShadow = "0 10px 25px rgba(0,0,0,0.25)";
    selectionBanner.style.fontFamily = "system-ui, sans-serif";
    selectionBanner.textContent =
      "Select text or click an element to view font info. Press Esc to cancel.";
    document.documentElement.appendChild(selectionBanner);
  }

  function removeInstructionBanner() {
    if (!selectionBanner) return;
    selectionBanner.remove();
    selectionBanner = null;
  }

  function onPageMouseUp(event) {
    if (!selectionModeActive) return;

    if (highlightPanel && highlightPanel.contains(event.target)) {
      return;
    }

    const selection = window.getSelection();
    const selected = selection?.toString().trim() || "";
    if (!selected) {
      selectedElement = null;
      selectedText = "";
      return;
    }

    selectedText = selected;
    const anchor = selection.anchorNode || selection.focusNode;
    const targetElement =
      anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    if (!targetElement) {
      selectedElement = null;
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    let x = event.clientX;
    let y = event.clientY;
    if (rect && rect.width > 0) {
      x = rect.right;
      y = rect.top;
    }

    selectedElement = targetElement;
    showHighlightPanel(x, y, getFontInfo());
  }

  function onSelectionChange() {
    if (!selectionModeActive) return;
    const selection = window.getSelection();
    const selected = selection?.toString().trim() || "";
    if (!selected) return;

    const anchor = selection.anchorNode || selection.focusNode;
    if (highlightPanel && anchor && highlightPanel.contains(anchor)) {
      return;
    }

    selectedText = selected;
    const targetElement =
      anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    if (!targetElement) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    let x = rect.right;
    let y = rect.top;

    if (targetElement) {
      selectedElement = targetElement;
      showHighlightPanel(x, y, getFontInfo());
    }
  }

  function onPageKeyDown(event) {
    if (selectionModeActive && event.key === "Escape") {
      event.preventDefault();
      stopSelectionMode();
    }
  }

  function startSelectionMode() {
    if (selectionModeActive) return;
    selectionModeActive = true;
    selectedElement = null;
    selectedText = "";
    document.addEventListener("mouseup", onPageMouseUp, true);
    document.addEventListener("selectionchange", onSelectionChange, true);
    document.addEventListener("keydown", onPageKeyDown, true);
    showInstructionBanner();
  }

  function stopSelectionMode() {
    if (!selectionModeActive) return;
    selectionModeActive = false;
    document.removeEventListener("mouseup", onPageMouseUp, true);
    document.removeEventListener("selectionchange", onSelectionChange, true);
    document.removeEventListener("keydown", onPageKeyDown, true);
    removeInstructionBanner();
  }

  function formatFontInfoText(info) {
    return [
      info.selectedText && info.selectedText !== "none"
        ? `Text: ${info.selectedText}`
        : null,
      `Font family: ${info.fontFamily}`,
      `Font size: ${info.fontSize}`,
      `Color: ${info.color}`,
      `Weight: ${info.fontWeight}`,
      `Style: ${info.fontStyle}`,
      `Decoration: ${info.textDecoration}`,
      `Transform: ${info.textTransform}`,
      `Line height: ${info.lineHeight}`,
      `Letter spacing: ${info.letterSpacing}`,
      `Element: ${info.selector}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function showHighlightPanel(x, y, info) {
    if (highlightPanel) {
      highlightPanel.remove();
    }

    highlightPanel = document.createElement("div");
    highlightPanel.style.position = "fixed";
    highlightPanel.style.left = `${x + 12}px`;
    highlightPanel.style.top = `${y + 12}px`;
    highlightPanel.style.zIndex = "2147483648";
    highlightPanel.style.maxWidth = "360px";
    highlightPanel.style.minWidth = "240px";
    highlightPanel.style.padding = "14px";
    highlightPanel.style.background = "rgba(16, 24, 40, 0.98)";
    highlightPanel.style.color = "white";
    highlightPanel.style.fontSize = "12px";
    highlightPanel.style.borderRadius = "14px";
    highlightPanel.style.boxShadow = "0 18px 48px rgba(0,0,0,0.35)";
    highlightPanel.style.lineHeight = "1.4";
    highlightPanel.style.fontFamily = "'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif";
    highlightPanel.style.pointerEvents = "auto";
    highlightPanel.style.boxSizing = "border-box";
    highlightPanel.style.userSelect = "auto";
    highlightPanel.style.cursor = "default";

    const detailsText = formatFontInfoText(info);
    const safeColor = isValidHexColor(info.color) ? info.color : "#000000";

    highlightPanel.innerHTML = `
    <div id="font-reader-header" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:10px; cursor:grab; user-select:none;">
      <div style="font-weight:700; font-size:13px;">Font Reader result</div>
      <button id="font-reader-close" style="border:none; background:transparent; color:#e2e8f0; cursor:pointer; font-size:14px; line-height:1;">✕</button>
    </div>
    <div style="display:grid; gap:8px; margin-bottom:10px; cursor:text;">
      ${info.selectedText && info.selectedText !== "none" ? `<div style="color:#e2e8f0;">Text: ${info.selectedText}</div>` : ""}
      <div style="color:#e2e8f0;">Font family: ${info.fontFamily}</div>
      <div style="color:#e2e8f0;">Font size: ${info.fontSize}</div>
      <div style="display:flex; align-items:center; gap:8px; color:#e2e8f0;">
        <span>Color:</span>
        <code style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:6px; font-size:11px;">${info.color}</code>
        <input type="color" value="${safeColor}" disabled style="width:28px; height:28px; border:none; padding:0; background:transparent; cursor:default;" />
      </div>
      <div style="color:#a5b4fc; font-size:11px;">Tip: select any text below and copy it manually.</div>
      <div style="color:#e2e8f0;">Weight: ${info.fontWeight}</div>
      <div style="color:#e2e8f0;">Style: ${info.fontStyle}</div>
      <div style="color:#e2e8f0;">Decoration: ${info.textDecoration}</div>
      <div style="color:#e2e8f0;">Transform: ${info.textTransform}</div>
      <div style="color:#e2e8f0;">Line height: ${info.lineHeight}</div>
      <div style="color:#e2e8f0;">Letter spacing: ${info.letterSpacing}</div>
      <div style="color:#e2e8f0;">Element: ${info.selector}</div>
    </div>
    <textarea id="font-reader-clipboard" readonly style="width:100%; min-height:140px; margin:0 0 10px 0; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:11px; color:#e2e8f0; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:10px; resize:none; overflow:auto; white-space:pre-wrap; outline:none;">${detailsText}</textarea>
    <button id="font-reader-copy" style="width:100%; padding:8px 12px; border:none; border-radius:10px; background:#0284c7; color:white; cursor:pointer; font-size:12px;">Copy info</button>
  `;

    document.body.appendChild(highlightPanel);

    const copyButton = highlightPanel.querySelector("#font-reader-copy");
    const closeButton = highlightPanel.querySelector("#font-reader-close");
    const copyText = formatFontInfoText(info);

    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(copyText);
          copyButton.textContent = "Copied!";
          setTimeout(() => {
            if (copyButton) copyButton.textContent = "Copy info";
          }, 1500);
        } catch (error) {
          copyButton.textContent = "Copy failed";
        }
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        if (highlightPanel) {
          highlightPanel.remove();
          highlightPanel = null;
        }
      });
    }

    const header = highlightPanel.querySelector("#font-reader-header");
    if (header) {
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let panelStartLeft = 0;
      let panelStartTop = 0;

      header.addEventListener("mousedown", (event) => {
        if (event.target && (event.target.id === "font-reader-close" || event.target.closest("button"))) {
          return;
        }
        if (event.button !== 2 && event.button !== 0) {
          return;
        }
        event.preventDefault();
        isDragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        panelStartLeft = highlightPanel.getBoundingClientRect().left;
        panelStartTop = highlightPanel.getBoundingClientRect().top;
        header.style.cursor = "grabbing";
      });

      window.addEventListener("mousemove", (event) => {
        if (!isDragging || !highlightPanel) {
          return;
        }
        const deltaX = event.clientX - dragStartX;
        const deltaY = event.clientY - dragStartY;
        highlightPanel.style.left = `${panelStartLeft + deltaX}px`;
        highlightPanel.style.top = `${panelStartTop + deltaY}px`;
      });

      window.addEventListener("mouseup", (event) => {
        if (!isDragging) {
          return;
        }
        isDragging = false;
        header.style.cursor = "grab";
      });

      header.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });
    }

    setTimeout(() => {
      if (highlightPanel) {
        highlightPanel.remove();
        highlightPanel = null;
      }
    }, 10000);
  }

  function exposeFontReader() {
    window.fontReader = window.fontReader || {
      getFontInfo: () => getFontInfo(),
      startSelection: () => {
        if (selectionModeActive) {
          return { status: "already" };
        }
        startSelectionMode();
        return { status: "started" };
      },
      stopSelection: () => {
        if (!selectionModeActive) {
          return { status: "notActive" };
        }
        stopSelectionMode();
        return { status: "stopped" };
      },
    };
  }

  exposeFontReader();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getFontInfo") {
      sendResponse(getFontInfo());
      return true;
    }

    if (message.action === "startSelection") {
      if (selectionModeActive) {
        sendResponse({ status: "already" });
        return true;
      }
      startSelectionMode();
      sendResponse({ status: "started" });
      return true;
    }

    if (message.action === "stopSelection") {
      if (!selectionModeActive) {
        sendResponse({ status: "notActive" });
        return true;
      }
      stopSelectionMode();
      sendResponse({ status: "stopped" });
      return true;
    }

    if (message.action === "querySelectionState") {
      sendResponse({ status: selectionModeActive ? "active" : "inactive" });
      return true;
    }
  });
})();
