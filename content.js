(function () {
  "use strict";

  // Configuration
  const CONFIG = {
    storageKey: "classHighlighterEnabled",
    settingsKey: "classHighlighterSettings",
    tableSelector: "#mainContent_grdClasses",
    dayNames: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
  };

  // Default settings
  const DEFAULT_SETTINGS = {
    updateInterval: 60, // seconds
    showBanner: true,
    showInlineStatus: true,
    highlightRows: true,
    notifyBeforeClass: false,
    notifyMinutes: 10,
    colors: {
      upcoming: { textColor: "#b71c1c", bg: "#ffcdd2" },
      ongoing: { textColor: "#1b5e20", bg: "#c8e6c9" },
      ended: { textColor: "#e65100", bg: "#ffe0b2" },
      banner: {
        upcoming: { textColor: "#856404", bg: "#fff3cd", border: "#856404" },
        none: { textColor: "#155724", bg: "#d4edda", border: "#155724" },
      },
    },
  };

  // State management
  const state = {
    enabled: localStorage.getItem(CONFIG.storageKey) !== "false",
    settings: null,
    timer: null,
    notifiedClasses: new Set(),
    elements: {
      table: null,
      toggleBtn: null,
      settingsBtn: null,
      summaryBanner: null,
      settingsPanel: null,
      rows: [],
    },
  };

  // Load settings
  function loadSettings() {
    try {
      const saved = localStorage.getItem(CONFIG.settingsKey);
      state.settings = saved
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
        : { ...DEFAULT_SETTINGS };
    } catch (e) {
      state.settings = { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(CONFIG.settingsKey, JSON.stringify(state.settings));
  }

  // Utility functions
  const utils = {
    formatDuration(ms) {
      const totalMinutes = Math.abs(Math.floor(ms / 60000));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    },

    parseTime(timeStr) {
      const [hours, minutes] = timeStr.trim().split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) return null;
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    },

    getTodayName() {
      return CONFIG.dayNames[new Date().getDay()];
    },

    classHasToday(daysText, todayName) {
      return daysText.toLowerCase().includes(todayName);
    },

    showNotification(title, body) {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "📚" });
      }
    },

    requestNotificationPermission() {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    },
  };

  // UI creation functions
  const ui = {
    createToggleButton() {
      const btn = document.createElement("button");
      btn.id = "class-toggle-btn";
      btn.type = "button";
      btn.style.cssText = `
        margin: 10px 5px 0 10px;
        padding: 8px 16px;
        font-weight: 600;
        font-size: 14px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;
      btn.onmouseenter = () => (btn.style.transform = "translateY(-1px)");
      btn.onmouseleave = () => (btn.style.transform = "translateY(0)");
      return btn;
    },

    createSettingsButton() {
      const btn = document.createElement("button");
      btn.id = "class-settings-btn";
      btn.type = "button";
      btn.innerText = "⚙️ Settings";
      btn.style.cssText = `
        margin: 10px 10px 0 5px;
        padding: 8px 16px;
        font-weight: 600;
        font-size: 14px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        background-color: #6c757d;
        color: #fff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;
      btn.onmouseenter = () => (btn.style.transform = "translateY(-1px)");
      btn.onmouseleave = () => (btn.style.transform = "translateY(0)");
      return btn;
    },

    createSummaryBanner() {
      const banner = document.createElement("div");
      banner.id = "class-summary-banner";
      banner.className = "class-highlighter-added";
      banner.style.cssText = `
        padding: 14px;
        margin: 12px 10px;
        border: 2px solid;
        border-radius: 8px;
        font-weight: 600;
        font-size: 15px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        transition: all 0.3s ease;
      `;
      return banner;
    },

    createSettingsPanel() {
      const panel = document.createElement("div");
      panel.id = "class-settings-panel";
      panel.className = "class-highlighter-added";
      panel.style.cssText = `
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #333;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        z-index: 10000;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      `;

      panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 20px;">⚙️ Highlighter Settings</h2>
          <button id="settings-close" style="background: none; border: none; font-size: 24px; cursor: pointer; padding: 0; line-height: 1;">×</button>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; margin-bottom: 12px; color: #333;">Display Options</h3>
          
          <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
            <input type="checkbox" id="setting-show-banner" style="margin-right: 10px; cursor: pointer;">
            <span>Show summary banner</span>
          </label>

          <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
            <input type="checkbox" id="setting-show-inline" style="margin-right: 10px; cursor: pointer;">
            <span>Show inline status labels</span>
          </label>

          <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
            <input type="checkbox" id="setting-highlight-rows" style="margin-right: 10px; cursor: pointer;">
            <span>Highlight row backgrounds</span>
          </label>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; margin-bottom: 12px; color: #333;">Update Frequency</h3>
          <label style="display: block; margin-bottom: 8px;">
            <span style="display: block; margin-bottom: 6px; font-size: 14px;">Refresh every:</span>
            <select id="setting-update-interval" style="padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; width: 100%; font-size: 14px; cursor: pointer;">
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="120">2 minutes</option>
              <option value="300">5 minutes</option>
            </select>
          </label>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; margin-bottom: 12px; color: #333;">Notifications</h3>
          
          <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
            <input type="checkbox" id="setting-notify-enabled" style="margin-right: 10px; cursor: pointer;">
            <span>Enable class reminders</span>
          </label>

          <label style="display: block; margin-bottom: 8px;" id="notify-minutes-container">
            <span style="display: block; margin-bottom: 6px; font-size: 14px;">Remind me before:</span>
            <select id="setting-notify-minutes" style="padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; width: 100%; font-size: 14px; cursor: pointer;">
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
            </select>
          </label>

          <div id="notify-permission-info" style="display: none; margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 6px; font-size: 13px;">
            📢 Click "Allow" when prompted to enable notifications
          </div>
        </div>

        <div style="border-top: 1px solid #ddd; padding-top: 16px; margin-top: 20px;">
          <button id="settings-save" style="width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
            Save Settings
          </button>
        </div>
      `;

      // Create overlay
      const overlay = document.createElement("div");
      overlay.id = "class-settings-overlay";
      overlay.className = "class-highlighter-added";
      overlay.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
      `;

      document.body.appendChild(overlay);
      document.body.appendChild(panel);

      return { panel, overlay };
    },

    createStatusLabel(text, color) {
      const label = document.createElement("div");
      label.className = "class-status class-highlighter-added";
      label.style.cssText = `
        font-size: 12px;
        font-weight: 600;
        color: ${color};
        margin-top: 4px;
        padding: 2px 6px;
        border-radius: 4px;
        display: inline-block;
        background: rgba(255,255,255,0.5);
      `;
      label.innerText = text;
      return label;
    },

    updateButtonState(enabled) {
      const btn = state.elements.toggleBtn;
      if (enabled) {
        btn.innerText = "⏸ Hide Highlights";
        btn.style.backgroundColor = "#007bff";
        btn.style.color = "#fff";
      } else {
        btn.innerText = "▶ Show Highlights";
        btn.style.backgroundColor = "#6c757d";
        btn.style.color = "#fff";
      }
    },

    showSettings() {
      const { panel, overlay } = state.elements.settingsPanel;

      // Populate current settings
      document.getElementById("setting-show-banner").checked =
        state.settings.showBanner;
      document.getElementById("setting-show-inline").checked =
        state.settings.showInlineStatus;
      document.getElementById("setting-highlight-rows").checked =
        state.settings.highlightRows;
      document.getElementById("setting-update-interval").value =
        state.settings.updateInterval;
      document.getElementById("setting-notify-enabled").checked =
        state.settings.notifyBeforeClass;
      document.getElementById("setting-notify-minutes").value =
        state.settings.notifyMinutes;

      // Update notify UI
      const notifyContainer = document.getElementById(
        "notify-minutes-container"
      );
      notifyContainer.style.opacity = state.settings.notifyBeforeClass
        ? "1"
        : "0.5";
      document.getElementById("setting-notify-minutes").disabled =
        !state.settings.notifyBeforeClass;

      overlay.style.display = "block";
      panel.style.display = "block";
    },

    hideSettings() {
      const { panel, overlay } = state.elements.settingsPanel;
      overlay.style.display = "none";
      panel.style.display = "none";
    },
  };

  // Settings handlers
  const settings = {
    attachHandlers() {
      const { panel, overlay } = state.elements.settingsPanel;

      // Close handlers
      document.getElementById("settings-close").onclick = () =>
        ui.hideSettings();
      overlay.onclick = () => ui.hideSettings();

      // Notify checkbox handler
      document.getElementById("setting-notify-enabled").onchange = (e) => {
        const notifyContainer = document.getElementById(
          "notify-minutes-container"
        );
        const permissionInfo = document.getElementById(
          "notify-permission-info"
        );

        notifyContainer.style.opacity = e.target.checked ? "1" : "0.5";
        document.getElementById("setting-notify-minutes").disabled =
          !e.target.checked;

        if (e.target.checked) {
          if (
            "Notification" in window &&
            Notification.permission === "default"
          ) {
            permissionInfo.style.display = "block";
            utils.requestNotificationPermission();
          }
        } else {
          permissionInfo.style.display = "none";
        }
      };

      // Save handler
      document.getElementById("settings-save").onclick = () => {
        state.settings.showBanner = document.getElementById(
          "setting-show-banner"
        ).checked;
        state.settings.showInlineStatus = document.getElementById(
          "setting-show-inline"
        ).checked;
        state.settings.highlightRows = document.getElementById(
          "setting-highlight-rows"
        ).checked;
        state.settings.updateInterval = parseInt(
          document.getElementById("setting-update-interval").value
        );
        state.settings.notifyBeforeClass = document.getElementById(
          "setting-notify-enabled"
        ).checked;
        state.settings.notifyMinutes = parseInt(
          document.getElementById("setting-notify-minutes").value
        );

        saveSettings();
        ui.hideSettings();

        // Restart with new settings
        if (state.enabled) {
          controller.setEnabled(false);
          controller.setEnabled(true);
        }

        // Show confirmation
        const saveBtn = document.getElementById("settings-save");
        const originalText = saveBtn.innerText;
        saveBtn.innerText = "✓ Saved!";
        saveBtn.style.backgroundColor = "#28a745";
        setTimeout(() => {
          saveBtn.innerText = originalText;
          saveBtn.style.backgroundColor = "#007bff";
        }, 2000);
      };
    },
  };

  // Core logic
  const highlighter = {
    getClassStatus(startDate, endDate, now) {
      const colors = state.settings.colors;

      if (now < startDate) {
        return {
          type: "upcoming",
          text: `Starts in ${utils.formatDuration(startDate - now)}`,
          textColor: colors.upcoming.textColor,
          bg: colors.upcoming.bg,
        };
      } else if (now <= endDate) {
        return {
          type: "ongoing",
          text: `In Progress • ${utils.formatDuration(
            endDate - now
          )} remaining`,
          textColor: colors.ongoing.textColor,
          bg: colors.ongoing.bg,
        };
      } else {
        return {
          type: "ended",
          text: `Ended ${utils.formatDuration(now - endDate)} ago`,
          textColor: colors.ended.textColor,
          bg: colors.ended.bg,
        };
      }
    },

    processRow(row, todayName, now) {
      // Clear previous highlights
      row.style.backgroundColor = "";
      row.classList.remove("class-highlighter-highlight");
      row.querySelectorAll(".class-status").forEach((el) => el.remove());

      const cells = row.cells;
      if (!cells || cells.length < 9) return null;

      const daysText = cells[6].innerText;
      if (!utils.classHasToday(daysText, todayName)) return null;

      const startDate = utils.parseTime(cells[7].innerText);
      const endDate = utils.parseTime(cells[8].innerText);

      if (!startDate || !endDate) return null;

      const status = this.getClassStatus(startDate, endDate, now);

      // Apply styling based on settings
      if (state.settings.highlightRows) {
        row.style.backgroundColor = status.bg;
        row.style.transition = "background-color 0.3s ease";
      }

      // Add status label if enabled
      if (state.settings.showInlineStatus) {
        const statusLabel = ui.createStatusLabel(status.text, status.textColor);
        cells[2].appendChild(statusLabel);
      }

      // Check for notifications
      if (state.settings.notifyBeforeClass && status.type === "upcoming") {
        const minutesUntil = (startDate - now) / 60000;
        const notifyWindow = state.settings.notifyMinutes;
        const classKey = `${cells[2].innerText}-${startDate.getTime()}`;

        if (
          minutesUntil <= notifyWindow &&
          minutesUntil > notifyWindow - 1 &&
          !state.notifiedClasses.has(classKey)
        ) {
          utils.showNotification(
            "📚 Class Starting Soon",
            `${cells[2].innerText.split("\n")[0]} starts in ${Math.round(
              minutesUntil
            )} minutes`
          );
          state.notifiedClasses.add(classKey);
        }
      }

      // Return info if upcoming
      if (status.type === "upcoming") {
        return {
          row,
          startDate,
          course: cells[2].innerText.split("\n")[0].trim(),
          location: cells[5].innerText.trim(),
        };
      }

      return null;
    },

    updateAll() {
      if (!state.enabled) return;

      const now = new Date();
      const todayName = utils.getTodayName();
      let upcomingClasses = [];

      state.elements.rows.forEach((row) => {
        const upcoming = this.processRow(row, todayName, now);
        if (upcoming) upcomingClasses.push(upcoming);
      });

      // Sort by start time
      upcomingClasses.sort((a, b) => a.startDate - b.startDate);

      if (state.settings.showBanner) {
        this.updateBanner(upcomingClasses[0]);
      }
    },

    updateBanner(nextClass) {
      const banner = state.elements.summaryBanner;
      if (!banner) return;

      const colors = state.settings.colors.banner;

      if (nextClass) {
        const timeUntil = utils.formatDuration(
          nextClass.startDate - new Date()
        );
        banner.innerHTML = `
          <span style="font-size: 18px;">📌</span>
          <strong>Next:</strong> ${nextClass.course}
          <span style="opacity: 0.8;">in ${timeUntil}</span>
          ${
            nextClass.location
              ? ` • <span style="opacity: 0.7;">${nextClass.location}</span>`
              : ""
          }
        `;
        Object.assign(banner.style, {
          backgroundColor: colors.upcoming.bg,
          color: colors.upcoming.textColor,
          borderColor: colors.upcoming.border,
        });
      } else {
        banner.innerHTML =
          '<span style="font-size: 18px;">✅</span> <strong>All done for today!</strong>';
        Object.assign(banner.style, {
          backgroundColor: colors.none.bg,
          color: colors.none.textColor,
          borderColor: colors.none.border,
        });
      }
    },

    clear() {
      document.querySelectorAll(".class-highlighter-added").forEach((el) => {
        if (
          el.id !== "class-toggle-btn" &&
          el.id !== "class-settings-btn" &&
          el.id !== "class-settings-panel" &&
          el.id !== "class-settings-overlay"
        ) {
          el.remove();
        }
      });
      state.elements.rows.forEach((row) => {
        row.style.backgroundColor = "";
        row.classList.remove("class-highlighter-highlight");
      });
    },
  };

  // State controller
  const controller = {
    setEnabled(enabled) {
      state.enabled = enabled;
      localStorage.setItem(CONFIG.storageKey, String(enabled));

      // Clear existing timer
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }

      if (enabled) {
        ui.updateButtonState(true);

        // Re-add banner if needed and enabled in settings
        if (
          state.settings.showBanner &&
          !document.body.contains(state.elements.summaryBanner)
        ) {
          state.elements.table.parentNode.insertBefore(
            state.elements.summaryBanner,
            state.elements.table
          );
        }

        highlighter.updateAll();
        state.timer = setInterval(
          () => highlighter.updateAll(),
          state.settings.updateInterval * 1000
        );
      } else {
        ui.updateButtonState(false);
        highlighter.clear();

        if (
          state.elements.summaryBanner &&
          document.body.contains(state.elements.summaryBanner)
        ) {
          state.elements.summaryBanner.remove();
        }
      }
    },

    toggle() {
      this.setEnabled(!state.enabled);
    },
  };

  // Initialization
  function init() {
    // Load settings first
    loadSettings();

    // Find table
    const table = document.querySelector(CONFIG.tableSelector);
    if (!table) {
      console.error("Class table not found");
      return;
    }

    state.elements.table = table;
    state.elements.rows = Array.from(table.querySelectorAll("tbody tr")).slice(
      1
    );

    if (state.elements.rows.length === 0) {
      console.warn("No class rows found");
      return;
    }

    // Create or find UI elements
    state.elements.toggleBtn =
      document.querySelector("#class-toggle-btn") || ui.createToggleButton();
    state.elements.settingsBtn =
      document.querySelector("#class-settings-btn") ||
      ui.createSettingsButton();
    state.elements.summaryBanner =
      document.querySelector("#class-summary-banner") ||
      ui.createSummaryBanner();

    // Create settings panel
    if (!document.querySelector("#class-settings-panel")) {
      state.elements.settingsPanel = ui.createSettingsPanel();
      settings.attachHandlers();
    }

    // Insert buttons if new
    if (!document.body.contains(state.elements.toggleBtn)) {
      table.parentNode.insertBefore(state.elements.toggleBtn, table);
    }
    if (!document.body.contains(state.elements.settingsBtn)) {
      table.parentNode.insertBefore(state.elements.settingsBtn, table);
    }

    // Attach event handlers
    state.elements.toggleBtn.onclick = () => controller.toggle();
    state.elements.settingsBtn.onclick = () => ui.showSettings();

    // Start
    controller.setEnabled(state.enabled);

    console.log("Class Highlighter initialized successfully");
  }

  // Run initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
