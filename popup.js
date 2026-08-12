const resultEl = document.getElementById("result");
const toggleButton = document.getElementById("toggleButton");
let selectionActive = false;

function showMessage(message) {
  resultEl.innerHTML = `<p class="message">${message}</p>`;
}

function updateToggleButton(active) {
  selectionActive = active;
  toggleButton.textContent = active
    ? "Disable font hints"
    : "Enable font hints";
  toggleButton.classList.toggle("active", active);
  toggleButton.classList.toggle("inactive", !active);
}

function runSelectionCommand(action, successText, failureText) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      showMessage("Unable to find the active tab.");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action }, (response) => {
      if (chrome.runtime.lastError) {
        showMessage(
          failureText ||
            "Unable to communicate with the page. Reload the page and try again.",
        );
        return;
      }
      if (response?.status === "started") {
        updateToggleButton(true);
        showMessage(successText);
        return;
      }
      if (response?.status === "stopped") {
        updateToggleButton(false);
        showMessage(successText);
        return;
      }
      if (response?.status === "already") {
        updateToggleButton(action === "startSelection");
        showMessage(
          action === "startSelection"
            ? "Font hints are already enabled."
            : "Font hints are already disabled.",
        );
        return;
      }
      if (response?.status === "notActive") {
        updateToggleButton(false);
        showMessage("Font hints are not active. Tap the toggle to enable.");
        return;
      }
      showMessage(successText);
    });
  });
}

function querySelectionMode() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      showMessage("Unable to find the active tab.");
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { action: "querySelectionState" },
      (response) => {
        if (chrome.runtime.lastError) {
          updateToggleButton(false);
          return;
        }
        updateToggleButton(response?.status === "active");
      },
    );
  });
}

toggleButton.addEventListener("click", async () => {
  if (selectionActive) {
    await runSelectionCommand(
      "stopSelection",
      "Font hints disabled.",
      "Unable to disable font hints on this page.",
    );
  } else {
    await runSelectionCommand(
      "startSelection",
      "Font hints enabled. Select text or click an element on the page.",
      "Unable to enable font hints on this page.",
    );
  }
});

querySelectionMode();
