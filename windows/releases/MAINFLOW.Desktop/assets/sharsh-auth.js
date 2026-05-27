(function () {
  const runtime = window.SHARSH_RUNTIME_CONFIG || {};
  const OVERLAY_CLASS = "sharsh-owner-auth-overlay";
  const LAST_EMAIL_KEY = "sarsh-owner-email";

  const state = {
    client: null,
    session: null,
    user: null,
    overlay: null,
    readyResolved: false,
    readyResolve: null
  };

  window.SHARSH_AUTH_READY = new Promise((resolve) => {
    state.readyResolve = resolve;
  });

  function requiresOwnerAuth() {
    return Boolean(
      runtime.syncMode === "supabase-function"
      && runtime.requireOwnerAuth
      && runtime.supabaseUrl
      && runtime.supabaseAnonKey
    );
  }

  function getLastEmail() {
    try {
      return localStorage.getItem(LAST_EMAIL_KEY) || "";
    } catch (_error) {
      return "";
    }
  }

  function setLastEmail(email) {
    try {
      if (email) {
        localStorage.setItem(LAST_EMAIL_KEY, email);
      }
    } catch (_error) {
    }
  }

  function escapeAttr(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function setOverlayStatus(message, isError) {
    if (!state.overlay) {
      return;
    }
    const target = state.overlay.querySelector("[data-auth-status]");
    if (!target) {
      return;
    }
    target.textContent = message || "";
    target.style.color = isError ? "#8b3d19" : "rgba(24, 24, 24, 0.72)";
  }

  function removeOverlay() {
    if (state.overlay) {
      state.overlay.remove();
      state.overlay = null;
    }
  }

  function ensureReadyResolved() {
    if (state.readyResolved) {
      return;
    }
    state.readyResolved = true;
    state.readyResolve({
      user: state.user,
      session: state.session
    });
  }

  function getRedirectUrl() {
    return `${window.location.origin}${window.location.pathname}${window.location.search}`;
  }

  function getLoginPageTitle() {
    const view = document.body ? document.body.dataset.view || "" : "";
    if (view === "department") {
      const departmentId = document.body ? document.body.dataset.departmentId || "" : "";
      const config = window.SHARSH_CONFIG || {};
      const departments = Array.isArray(config.departmentDefinitions) ? config.departmentDefinitions : [];
      const definition = departments.find((item) => item && item.id === departmentId);
      if (definition) {
        return `${definition.marker || departmentId.toUpperCase()} ${definition.department || ""}`.trim();
      }
    }
    if (view === "main") {
      return "MAINFLOW";
    }
    if (view === "feedback") {
      return "OCR feedback";
    }
    if (view === "hospital-report") {
      return "Hospital report";
    }
    if (view === "archive") {
      return "Archive";
    }

    const title = document.title || "";
    return /[ÃƒÒ�]/.test(title) ? "SARSH_KKZH" : title;
  }

  async function notifyLoginToTelegram(email) {
    const sync = window.SHARSH_SYNC || null;
    if (!sync || typeof sync.notifyOwnerLogin !== "function") {
      return;
    }

    try {
      await sync.notifyOwnerLogin({
        email: email || "",
        pageTitle: getLoginPageTitle(),
        userAgent: navigator.userAgent || "",
        happenedAt: new Date().toISOString()
      });
    } catch (_error) {
    }
  }

  function renderOverlay(message, isError) {
    if (!requiresOwnerAuth()) {
      removeOverlay();
      return;
    }

    if (!state.overlay) {
      const overlay = document.createElement("div");
      overlay.className = OVERLAY_CLASS;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.innerHTML = `
        <div style="width:min(92vw,520px);padding:28px 24px;border-radius:24px;background:#fffdf8;border:1px solid rgba(17,17,17,0.08);box-shadow:0 28px 70px rgba(34,24,8,0.18);font-family:'Segoe UI',Tahoma,sans-serif;color:#17130c;">
          <div style="display:grid;gap:12px;">
            <div style="display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:8px 12px;border-radius:999px;border:1px solid rgba(17,17,17,0.1);background:rgba(255,255,255,0.88);font-size:13px;font-weight:700;width:max-content;">Доступ владельца</div>
            <h1 style="margin:0;font-size:30px;line-height:1.08;">SARSH_KKZH</h1>
            <p style="margin:0;font-size:15px;line-height:1.5;color:rgba(24,24,24,0.72);">Интернет-режим открыт только для владельца через Supabase Auth.</p>
            <label style="display:grid;gap:6px;">
              <span style="font-size:13px;font-weight:700;">Email</span>
              <input type="email" id="ownerEmailField" value="${escapeAttr(getLastEmail())}" autocomplete="username" style="padding:11px 14px;border-radius:14px;border:1px solid rgba(17,17,17,0.14);font:inherit;">
            </label>
            <label style="display:grid;gap:6px;">
              <span style="font-size:13px;font-weight:700;">Пароль</span>
              <input type="password" id="ownerPasswordField" autocomplete="current-password" style="padding:11px 14px;border-radius:14px;border:1px solid rgba(17,17,17,0.14);font:inherit;">
            </label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button type="button" data-auth-login style="border:1px solid rgba(17,17,17,0.12);background:#fff8eb;border-radius:999px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer;">Войти</button>
              <button type="button" data-auth-signout style="border:1px solid rgba(17,17,17,0.08);background:#ffffff;border-radius:999px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer;">Сбросить сессию</button>
            </div>
            <p data-auth-status style="margin:0;font-size:13px;line-height:1.45;color:rgba(24,24,24,0.72);"></p>
          </div>
        </div>
      `;

      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "999999",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(180deg, rgba(246,241,230,0.98) 0%, rgba(235,229,215,0.98) 100%)"
      });

      const loginButton = overlay.querySelector("[data-auth-login]");
      const signOutButton = overlay.querySelector("[data-auth-signout]");
      const emailField = overlay.querySelector("#ownerEmailField");
      const passwordField = overlay.querySelector("#ownerPasswordField");

      async function handleLogin() {
        if (!state.client) {
          setOverlayStatus("Клиент авторизации ещё не готов.", true);
          return;
        }
        if (!(emailField instanceof HTMLInputElement) || !(passwordField instanceof HTMLInputElement)) {
          setOverlayStatus("Не удалось найти поля входа.", true);
          return;
        }

        const email = emailField.value.trim();
        const password = passwordField.value;
        if (!email || !password) {
          setOverlayStatus("Введите email и пароль владельца.", true);
          return;
        }

        loginButton.disabled = true;
        setOverlayStatus("Проверяю доступ владельца...", false);

        try {
          const { data, error } = await state.client.auth.signInWithPassword({
            email,
            password
          });
          if (error) {
            throw error;
          }

          state.session = data && data.session ? data.session : null;
          state.user = state.session && state.session.user ? state.session.user : null;
          if (!state.user) {
            throw new Error("Сессия владельца не создана.");
          }

          setLastEmail(email);
          await notifyLoginToTelegram(email);
          removeOverlay();
          ensureReadyResolved();
        } catch (error) {
          loginButton.disabled = false;
          setOverlayStatus(
            error instanceof Error ? error.message : "Не удалось войти как владелец.",
            true
          );
        }
      }

      if (loginButton) {
        loginButton.addEventListener("click", handleLogin);
      }

      if (signOutButton) {
        signOutButton.addEventListener("click", async () => {
          if (!state.client) {
            return;
          }
          await state.client.auth.signOut();
          if (passwordField instanceof HTMLInputElement) {
            passwordField.value = "";
          }
          setOverlayStatus("Сессия сброшена. Введите email и пароль владельца.", false);
        });
      }

      [emailField, passwordField].forEach((field) => {
        if (field instanceof HTMLInputElement) {
          field.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleLogin();
            }
          });
        }
      });

      document.body.appendChild(overlay);
      state.overlay = overlay;
    }

    setOverlayStatus(message, isError);
  }

  async function initAuth() {
    if (!requiresOwnerAuth()) {
      ensureReadyResolved();
      return;
    }

    renderOverlay("Введите email и пароль владельца, чтобы открыть интернет-режим.", false);

    try {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      state.client = createClient(runtime.supabaseUrl, runtime.supabaseAnonKey);

      state.client.auth.onAuthStateChange((_event, session) => {
        state.session = session || null;
        state.user = session && session.user ? session.user : null;
        if (state.user) {
          removeOverlay();
          ensureReadyResolved();
        } else if (requiresOwnerAuth()) {
          renderOverlay("Введите email и пароль владельца, чтобы открыть интернет-режим.", false);
        }
      });

      const { data, error } = await state.client.auth.getSession();
      if (error) {
        throw error;
      }

      state.session = data && data.session ? data.session : null;
      state.user = state.session && state.session.user ? state.session.user : null;

      if (state.user) {
        removeOverlay();
        ensureReadyResolved();
        return;
      }

      renderOverlay("Введите email и пароль владельца, чтобы открыть интернет-режим.", false);
    } catch (error) {
      renderOverlay(
        error instanceof Error ? error.message : "Не удалось настроить вход владельца.",
        true
      );
    }
  }

  window.SHARSH_AUTH = {
    requiresOwnerAuth,
    isAuthenticated() {
      return Boolean(state.user && state.session);
    },
    getAccessToken() {
      return state.session && state.session.access_token ? state.session.access_token : "";
    },
    getUserEmail() {
      return state.user && state.user.email ? String(state.user.email) : "";
    },
    async signOut() {
      if (!state.client) {
        return;
      }
      await state.client.auth.signOut();
      window.location.replace(getRedirectUrl());
    }
  };

  initAuth();
})();
