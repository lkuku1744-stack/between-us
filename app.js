(() => {
  const data = window.SITE_DATA;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const setText = (selector, value) => {
    $$(selector).forEach((element) => {
      element.textContent = value;
    });
  };

  function loadArray(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      return Array.isArray(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  const anniversary = data.couple.anniversary
    ? new Date(`${data.couple.anniversary}T00:00:00+08:00`)
    : null;
  const todayInChina = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const currentChinaDate = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const defaultDateState = new WeakMap();

  function setDefaultDate(input, force = false) {
    if (!input) return;
    const state = defaultDateState.get(input) || {
      lastDefault: "",
      custom: false,
    };
    if (force || !state.custom || !input.value) {
      input.value = currentChinaDate();
      state.lastDefault = input.value;
      state.custom = false;
      defaultDateState.set(input, state);
    }
  }

  function registerDefaultDate(input) {
    defaultDateState.set(input, { lastDefault: "", custom: false });
    input.addEventListener("change", () => {
      const state = defaultDateState.get(input);
      if (!state) return;
      state.custom = input.value !== state.lastDefault;
    });
    setDefaultDate(input, true);
  }

  function keepSelectedDate(input) {
    const state = defaultDateState.get(input);
    if (state) state.custom = true;
  }

  function refreshDefaultDates() {
    $$(
      "#mealDate, #photoDate, #argumentDate, #heartbeatDate",
    ).forEach((input) => setDefaultDate(input));
    if (anniversary) {
      const refreshedToday = currentChinaDate();
      const refreshedDays = Math.max(
        1,
        Math.floor(
          (Date.parse(`${refreshedToday}T00:00:00Z`) -
            Date.parse(`${data.couple.anniversary}T00:00:00Z`)) /
            86400000,
        ) + 1,
      );
      setText("[data-days-together]", String(refreshedDays));
    }
  }
  const daysTogether = anniversary
    ? Math.max(
        1,
        Math.floor(
          (Date.parse(`${todayInChina}T00:00:00Z`) -
            Date.parse(`${data.couple.anniversary}T00:00:00Z`)) /
            86400000,
        ) + 1,
      )
    : 0;
  setText("[data-person-a]", data.couple.personA);
  setText("[data-person-b]", data.couple.personB);
  setText("[data-days-together]", String(daysTogether));
  setText(
    "[data-anniversary-year]",
    anniversary ? String(anniversary.getFullYear()) : "----",
  );
  setText(
    "[data-anniversary-text]",
    anniversary
      ? [
          anniversary.getFullYear(),
          String(anniversary.getMonth() + 1).padStart(2, "0"),
          String(anniversary.getDate()).padStart(2, "0"),
        ].join(".")
      : "待填写",
  );

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -20px" },
  );

  function observeReveals(root = document) {
    $$(".reveal", root).forEach((element) => revealObserver.observe(element));
  }

  /* Food */

  const foodGrid = $("#foodGrid");
  const mealForm = $("#mealForm");
  const mealDate = $("#mealDate");
  const mealName = $("#mealName");
  const mealPhoto = $("#mealPhoto");
  const mealPhotoPicker = $("#mealPhotoPicker");
  const mealPhotoPreview = $("#mealPhotoPreview");
  const cancelFoodEdit = $("#cancelFoodEdit");
  const mealSubmitLabel = mealForm.querySelector('button[type="submit"] span');
  const foodStorageKey = "between-us-food-records-v1";
  const ratingLabels = {
    5: "超级好吃",
    4: "很好吃",
    3: "还不错",
    2: "一般般",
    1: "下次不吃了",
  };
  let pendingFoodPhoto = "";
  let pendingFoodStoragePath = "";
  let editingFoodId = null;

  function loadSavedFoods() {
    try {
      const raw = localStorage.getItem(foodStorageKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      return Array.isArray(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  const savedFoods = loadSavedFoods();
  let foods = (savedFoods === null ? [...data.foods] : savedFoods).sort(
    (a, b) => String(b.date).localeCompare(String(a.date)),
  );

  function saveFoods() {
    localStorage.setItem(foodStorageKey, JSON.stringify(foods));
  }

  function formatFoodDate(value) {
    if (!value) return "日期待填写";
    const [year, month, day] = value.split("-");
    return `${year}.${month}.${day}`;
  }

  function renderFoods() {
    foodGrid.innerHTML = "";
    setText("#foodFormCount", `${foods.length} 顿`);
    setText("#hubFoodCount", `${foods.length} 条记录`);

    if (foods.length === 0) {
      return;
    } else {
      foods.forEach((food) => {
        const card = document.createElement("article");
        card.className = "meal-card reveal";
        card.innerHTML = `
          <div class="meal-card__photo">
            ${
              food.image
                ? `<img src="${food.image}" alt="${food.name}" />`
                : `<span class="meal-card__placeholder" aria-hidden="true">食</span>`
            }
          </div>
          <div class="meal-card__content">
            <time>${formatFoodDate(food.date)}</time>
            <h3>${food.name}</h3>
            <div class="meal-card__rating">
              <span>${ratingLabels[food.rating] || "还没有评价"}</span>
              <span aria-label="${food.rating || 0} 分">${"●".repeat(Number(food.rating) || 0)}${"○".repeat(5 - (Number(food.rating) || 0))}</span>
            </div>
            <div class="record-manage">
              <button type="button" data-meal-edit="${food.id}">编辑</button>
              <button class="meal-card__delete" type="button" data-meal-id="${food.id}">删除</button>
            </div>
          </div>
        `;
        card
          .querySelector("[data-meal-edit]")
          .addEventListener("click", () => beginFoodEdit(food));
        card
          .querySelector(".meal-card__delete")
          .addEventListener("click", () => {
            if (!window.confirm("要移除这条用餐记录吗？")) return;
            markRecordDeleted(foodStorageKey, food.id);
            foods = foods.filter((item) => item.id !== food.id);
            saveFoods();
            renderFoods();
            renderRecentMemories();
            showToast("这条用餐记录已移除");
          });
        foodGrid.append(card);
      });
    }
    observeReveals(foodGrid);
  }

  function beginFoodEdit(food) {
    editingFoodId = food.id;
    mealDate.value = food.date || "";
    keepSelectedDate(mealDate);
    mealName.value = food.name || "";
    const rating = mealForm.querySelector(
      `input[name="mealRating"][value="${food.rating}"]`,
    );
    if (rating) rating.checked = true;
    pendingFoodPhoto = food.image || "";
    pendingFoodStoragePath = food.storagePath || "";
    if (food.image) {
      mealPhotoPreview.src = food.image;
      mealPhotoPreview.hidden = false;
      mealPhotoPicker.hidden = true;
    } else {
      mealPhotoPreview.removeAttribute("src");
      mealPhotoPreview.hidden = true;
      mealPhotoPicker.hidden = false;
    }
    cancelFoodEdit.hidden = false;
    mealSubmitLabel.textContent = "保存修改";
    mealForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setTodayAsDefault() {
    setDefaultDate(mealDate, true);
  }

  function resetFoodForm() {
    mealForm.reset();
    setTodayAsDefault();
    pendingFoodPhoto = "";
    pendingFoodStoragePath = "";
    editingFoodId = null;
    mealPhotoPreview.removeAttribute("src");
    mealPhotoPreview.hidden = true;
    mealPhotoPicker.hidden = false;
    cancelFoodEdit.hidden = true;
    mealSubmitLabel.textContent = "记下这一顿";
  }

  async function compressFoodPhoto(file) {
    if (!file.type.startsWith("image/")) {
      throw new Error("请选择图片文件");
    }
    if (file.size > 15 * 1024 * 1024) {
      throw new Error("照片太大，请选择 15MB 以内的图片");
    }

    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = source;
    });

    const maxEdge = 1400;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  async function persistRecordPhoto(dataUrl, folder) {
    if (!dataUrl) return { image: "", storagePath: "" };
    if (window.BetweenUsCloud?.isCloud) {
      return window.BetweenUsCloud.uploadImage(dataUrl, folder);
    }
    return { image: dataUrl, storagePath: "" };
  }

  function markRecordDeleted(collectionKey, recordId) {
    window.BetweenUsCloud?.markDeleted?.(collectionKey, recordId);
  }

  mealPhoto.addEventListener("change", async () => {
    const [file] = mealPhoto.files;
    if (!file) return;
    try {
      pendingFoodPhoto = await compressFoodPhoto(file);
      pendingFoodStoragePath = "";
      mealPhotoPreview.src = pendingFoodPhoto;
      mealPhotoPreview.hidden = false;
      mealPhotoPicker.hidden = true;
    } catch (error) {
      mealPhoto.value = "";
      showToast(error instanceof Error ? error.message : "照片读取失败");
    }
  });

  mealForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const mealRating = mealForm.querySelector(
      'input[name="mealRating"]:checked',
    );
    if (!mealDate.value || !mealName.value.trim() || !mealRating) {
      showToast("把日期、吃了什么和好不好吃都填上吧");
      return;
    }

    let storedPhoto;
    try {
      storedPhoto = await persistRecordPhoto(pendingFoodPhoto, "meals");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "照片上传失败，请再试一次",
      );
      return;
    }
    const nextFood = {
      id: editingFoodId || `meal-${Date.now()}`,
      date: mealDate.value,
      name: mealName.value.trim(),
      rating: mealRating.value,
      image: storedPhoto.image,
      storagePath: storedPhoto.storagePath || pendingFoodStoragePath,
      updatedAt: new Date().toISOString(),
    };
    const nextFoods = (
      editingFoodId
        ? foods.map((item) => (item.id === editingFoodId ? nextFood : item))
        : [nextFood, ...foods]
    ).sort((a, b) =>
      String(b.date).localeCompare(String(a.date)),
    );
    try {
      localStorage.setItem(foodStorageKey, JSON.stringify(nextFoods));
    } catch {
      showToast("这组照片占用的存储空间较大，暂时无法保存");
      return;
    }
    foods = nextFoods;
    renderFoods();
    renderRecentMemories();
    const wasEditing = Boolean(editingFoodId);
    resetFoodForm();
    showToast(wasEditing ? "这顿记录已经修改好了" : "这一顿已经记下来了");
  });

  cancelFoodEdit.addEventListener("click", resetFoodForm);

  setTodayAsDefault();
  renderFoods();

  /* Hundred little things */

  const hundredStorageKey = "between-us-100-items-v2";
  let storedHundred = null;
  try {
    const raw = localStorage.getItem(hundredStorageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    storedHundred = Array.isArray(parsed) ? parsed : null;
  } catch {
    storedHundred = null;
  }
  let hundredThings = (
    storedHundred === null ? [...data.hundredThings] : storedHundred
  ).slice(0, 100);
  const hundredForm = $("#hundredForm");
  const hundredText = $("#hundredText");
  const hundredList = $("#hundredList");
  const hundredFilter = $("#hundredFilter");
  const cancelHundredEdit = $("#cancelHundredEdit");
  const hundredSubmitLabel = hundredForm.querySelector(
    'button[type="submit"] span',
  );
  let activeHundredFilter = "all";
  let editingHundredId = null;

  function renderHundredList() {
    hundredList.innerHTML = "";
    hundredFilter.hidden = hundredThings.length === 0;
    if (hundredThings.length === 0) {
      updateHundredProgress();
      return;
    }

    const visibleThings = hundredThings.filter((thing) => {
      if (activeHundredFilter === "done") return thing.done;
      if (activeHundredFilter === "undone") return !thing.done;
      return true;
    });

    visibleThings.forEach((thing) => {
      const itemNumber = hundredThings.indexOf(thing) + 1;
      const item = document.createElement("li");
      item.innerHTML = `
        <div class="hundred-item-row">
          <label>
            <input type="checkbox" ${thing.done ? "checked" : ""} />
            <span class="wish-check" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="m3 8 3 3 7-7"></path></svg>
            </span>
            <span class="hundred-item__number">${String(itemNumber).padStart(2, "0")}</span>
            <span>${thing.text}</span>
          </label>
          <div class="hundred-item__actions">
            <button class="hundred-item__edit" type="button" aria-label="编辑${thing.text}">编辑</button>
            <button class="hundred-item__remove" type="button" aria-label="移除${thing.text}">删除</button>
          </div>
        </div>
      `;
      const label = item.querySelector("label");
      const checkbox = item.querySelector("input");
      let viewportBeforeToggle = null;

      label.addEventListener(
        "pointerdown",
        () => {
          viewportBeforeToggle = captureHundredViewport();
        },
        { passive: true },
      );
      checkbox.addEventListener("keydown", () => {
        viewportBeforeToggle = captureHundredViewport();
      });
      checkbox.addEventListener("change", (event) => {
        const viewport = viewportBeforeToggle || captureHundredViewport();
        thing.done = event.target.checked;
        thing.updatedAt = new Date().toISOString();
        saveHundredThings();
        updateHundredProgress();
        showToast(thing.done ? "又完成了一件小事" : "已放回还没做的清单");
        if (activeHundredFilter !== "all") {
          renderHundredList();
        }
        restoreHundredViewport(viewport);
        window.requestAnimationFrame(() =>
          restoreHundredViewport(viewport),
        );
        viewportBeforeToggle = null;
      });
      item
        .querySelector(".hundred-item__edit")
        .addEventListener("click", () => beginHundredEdit(thing));
      item
        .querySelector(".hundred-item__remove")
        .addEventListener("click", () => {
          if (!window.confirm(`确定删除“${thing.text}”吗？`)) return;
          markRecordDeleted(hundredStorageKey, thing.id);
          hundredThings = hundredThings.filter(
            (entry) => entry.id !== thing.id,
          );
          saveHundredThings();
          renderHundredList();
          showToast("已从清单里移除");
        });
      hundredList.append(item);
    });

    updateHundredProgress();
  }

  function captureHundredViewport() {
    return {
      pageY: window.scrollY,
      listY: hundredList.scrollTop,
    };
  }

  function restoreHundredViewport(viewport) {
    if (!viewport) return;
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, viewport.pageY);
    hundredList.scrollTop = viewport.listY;
    window.requestAnimationFrame(() => {
      root.style.scrollBehavior = previousBehavior;
    });
  }

  function saveHundredThings() {
    localStorage.setItem(hundredStorageKey, JSON.stringify(hundredThings));
  }

  function beginHundredEdit(thing) {
    editingHundredId = thing.id;
    hundredText.value = thing.text;
    cancelHundredEdit.hidden = false;
    hundredSubmitLabel.textContent = "保存这件小事";
    hundredForm.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => hundredText.focus(), 300);
  }

  function resetHundredForm() {
    editingHundredId = null;
    hundredForm.reset();
    cancelHundredEdit.hidden = true;
    hundredSubmitLabel.textContent = "放进我们的清单";
  }

  function updateHundredProgress() {
    const done = hundredThings.filter((thing) => thing.done).length;
    setText(
      "#hundredDoneSmall",
      `已完成 ${String(done).padStart(2, "0")} / 100`,
    );
    setText("#hubHundredCount", `${String(done).padStart(2, "0")} / 100`);
    setText(
      "#hundredFormCount",
      `已写下 ${String(hundredThings.length).padStart(2, "0")} / 100`,
    );
  }

  $$("button", hundredFilter).forEach((button) => {
    button.addEventListener("click", () => {
      activeHundredFilter = button.dataset.hundredFilter;
      $$("button", hundredFilter).forEach((item) => {
        item.classList.toggle("is-active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });
      renderHundredList();
    });
  });

  hundredForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = hundredText.value.trim();
    if (!text) {
      showToast("先写下一件想一起做的事吧");
      return;
    }
    if (!editingHundredId && hundredThings.length >= 100) {
      showToast("这一百件已经装满啦");
      return;
    }
    if (editingHundredId) {
      hundredThings = hundredThings.map((thing) =>
        thing.id === editingHundredId
          ? { ...thing, text, updatedAt: new Date().toISOString() }
          : thing,
      );
    } else {
      const nextId = String(
        Math.max(
          0,
          ...hundredThings.map((thing) => Number(thing.id) || 0),
        ) + 1,
      );
      hundredThings.push({
        id: nextId,
        text,
        done: false,
        updatedAt: new Date().toISOString(),
      });
    }
    saveHundredThings();
    const wasEditing = Boolean(editingHundredId);
    resetHundredForm();
    renderHundredList();
    showToast(wasEditing ? "这件小事已经修改好了" : "又往清单里放进一件小事");
  });

  cancelHundredEdit.addEventListener("click", resetHundredForm);

  /* Photos */

  const photoStorageKey = "between-us-photo-records-v1";
  const photoSizes = ["large", "tall", "small", "wide", "portrait"];
  const photoForm = $("#photoForm");
  const photoDate = $("#photoDate");
  const photoTitle = $("#photoTitle");
  const photoUpload = $("#photoUpload");
  const photoUploadPicker = $("#photoUploadPicker");
  const photoUploadPreview = $("#photoUploadPreview");
  const photoStory = $("#photoStory");
  const cancelPhotoEdit = $("#cancelPhotoEdit");
  const photoSubmitLabel = photoForm.querySelector(
    'button[type="submit"] span',
  );
  let pendingGalleryPhoto = "";
  let pendingGalleryStoragePath = "";
  let editingPhotoId = null;

  function loadSavedPhotos() {
    try {
      const raw = localStorage.getItem(photoStorageKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      return Array.isArray(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  const savedPhotos = loadSavedPhotos();
  let photos = savedPhotos === null ? [...data.gallery] : savedPhotos;

  function formatMemoryDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || "")
      ? formatFoodDate(value)
      : value || "OUR MEMORY";
  }

  function makeGalleryItem(item, index) {
    const figure = document.createElement("figure");
    figure.className = `gallery-item gallery-item--${item.size} reveal`;
    figure.innerHTML = `
      <button type="button" aria-label="查看照片记录：${item.title}">
        <span class="gallery-item__image">
          <img src="${item.image}" alt="${item.alt}" loading="lazy" />
          <span class="gallery-item__zoom" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m20 20-4-4M11 8v6M8 11h6"></path>
            </svg>
          </span>
        </span>
        <figcaption>
          <span class="gallery-item__number">${String(index + 1).padStart(2, "0")}</span>
          <span>
            <strong>${item.title}</strong>
            <small>${formatMemoryDate(item.date)} · ${item.place || "岳岳 × 昆昆"}</small>
          </span>
        </figcaption>
      </button>
    `;
    figure
      .querySelector("button")
      .addEventListener("click", () => openMemory(item));

    const actions = document.createElement("div");
    actions.className = "gallery-item__actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "编辑";
    editButton.setAttribute("aria-label", `编辑照片记录：${item.title}`);
    editButton.addEventListener("click", () => beginPhotoEdit(item));
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "删除";
    removeButton.setAttribute("aria-label", `删除照片记录：${item.title}`);
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!window.confirm(`确定删除“${item.title}”这张照片记录吗？`)) return;
      markRecordDeleted(photoStorageKey, item.id);
      photos = photos.filter((photo) => photo.id !== item.id);
      localStorage.setItem(photoStorageKey, JSON.stringify(photos));
      renderPhotos();
      renderRecentMemories();
      showToast("照片记录已删除");
    });
    actions.append(editButton, removeButton);
    figure.append(actions);
    return figure;
  }

  const galleryGrid = $("#galleryGrid");
  function renderPhotos() {
    galleryGrid.innerHTML = "";
    galleryGrid.classList.toggle("is-empty", photos.length === 0);
    setText("#photoFormCount", `${photos.length} 张照片`);
    setText("#hubPhotoCount", `${photos.length} 张照片`);
    if (photos.length === 0) {
      $("#randomMemory").hidden = true;
    } else {
      photos.forEach((item, index) =>
        galleryGrid.append(makeGalleryItem(item, index)),
      );
      $("#randomMemory").hidden = false;
    }
    observeReveals(galleryGrid);
    syncFeaturedPhotos();
  }

  function syncFeaturedPhotos() {
    const featured = [
      ["#introMemoryPhoto", photos[0]],
      ["#hubMemoryPhotoOne", photos[0]],
      ["#hubMemoryPhotoTwo", photos[1]],
      ["#hubMemoryPhotoThree", photos[2]],
    ];
    featured.forEach(([selector, item]) => {
      const image = $(selector);
      if (!image || !item?.image) return;
      image.src = item.image;
      image.alt = item.alt || item.title || "我们的照片";
    });
  }

  function resetPhotoForm() {
    photoForm.reset();
    setDefaultDate(photoDate, true);
    pendingGalleryPhoto = "";
    pendingGalleryStoragePath = "";
    editingPhotoId = null;
    photoUploadPreview.removeAttribute("src");
    photoUploadPreview.hidden = true;
    photoUploadPicker.hidden = false;
    photoUpload.required = true;
    cancelPhotoEdit.hidden = true;
    photoSubmitLabel.textContent = "收进照片册";
  }

  function beginPhotoEdit(item) {
    editingPhotoId = item.id;
    photoDate.value = item.date || "";
    keepSelectedDate(photoDate);
    photoTitle.value = item.title || "";
    photoStory.value = item.text || "";
    pendingGalleryPhoto = item.image || "";
    pendingGalleryStoragePath = item.storagePath || "";
    photoUpload.required = false;
    if (item.image) {
      photoUploadPreview.src = item.image;
      photoUploadPreview.hidden = false;
      photoUploadPicker.hidden = true;
    }
    cancelPhotoEdit.hidden = false;
    photoSubmitLabel.textContent = "保存修改";
    photoForm.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => photoTitle.focus(), 300);
  }

  photoUpload.addEventListener("change", async () => {
    const [file] = photoUpload.files;
    if (!file) return;
    try {
      pendingGalleryPhoto = await compressFoodPhoto(file);
      pendingGalleryStoragePath = "";
      photoUploadPreview.src = pendingGalleryPhoto;
      photoUploadPreview.hidden = false;
      photoUploadPicker.hidden = true;
    } catch (error) {
      photoUpload.value = "";
      showToast(error instanceof Error ? error.message : "照片读取失败");
    }
  });

  photoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!photoTitle.value.trim() || !pendingGalleryPhoto) {
      showToast("给照片起个名字，再选一张照片吧");
      return;
    }
    let storedPhoto;
    try {
      storedPhoto = await persistRecordPhoto(pendingGalleryPhoto, "gallery");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "照片上传失败，请再试一次",
      );
      return;
    }
    const nextPhoto = {
      id: editingPhotoId || `photo-${Date.now()}`,
      date: photoDate.value,
      title: photoTitle.value.trim(),
      text: photoStory.value.trim() || "这一天的故事，等我们再慢慢补上。",
      place: editingPhotoId
        ? photos.find((item) => item.id === editingPhotoId)?.place ||
          "岳岳 × 昆昆"
        : "岳岳 × 昆昆",
      image: storedPhoto.image,
      storagePath: storedPhoto.storagePath || pendingGalleryStoragePath,
      alt: photoTitle.value.trim(),
      size:
        (editingPhotoId &&
          photos.find((item) => item.id === editingPhotoId)?.size) ||
        photoSizes[photos.length % photoSizes.length],
      updatedAt: new Date().toISOString(),
    };
    const nextPhotos = editingPhotoId
      ? photos.map((item) => (item.id === editingPhotoId ? nextPhoto : item))
      : [nextPhoto, ...photos];
    try {
      localStorage.setItem(photoStorageKey, JSON.stringify(nextPhotos));
    } catch {
      showToast("照片占用的存储空间较大，暂时无法保存");
      return;
    }
    photos = nextPhotos;
    renderPhotos();
    renderRecentMemories();
    const wasEditing = Boolean(editingPhotoId);
    resetPhotoForm();
    showToast(wasEditing ? "这张照片记录已经修改好了" : "这张照片已经收进照片册");
  });

  cancelPhotoEdit.addEventListener("click", resetPhotoForm);
  renderPhotos();

  /* Arguments */

  const argumentStorageKey = "between-us-argument-records-v1";
  const argumentForm = $("#argumentForm");
  const argumentDate = $("#argumentDate");
  const argumentTitle = $("#argumentTitle");
  const argumentTrigger = $("#argumentTrigger");
  const argumentLesson = $("#argumentLesson");
  const cancelArgumentEdit = $("#cancelArgumentEdit");
  const argumentSubmitLabel = argumentForm.querySelector(
    'button[type="submit"] span',
  );
  let editingArgumentId = null;
  const savedArguments = loadArray(argumentStorageKey);
  let argumentRecords = (
    savedArguments === null ? [...data.arguments] : savedArguments
  ).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const argumentList = $("#argumentList");

  function renderArguments() {
    argumentList.innerHTML = "";
    argumentList.classList.toggle("is-empty", argumentRecords.length === 0);
    setText("#argumentFormCount", `${argumentRecords.length} 次复盘`);
    setText("#hubArgumentCount", `${argumentRecords.length} 次复盘`);
    if (argumentRecords.length > 0) {
      argumentRecords.forEach((item, index) => {
        const details = document.createElement("details");
        details.className = "argument-item reveal";
        if (index === 0) details.open = true;
        details.innerHTML = `
        <summary>
          <span class="argument-item__number">${String(index + 1).padStart(2, "0")}</span>
          <span class="argument-item__title">
            <small>${formatMemoryDate(item.date)} · ${item.place}</small>
            <strong>${item.title}</strong>
          </span>
          <span class="argument-item__duration">${item.duration || "已经和好"}</span>
          <span class="argument-item__toggle" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
          </span>
        </summary>
        <div class="argument-item__body">
          <div><span>那次因为什么</span><p>${item.trigger}</p></div>
          <div class="argument-item__lesson"><span>我们学到了</span><p>${item.learned}</p></div>
        </div>
        <div class="record-manage">
          <button type="button" data-argument-edit="${item.id}">编辑</button>
          <button type="button" data-argument-delete="${item.id}">删除这条复盘</button>
        </div>
      `;
        details
          .querySelector("[data-argument-edit]")
          .addEventListener("click", () => beginArgumentEdit(item));
        details
          .querySelector("[data-argument-delete]")
          .addEventListener("click", () => {
            if (!window.confirm(`确定删除“${item.title}”这条复盘吗？`)) return;
            markRecordDeleted(argumentStorageKey, item.id);
            argumentRecords = argumentRecords.filter(
              (record) => record.id !== item.id,
            );
            localStorage.setItem(
              argumentStorageKey,
              JSON.stringify(argumentRecords),
            );
            renderArguments();
            renderRecentMemories();
            showToast("这次复盘已删除");
          });
        argumentList.append(details);
      });
    }
    observeReveals(argumentList);
  }

  function beginArgumentEdit(item) {
    editingArgumentId = item.id;
    argumentDate.value = item.date || "";
    keepSelectedDate(argumentDate);
    argumentTitle.value = item.title || "";
    argumentTrigger.value = item.trigger || "";
    argumentLesson.value = item.learned || "";
    cancelArgumentEdit.hidden = false;
    argumentSubmitLabel.textContent = "保存修改";
    argumentForm.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => argumentTitle.focus(), 300);
  }

  function resetArgumentForm() {
    editingArgumentId = null;
    argumentForm.reset();
    setDefaultDate(argumentDate, true);
    cancelArgumentEdit.hidden = true;
    argumentSubmitLabel.textContent = "完成这次复盘";
  }

  argumentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      !argumentDate.value ||
      !argumentTitle.value.trim() ||
      !argumentTrigger.value.trim()
    ) {
      showToast("把日期、争执和当时发生了什么写下来吧");
      return;
    }
    const nextArgument = {
      id: editingArgumentId || `argument-${Date.now()}`,
      date: argumentDate.value,
      title: argumentTitle.value.trim(),
      place: editingArgumentId
        ? argumentRecords.find((item) => item.id === editingArgumentId)
            ?.place || "我们的复盘"
        : "我们的复盘",
      trigger: argumentTrigger.value.trim(),
      resolution: "",
      learned: argumentLesson.value.trim() || "下次更早一点听懂彼此。",
      duration: "已经和好",
      updatedAt: new Date().toISOString(),
    };
    const nextArguments = (
      editingArgumentId
        ? argumentRecords.map((item) =>
            item.id === editingArgumentId ? nextArgument : item,
          )
        : [nextArgument, ...argumentRecords]
    ).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    try {
      localStorage.setItem(argumentStorageKey, JSON.stringify(nextArguments));
    } catch {
      showToast("这次复盘暂时无法保存");
      return;
    }
    argumentRecords = nextArguments;
    const wasEditing = Boolean(editingArgumentId);
    resetArgumentForm();
    renderArguments();
    renderRecentMemories();
    showToast(wasEditing ? "这次复盘已经修改好了" : "这次争执已经认真复盘好了");
  });

  cancelArgumentEdit.addEventListener("click", resetArgumentForm);
  renderArguments();

  /* Heartbeats */

  const heartbeatStorageKey = "between-us-heartbeat-records-v1";
  const heartbeatForm = $("#heartbeatForm");
  const heartbeatDate = $("#heartbeatDate");
  const heartbeatTitle = $("#heartbeatTitle");
  const heartbeatStory = $("#heartbeatStory");
  const heartbeatPhoto = $("#heartbeatPhoto");
  const heartbeatPhotoPicker = $("#heartbeatPhotoPicker");
  const heartbeatPhotoPreview = $("#heartbeatPhotoPreview");
  const cancelHeartbeatEdit = $("#cancelHeartbeatEdit");
  const heartbeatSubmitLabel = heartbeatForm.querySelector(
    'button[type="submit"] span',
  );
  let pendingHeartbeatPhoto = "";
  let pendingHeartbeatStoragePath = "";
  let editingHeartbeatId = null;
  const savedHeartbeats = loadArray(heartbeatStorageKey);
  let heartbeats = (
    savedHeartbeats === null ? [...data.heartbeats] : savedHeartbeats
  ).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const heartbeatList = $("#heartbeatList");

  function renderHeartbeats() {
    heartbeatList.innerHTML = "";
    heartbeatList.classList.toggle("is-empty", heartbeats.length === 0);
    setText("#heartbeatFormCount", `${heartbeats.length} 个瞬间`);
    setText("#hubHeartbeatCount", `${heartbeats.length} 个瞬间`);
    if (heartbeats.length > 0) {
      heartbeats.forEach((item, index) => {
        const article = document.createElement("article");
        article.className = "timeline-item reveal";
        article.innerHTML = `
        <div class="timeline-item__meta">
          <span class="timeline-item__year">${item.year || formatMemoryDate(item.date).slice(0, 4)}</span>
          <span class="timeline-item__chapter">${item.chapter || `心动 ${String(index + 1).padStart(2, "0")}`}</span>
        </div>
        <div class="timeline-item__dot" aria-hidden="true"><span></span></div>
        <div class="timeline-item__card">
          <div class="timeline-item__image ${item.image ? "" : "timeline-item__image--empty"}">
            ${item.image ? `<img src="${item.image}" alt="${item.alt || item.title}" loading="lazy" />` : '<span class="timeline-heart">♡</span>'}
            <span class="timeline-item__index">${String(index + 1).padStart(2, "0")}</span>
          </div>
          <div class="timeline-item__body">
            <div class="timeline-item__heading">
              <div><time>${formatMemoryDate(item.date)}</time><h3>${item.title}</h3></div>
              <span>${item.place || "岳岳 × 昆昆"}</span>
            </div>
            <p>${item.text}</p>
            <blockquote>“${item.quote || "那一刻，心里软了一下。"}”</blockquote>
            <div class="timeline-item__actions">
              <button type="button" data-heartbeat-edit="${item.id}">编辑</button>
              <button type="button" data-heartbeat-delete="${item.id}">删除</button>
            </div>
          </div>
        </div>
      `;
        article
          .querySelector("[data-heartbeat-edit]")
          .addEventListener("click", (event) => {
            event.stopPropagation();
            beginHeartbeatEdit(item);
          });
        const heartbeatDelete = article.querySelector(
          "[data-heartbeat-delete]",
        );
        heartbeatDelete.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!window.confirm(`确定删除“${item.title}”这个心动瞬间吗？`)) {
            return;
          }
          markRecordDeleted(heartbeatStorageKey, item.id);
          heartbeats = heartbeats.filter((record) => record.id !== item.id);
          localStorage.setItem(
            heartbeatStorageKey,
            JSON.stringify(heartbeats),
          );
          renderHeartbeats();
          renderRecentMemories();
          showToast("这次心动已删除");
        });
        if (item.image) {
          article.tabIndex = 0;
          article.setAttribute("role", "button");
          article.setAttribute("aria-label", `打开心动瞬间：${item.title}`);
          article.addEventListener("click", () => openMemory(item));
          article.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") openMemory(item);
          });
        }
        heartbeatList.append(article);
      });
    }
    observeReveals(heartbeatList);
  }

  function beginHeartbeatEdit(item) {
    editingHeartbeatId = item.id;
    heartbeatDate.value = item.date || "";
    keepSelectedDate(heartbeatDate);
    heartbeatTitle.value = item.title || "";
    heartbeatStory.value = item.text || "";
    pendingHeartbeatPhoto = item.image || "";
    pendingHeartbeatStoragePath = item.storagePath || "";
    if (item.image) {
      heartbeatPhotoPreview.src = item.image;
      heartbeatPhotoPreview.hidden = false;
      heartbeatPhotoPicker.hidden = true;
    } else {
      heartbeatPhotoPreview.removeAttribute("src");
      heartbeatPhotoPreview.hidden = true;
      heartbeatPhotoPicker.hidden = false;
    }
    cancelHeartbeatEdit.hidden = false;
    heartbeatSubmitLabel.textContent = "保存这次心动";
    heartbeatForm.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => heartbeatTitle.focus(), 300);
  }

  function resetHeartbeatForm() {
    editingHeartbeatId = null;
    heartbeatForm.reset();
    setDefaultDate(heartbeatDate, true);
    pendingHeartbeatPhoto = "";
    pendingHeartbeatStoragePath = "";
    heartbeatPhotoPreview.removeAttribute("src");
    heartbeatPhotoPreview.hidden = true;
    heartbeatPhotoPicker.hidden = false;
    cancelHeartbeatEdit.hidden = true;
    heartbeatSubmitLabel.textContent = "收下这次心动";
  }

  heartbeatPhoto.addEventListener("change", async () => {
    const [file] = heartbeatPhoto.files;
    if (!file) return;
    try {
      pendingHeartbeatPhoto = await compressFoodPhoto(file);
      pendingHeartbeatStoragePath = "";
      heartbeatPhotoPreview.src = pendingHeartbeatPhoto;
      heartbeatPhotoPreview.hidden = false;
      heartbeatPhotoPicker.hidden = true;
    } catch (error) {
      heartbeatPhoto.value = "";
      showToast(error instanceof Error ? error.message : "照片读取失败");
    }
  });

  heartbeatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (
      !heartbeatDate.value ||
      !heartbeatTitle.value.trim() ||
      !heartbeatStory.value.trim()
    ) {
      showToast("把日期、发生了什么和心里想的话都写下来吧");
      return;
    }
    let storedPhoto;
    try {
      storedPhoto = await persistRecordPhoto(
        pendingHeartbeatPhoto,
        "heartbeats",
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "照片上传失败，请再试一次",
      );
      return;
    }
    const nextHeartbeat = {
      id: editingHeartbeatId || `heartbeat-${Date.now()}`,
      date: heartbeatDate.value,
      year: heartbeatDate.value.slice(0, 4),
      title: heartbeatTitle.value.trim(),
      text: heartbeatStory.value.trim(),
      image: storedPhoto.image,
      storagePath: storedPhoto.storagePath || pendingHeartbeatStoragePath,
      alt: heartbeatTitle.value.trim(),
      place: editingHeartbeatId
        ? heartbeats.find((item) => item.id === editingHeartbeatId)?.place ||
          "岳岳 × 昆昆"
        : "岳岳 × 昆昆",
      quote: editingHeartbeatId
        ? heartbeats.find((item) => item.id === editingHeartbeatId)?.quote ||
          "这一刻，想和你记很久很久。"
        : "这一刻，想和你记很久很久。",
      updatedAt: new Date().toISOString(),
    };
    const nextHeartbeats = (
      editingHeartbeatId
        ? heartbeats.map((item) =>
            item.id === editingHeartbeatId ? nextHeartbeat : item,
          )
        : [nextHeartbeat, ...heartbeats]
    ).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    try {
      localStorage.setItem(heartbeatStorageKey, JSON.stringify(nextHeartbeats));
    } catch {
      showToast("这次心动暂时无法保存");
      return;
    }
    heartbeats = nextHeartbeats;
    const wasEditing = Boolean(editingHeartbeatId);
    resetHeartbeatForm();
    renderHeartbeats();
    renderRecentMemories();
    showToast(wasEditing ? "这个心动瞬间已经修改好了" : "这一次心动已经记下来了");
  });

  cancelHeartbeatEdit.addEventListener("click", resetHeartbeatForm);
  renderHeartbeats();
  [mealDate, photoDate, argumentDate, heartbeatDate].forEach(
    registerDefaultDate,
  );
  window.setInterval(refreshDefaultDates, 60 * 1000);

  /* Recent memories and local backup */

  function escapeRecentText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderRecentMemories() {
    const target = $("#recentMemoryList");
    if (!target) return;
    const entries = [
      ...foods.map((item) => ({
        type: "一起吃过的",
        emoji: "🍰",
        href: "#foods",
        date: item.date,
        title: item.name,
        text: ratingLabels[item.rating] || "一起吃的一顿",
        image: item.image,
      })),
      ...photos.map((item) => ({
        type: "照片",
        emoji: "📷",
        href: "#moments",
        date: item.date,
        title: item.title,
        text: item.text,
        image: item.image,
      })),
      ...heartbeats.map((item) => ({
        type: "心动瞬间",
        emoji: "💗",
        href: "#heartbeats",
        date: item.date,
        title: item.title,
        text: item.text,
        image: item.image,
      })),
    ];
    entries.sort((a, b) => {
      const aDate = /^\d{4}-\d{2}-\d{2}$/.test(a.date || "")
        ? a.date
        : "";
      const bDate = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "")
        ? b.date
        : "";
      return bDate.localeCompare(aDate);
    });
    const recent = entries.slice(0, 4);
    target.innerHTML =
      recent.length === 0
        ? '<p class="recent-empty">这里还很空，等我们继续写一点点。</p>'
        : recent
            .map(
              (item) => `
                <a class="recent-memory-card" href="${item.href}">
                  <span class="recent-memory-card__visual">
                    ${item.image ? `<img src="${escapeRecentText(item.image)}" alt="" loading="lazy" />` : ""}
                    <span class="recent-memory-card__type">${item.type}</span>
                    <span class="recent-memory-card__emoji">${item.emoji}</span>
                  </span>
                  <span class="recent-memory-card__body">
                    <time>${escapeRecentText(formatMemoryDate(item.date))}</time>
                    <strong>${escapeRecentText(item.title)}</strong>
                    <p>${escapeRecentText(item.text)}</p>
                  </span>
                </a>
              `,
            )
            .join("");
    observeReveals(target);
  }

  $("#exportRecords")?.addEventListener("click", () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      couple: data.couple,
      foods,
      hundredThings,
      photos,
      arguments: argumentRecords,
      heartbeats,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `岳岳和昆昆的回忆备份-${currentChinaDate()}.json`;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    showToast("全部记录已经备份到电脑");
  });

  renderHundredList();
  renderRecentMemories();
  observeReveals();

  /* Intro */

  const introGate = $("#introGate");
  let firstRouteAfterIntro = true;

  function finishIntro(immediate = false) {
    introGate.classList.add("is-leaving");
    document.body.classList.add("intro-complete");
    window.setTimeout(
      () => {
        introGate.hidden = true;
        $$(".reveal").forEach((item) => item.classList.add("is-visible"));
      },
      immediate || reducedMotion ? 0 : 850,
    );
  }

  $("#enterStory").addEventListener("click", () => finishIntro());

  /* Five-book router */

  const pages = new Map(
    $$(".app-page").map((page) => [page.dataset.page, page]),
  );
  const pageLabels = {
    home: "五本共同记录",
    foods: "一起吃过的",
    hundred: "一起做的一百件事",
    moments: "一起拍的照片",
    arguments: "一起吵过的架",
    heartbeats: "心动瞬间",
  };
  const homeLink = $("#homeLink");
  const pageLabel = $("#pageLabel");

  function route() {
    let requested = location.hash.slice(1) || "home";
    if (firstRouteAfterIntro) {
      firstRouteAfterIntro = false;
      requested = "home";
      try {
        history.replaceState(
          null,
          "",
          `${location.pathname}${location.search}#home`,
        );
      } catch {
        // Deep links still resolve when browser history is unavailable.
      }
    }
    const activeName = pages.has(requested) ? requested : "home";
    if (requested !== activeName) {
      history.replaceState(null, "", "#home");
    }

    pages.forEach((page, name) => {
      const active = name === activeName;
      page.hidden = !active;
      page.classList.toggle("is-active", active);
      if (active) {
        $$(".reveal", page).forEach((item) => {
          if (item.getBoundingClientRect().top < innerHeight * 1.1) {
            item.classList.add("is-visible");
          }
        });
      }
    });

    if (activeName === "home") renderRecentMemories();

    homeLink.hidden = activeName === "home";
    pageLabel.textContent = pageLabels[activeName];
    document.title =
      activeName === "home"
        ? "我们之间 · 五本共同记录"
        : `${pageLabels[activeName]} · 我们之间`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  window.addEventListener("hashchange", route);
  route();

  /* Header */

  const header = $("#siteHeader");
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Memory dialog */

  const dialog = $("#memoryDialog");
  const closeDialog = $("#closeDialog");

  function openMemory(item) {
    $("#dialogImage").src = item.image;
    $("#dialogImage").alt = item.alt;
    setText("#dialogDate", item.date || "OUR MEMORY");
    setText("#dialogTitle", item.title);
    setText("#dialogText", item.text);
    setText("#dialogPlace", item.place || "");
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    document.body.classList.add("dialog-open");
  }

  closeDialog.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () =>
    document.body.classList.remove("dialog-open"),
  );

  $("#randomMemory").addEventListener("click", () => {
    if (photos.length === 0) return;
    const next = Math.floor(Math.random() * photos.length);
    openMemory(photos[next]);
  });

  /* Toast */

  let toastTimer;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => toast.classList.remove("is-visible"),
      2200,
    );
  }
})();
