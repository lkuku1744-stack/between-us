(() => {
  const config = window.BETWEEN_US_SUPABASE || {};
  const sharedPrefix = "between-us-";
  const validKeys = new Set([
    "between-us-food-records-v1",
    "between-us-100-items-v2",
    "between-us-photo-records-v1",
    "between-us-argument-records-v1",
    "between-us-heartbeat-records-v1",
    "between-us-deleted-records-v1",
  ]);
  const deletionStorageKey = "between-us-deleted-records-v1";
  const mergeableCollections = new Set([
    "between-us-food-records-v1",
    "between-us-100-items-v2",
    "between-us-photo-records-v1",
    "between-us-argument-records-v1",
    "between-us-heartbeat-records-v1",
  ]);
  const originalSetItem = Storage.prototype.setItem;
  const pendingSaves = new Map();

  let client = null;
  let session = null;
  let cloudVersion = 0;
  let flushing = false;
  let flushTimer = null;
  let versionTimer = null;
  let versionCheckBusy = false;
  let authGate = null;
  let statusElement = null;
  let statusHideTimer = null;
  let logoutButton = null;
  let refreshNotice = null;
  let scriptsStarted = false;

  const normalizeValue = (value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const readStoredArray = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  function readDeletionMap() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(deletionStorageKey) || "{}",
      );
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function recordTimestamp(record) {
    const timestamp = Date.parse(record?.updatedAt || "");
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function mergeRecordArrays(localRecords, remoteRecords, localDeletes, remoteDeletes) {
    const records = new Map();
    [...remoteRecords, ...localRecords].forEach((record) => {
      if (!record?.id) return;
      const current = records.get(record.id);
      if (!current || recordTimestamp(record) >= recordTimestamp(current)) {
        records.set(record.id, record);
      }
    });
    const deletes = { ...remoteDeletes, ...localDeletes };
    return [...records.values()].filter((record) => {
      const deletedAt = Date.parse(deletes[record.id] || "");
      return !Number.isFinite(deletedAt) || deletedAt < recordTimestamp(record);
    });
  }

  function mergeDeletionMaps(localDeletes, remoteDeletes) {
    const merged = {};
    const collectionKeys = new Set([
      ...Object.keys(localDeletes || {}),
      ...Object.keys(remoteDeletes || {}),
    ]);
    collectionKeys.forEach((key) => {
      const ids = new Set([
        ...Object.keys(localDeletes?.[key] || {}),
        ...Object.keys(remoteDeletes?.[key] || {}),
      ]);
      merged[key] = {};
      ids.forEach((id) => {
        const localTime = Date.parse(localDeletes?.[key]?.[id] || "");
        const remoteTime = Date.parse(remoteDeletes?.[key]?.[id] || "");
        const timestamp = Math.max(
          Number.isFinite(localTime) ? localTime : 0,
          Number.isFinite(remoteTime) ? remoteTime : 0,
        );
        if (timestamp > 0) {
          merged[key][id] = new Date(timestamp).toISOString();
        }
      });
    });
    return merged;
  }

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`无法加载 ${source}`));
      document.body.append(script);
    });
  }

  async function detectLocalSharedServer() {
    if (location.protocol === "file:") return false;
    try {
      const response = await fetch("/api/state", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return false;
      if (!response.headers.get("content-type")?.includes("application/json")) {
        return false;
      }
      const payload = await response.json();
      return (
        Number.isFinite(Number(payload?.version)) &&
        payload?.values &&
        typeof payload.values === "object"
      );
    } catch {
      return false;
    }
  }

  function ensureAuthGate() {
    if (authGate) return authGate;

    authGate = document.createElement("div");
    authGate.className = "love-gate";
    authGate.id = "loveGate";
    authGate.innerHTML = `
      <div class="love-gate__paper">
        <img class="love-gate__mascot" src="assets/sanrio-hello-kitty.webp" alt="" />
        <p class="love-gate__eyebrow">OUR PRIVATE MEMORY BOOK</p>
        <h1>岳岳 × 昆昆</h1>
        <p class="love-gate__note">这里只放我们两个人的事情。<br />用共同的小账号打开它吧 ♡</p>
        <form class="love-gate__form" id="loveGateForm">
          <label class="love-gate__field">
            <span>我们的共同账号</span>
            <input
              id="loveGateEmail"
              type="email"
              inputmode="email"
              autocomplete="username"
              spellcheck="false"
              required
            />
          </label>
          <label class="love-gate__field">
            <span>只属于我们的密码</span>
            <input
              id="loveGatePassword"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>
          <button type="submit">打开我们的回忆 →</button>
          <p class="love-gate__error" id="loveGateError" role="alert"></p>
        </form>
        <p class="love-gate__footer">两个人，同一本回忆录 · 岳岳 ♡ 昆昆</p>
      </div>
    `;
    document.body.append(authGate);

    const form = authGate.querySelector("#loveGateForm");
    const email = authGate.querySelector("#loveGateEmail");
    const password = authGate.querySelector("#loveGatePassword");
    const error = authGate.querySelector("#loveGateError");
    email.value = config.loginEmail || "";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!client) return;
      const submit = form.querySelector('button[type="submit"]');
      error.textContent = "";
      submit.disabled = true;
      submit.textContent = "正在打开回忆…";
      try {
        const result = await client.auth.signInWithPassword({
          email: email.value.trim(),
          password: password.value,
        });
        if (result.error) throw result.error;
        session = result.data.session;
        await startCloud();
      } catch (signInError) {
        const message = String(signInError?.message || "");
        error.textContent = /invalid login credentials/i.test(message)
          ? "账号或密码不对，再想一想我们的暗号呀"
          : "这一刻没能连上云端，请检查网络后再试一次";
        submit.disabled = false;
        submit.textContent = "再试一次 →";
      }
    });

    return authGate;
  }

  function showLogin(message = "") {
    const gate = ensureAuthGate();
    gate.hidden = false;
    const error = gate.querySelector("#loveGateError");
    const submit = gate.querySelector('button[type="submit"]');
    if (error) error.textContent = message;
    if (submit) {
      submit.disabled = false;
      submit.textContent = "打开我们的回忆 →";
    }
    document.body.classList.remove("app-ready");
  }

  function hideLogin() {
    if (authGate) authGate.hidden = true;
    document.body.classList.add("app-ready");
  }

  function ensureStatus() {
    if (statusElement) return statusElement;
    statusElement = document.createElement("div");
    statusElement.className = "cloud-status";
    statusElement.dataset.state = "saving";
    statusElement.textContent = "正在连接我们的云端…";
    document.body.append(statusElement);

    logoutButton = document.createElement("button");
    logoutButton.className = "cloud-logout";
    logoutButton.type = "button";
    logoutButton.textContent = "退出共同账号";
    logoutButton.addEventListener("click", async () => {
      if (!client) return;
      pendingSaves.clear();
      await client.auth.signOut();
      location.reload();
    });
    document.body.append(logoutButton);
    return statusElement;
  }

  function setStatus(message, state = "online") {
    const element = ensureStatus();
    element.textContent = message;
    element.dataset.state = state;
    clearTimeout(statusHideTimer);
    element.classList.remove("is-quiet");
    if (state === "online") {
      statusHideTimer = setTimeout(
        () => element.classList.add("is-quiet"),
        2800,
      );
    }
  }

  function showRefreshNotice() {
    if (refreshNotice) return;
    refreshNotice = document.createElement("button");
    refreshNotice.className = "cloud-refresh";
    refreshNotice.type = "button";
    refreshNotice.textContent = "另一边更新了，点我刷新 ♡";
    refreshNotice.addEventListener("click", () => location.reload());
    document.body.append(refreshNotice);
  }

  async function signStoragePath(storagePath) {
    if (!client || !storagePath) return "";
    const result = await client.storage
      .from(config.bucket)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    return result.error ? "" : result.data?.signedUrl || "";
  }

  async function refreshSignedImages() {
    for (const key of [
      "between-us-food-records-v1",
      "between-us-photo-records-v1",
      "between-us-heartbeat-records-v1",
    ]) {
      const records = readStoredArray(key);
      if (records.length === 0) continue;
      const signatures = await Promise.all(
        records.map((record) =>
          record?.storagePath ? signStoragePath(record.storagePath) : "",
        ),
      );
      let changed = false;
      records.forEach((record, index) => {
        const signedUrl = signatures[index];
        if (!record?.storagePath) return;
        if (signedUrl && signedUrl !== record.image) {
          record.image = signedUrl;
          changed = true;
        }
      });
      if (changed) {
        originalSetItem.call(localStorage, key, JSON.stringify(records));
      }
    }
  }

  async function uploadImage(dataUrl, folder = "photos") {
    if (!client || !session) throw new Error("云端登录已失效");
    if (!String(dataUrl).startsWith("data:")) {
      return { image: dataUrl, storagePath: "" };
    }

    const blob = await fetch(dataUrl).then((response) => response.blob());
    if (blob.size > 15 * 1024 * 1024) {
      throw new Error("照片太大了，请换一张 15MB 以内的照片");
    }
    const extension =
      blob.type === "image/png"
        ? "png"
        : blob.type === "image/webp"
          ? "webp"
          : "jpg";
    const random = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const storagePath = `${folder}/${Date.now()}-${random}.${extension}`;
    const upload = await client.storage
      .from(config.bucket)
      .upload(storagePath, blob, {
        cacheControl: "3600",
        contentType: blob.type || "image/jpeg",
        upsert: false,
      });
    if (upload.error) throw upload.error;
    const image = await signStoragePath(storagePath);
    return { image, storagePath };
  }

  async function readCloudState(keys) {
    const remoteResult = await client
      .from("shared_state")
      .select("key,value")
      .in("key", keys);
    if (remoteResult.error) throw remoteResult.error;
    const rows = Array.isArray(remoteResult.data) ? remoteResult.data : [];
    return Object.fromEntries(
      rows.map((row) => [row.key, normalizeValue(row.value)]),
    );
  }

  function localContributionExists(key, originalValue, remoteRows) {
    if (key === deletionStorageKey) {
      const remoteDeletes = remoteRows[deletionStorageKey] || {};
      return Object.entries(originalValue || {}).every(
        ([collectionKey, records]) =>
          Object.entries(records || {}).every(([recordId, deletedAt]) => {
            const remoteTime = Date.parse(
              remoteDeletes?.[collectionKey]?.[recordId] || "",
            );
            const localTime = Date.parse(deletedAt || "");
            return (
              Number.isFinite(remoteTime) &&
              (!Number.isFinite(localTime) || remoteTime >= localTime)
            );
          }),
      );
    }
    if (!mergeableCollections.has(key)) return true;
    const remoteRecords = Array.isArray(remoteRows[key])
      ? remoteRows[key]
      : [];
    const remoteById = new Map(
      remoteRecords.map((record) => [record.id, record]),
    );
    const deletes = remoteRows[deletionStorageKey]?.[key] || {};
    return (Array.isArray(originalValue) ? originalValue : []).every(
      (record) => {
        const remoteRecord = remoteById.get(record.id);
        const remoteTime = recordTimestamp(remoteRecord);
        const localTime = recordTimestamp(record);
        const deletedTime = Date.parse(deletes[record.id] || "");
        return (
          (remoteRecord && remoteTime >= localTime) ||
          (Number.isFinite(deletedTime) && deletedTime > localTime)
        );
      },
    );
  }

  async function saveKeyNow(key, value) {
    const originalValue = normalizeValue(value);
    let nextValue = originalValue;
    const shouldMerge =
      mergeableCollections.has(key) || key === deletionStorageKey;

    for (let attempt = 0; attempt < (shouldMerge ? 3 : 1); attempt += 1) {
      if (shouldMerge) {
        const rows = await readCloudState([key, deletionStorageKey]);
        const localDeletes = readDeletionMap();
        if (mergeableCollections.has(key)) {
          const mergedRecords = mergeRecordArrays(
            Array.isArray(originalValue) ? originalValue : [],
            Array.isArray(rows[key]) ? rows[key] : [],
            localDeletes[key] || {},
            rows[deletionStorageKey]?.[key] || {},
          );
          const localIds = new Set(
            (Array.isArray(originalValue) ? originalValue : []).map(
              (record) => record?.id,
            ),
          );
          if (mergedRecords.some((record) => !localIds.has(record.id))) {
            showRefreshNotice();
          }
          nextValue = mergedRecords;
          originalSetItem.call(localStorage, key, JSON.stringify(nextValue));
        } else {
          nextValue = mergeDeletionMaps(
            originalValue,
            rows[deletionStorageKey],
          );
          originalSetItem.call(
            localStorage,
            deletionStorageKey,
            JSON.stringify(nextValue),
          );
        }
      }

      const result = await client.rpc("save_shared_state", {
        p_key: key,
        p_value: nextValue,
      });
      if (result.error) throw result.error;
      cloudVersion = Math.max(cloudVersion, Number(result.data) || 0);
      if (!shouldMerge) return;

      await new Promise((resolve) => setTimeout(resolve, 240));
      const verifiedRows = await readCloudState([key, deletionStorageKey]);
      if (localContributionExists(key, originalValue, verifiedRows)) return;
    }
  }

  function markDeleted(collectionKey, recordId) {
    if (!mergeableCollections.has(collectionKey) || !recordId) return;
    const deletions = readDeletionMap();
    deletions[collectionKey] ||= {};
    deletions[collectionKey][String(recordId)] = new Date().toISOString();
    originalSetItem.call(
      localStorage,
      deletionStorageKey,
      JSON.stringify(deletions),
    );
    queueCloudSave(deletionStorageKey, JSON.stringify(deletions));
  }

  async function flushPendingSaves() {
    if (flushing || !client || !session || pendingSaves.size === 0) return;
    flushing = true;
    setStatus("正在同步我们的回忆…", "saving");
    try {
      while (pendingSaves.size > 0) {
        const [key, value] = pendingSaves.entries().next().value;
        pendingSaves.delete(key);
        try {
          await saveKeyNow(key, value);
        } catch (error) {
          pendingSaves.set(key, value);
          throw error;
        }
      }
      setStatus("云端已同步 · 两边都能看见", "online");
    } catch {
      setStatus("暂时没同步上，联网后会自动重试", "offline");
    } finally {
      flushing = false;
      if (pendingSaves.size > 0) {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(flushPendingSaves, 6000);
      }
    }
  }

  function queueCloudSave(key, value) {
    if (!session) return;
    pendingSaves.set(String(key), String(value));
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flushPendingSaves, 180);
  }

  function installSaveInterceptor() {
    Storage.prototype.setItem = function setItemShared(key, value) {
      originalSetItem.call(this, key, value);
      if (
        this === window.localStorage &&
        validKeys.has(String(key)) &&
        String(key).startsWith(sharedPrefix)
      ) {
        queueCloudSave(String(key), String(value));
      }
    };
  }

  async function checkRemoteVersion() {
    if (
      versionCheckBusy ||
      !client ||
      !session ||
      document.visibilityState !== "visible"
    ) {
      return;
    }
    const activeTag = document.activeElement?.tagName;
    if (
      activeTag === "INPUT" ||
      activeTag === "TEXTAREA" ||
      activeTag === "SELECT"
    ) {
      return;
    }
    versionCheckBusy = true;
    try {
      const result = await client
        .from("shared_state")
        .select("key,version")
        .like("key", `${sharedPrefix}%`);
      if (result.error || !Array.isArray(result.data)) return;
      const remoteVersion = result.data.reduce(
        (max, row) => Math.max(max, Number(row.version) || 0),
        0,
      );
      if (
        remoteVersion > cloudVersion &&
        pendingSaves.size === 0 &&
        !flushing
      ) {
        showRefreshNotice();
      }
    } catch {
      // The current page remains usable while the connection is interrupted.
    } finally {
      versionCheckBusy = false;
    }
  }

  function startCloudWatchers() {
    clearInterval(versionTimer);
    versionTimer = setInterval(() => {
      flushPendingSaves();
      checkRemoteVersion();
    }, 4000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        flushPendingSaves();
        checkRemoteVersion();
      }
    });
    window.addEventListener("online", flushPendingSaves);
  }

  async function startCloud() {
    if (!session) {
      const current = await client.auth.getSession();
      session = current.data.session;
    }
    if (!session) {
      showLogin();
      return;
    }

    ensureStatus();
    setStatus("正在打开我们的回忆…", "saving");
    const result = await client
      .from("shared_state")
      .select("key,value,version")
      .like("key", `${sharedPrefix}%`);
    if (result.error) {
      showLogin(`共同回忆暂时没能打开：${result.error.message}`);
      return;
    }

    const rows = Array.isArray(result.data) ? result.data : [];
    cloudVersion = rows.reduce(
      (max, row) => Math.max(max, Number(row.version) || 0),
      0,
    );
    rows.forEach((row) => {
      if (!validKeys.has(row.key)) return;
      originalSetItem.call(
        localStorage,
        row.key,
        JSON.stringify(normalizeValue(row.value)),
      );
    });

    const hasHundred = rows.some(
      (row) => row.key === "between-us-100-items-v2",
    );
    if (!hasHundred && window.SITE_DATA?.hundredThings) {
      const defaults = window.SITE_DATA.hundredThings;
      originalSetItem.call(
        localStorage,
        "between-us-100-items-v2",
        JSON.stringify(defaults),
      );
      await saveKeyNow("between-us-100-items-v2", defaults);
    }

    await refreshSignedImages();
    installSaveInterceptor();
    window.BetweenUsCloud = {
      isCloud: true,
      client,
      uploadImage,
      signStoragePath,
      refreshSignedImages,
      markDeleted,
    };

    if (!scriptsStarted) {
      scriptsStarted = true;
      await loadScript("app.js?v=cloud-7");
    }
    hideLogin();
    setStatus("云端已同步 · 两边都能看见", "online");
    startCloudWatchers();
  }

  async function loadLocalMode(shared) {
    if (shared) {
      await loadScript("shared-bootstrap.js?v=1");
    }
    if (!scriptsStarted) {
      scriptsStarted = true;
      window.BetweenUsCloud = {
        isCloud: false,
        uploadImage: async (dataUrl) => ({
          image: dataUrl,
          storagePath: "",
        }),
        markDeleted: () => {},
      };
      await loadScript("app.js?v=cloud-7");
    }
    document.body.classList.add("app-ready");
  }

  async function loadSupabaseLibrary() {
    if (window.supabase?.createClient) return;
    await loadScript(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
    );
    if (!window.supabase?.createClient) {
      throw new Error("Supabase 组件加载失败");
    }
  }

  async function start() {
    await loadScript("data.js?v=cloud-1");

    const shared = await detectLocalSharedServer();
    if (shared || location.protocol === "file:") {
      await loadLocalMode(shared);
      return;
    }

    if (!config.url || !config.publishableKey) {
      showLogin("云端配置不完整，请先检查网站设置");
      return;
    }

    await loadSupabaseLibrary();
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    const current = await client.auth.getSession();
    session = current.data.session;
    if (session) {
      await startCloud();
    } else {
      showLogin();
    }
  }

  start().catch((error) => {
    const detail =
      error instanceof Error ? error.message : "未知的连接问题";
    showLogin(`网站暂时没能打开：${detail}`);
  });
})();
