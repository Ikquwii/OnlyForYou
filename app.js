(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('garden');
  const ctx = canvas.getContext('2d');
  const stageView = $('journey-view');
  const finale = $('finale');
  const actionButton = $('story-action');
  const actionLabel = actionButton.querySelector('span');
  const pauseButton = $('pause-toggle');
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STORAGE = 'yana-cat-delivery-v1';
  const hotspotButtons = [$('bridge-hotspot'), $('bell-hotspot'), $('window-hotspot')];
  const worldPoints = { bridge: [830, 745], gate: [1972, 472], window: [3380, 350] };
  const checkpointNames = new Set(['intro', 'bridge', 'gate', 'window', 'complete']);
  const assets = {};
  let model;
  let state;
  let ready = false;
  let userPaused = false;
  let pageSuspended = false;
  let disposed = false;
  let lastFrame = 0;
  let raf = 0;
  let time = 0;
  let cameraX = 0;
  let worldScale = 1;
  let offsetY = 0;
  let width = 1;
  let height = 1;
  let stageName = '';
  let lastCheckpoint = 'intro';
  let drag = null;
  let finaleShown = false;
  let renderFailed = false;
  let ignoreBridgeClickUntil = 0;
  const copy = {
    intro: { title: 'Кто-то к тебе', em: 'спешит.', description: '', instruction: 'Проводишь его?', small: '', action: 'Пойдём с котиком', chapter: '' },
    'walk-bridge': { title: 'Он уже', em: 'в пути.', description: 'Можно погладить его по спинке.', instruction: 'Котик сам знает дорогу.', small: 'Коснись его — кажется, он не против внимания.', chapter: 'Через сад' },
    bridge: { title: 'Здесь нужен', em: 'маленький мостик.', description: 'Доска как раз рядом.\nПоможешь нашему курьеру?', instruction: 'Перенеси доску к ручью.', small: 'Или просто нажми на мостик.', action: 'Положить мостик', chapter: 'Через ручей' },
    'making-bridge': { title: 'Вот так.', em: 'Теперь можно.', description: 'Иногда достаточно\nодного маленького шага.', instruction: 'Мостик на месте.', small: 'Курьер уже собирается дальше.', chapter: 'Через ручей' },
    'walk-gate': { title: 'Шаг за', em: 'шагом.', description: 'Можно в своём темпе.\nГлавное — продолжать.', instruction: 'Кажется, впереди калитка.', small: 'А за ней уже совсем близко.', chapter: 'Садовая калитка' },
    gate: { title: 'Тихонько', em: 'позвоним?', description: 'У этой калитки\nесть маленький колокольчик.', instruction: 'Коснись колокольчика.', small: 'Пусть в саду знают, что мы пришли.', action: 'Позвонить', chapter: 'Садовая калитка' },
    'opening-gate': { title: 'Нас уже', em: 'ждали.', description: 'Можно идти.\nЦветы почти у цели.', instruction: 'Дорога открыта.', small: 'Ещё немного.', chapter: 'Садовая калитка' },
    'walk-window': { title: 'Ещё совсем', em: 'чуть-чуть.', description: 'Он старается.\nПодарок должен доехать целым.', instruction: 'Вон то тёплое окошко.', small: 'Котик уже его заметил.', chapter: 'Почти пришли' },
    window: { title: 'Кажется,', em: 'мы на месте.', description: 'Осталось только\nпозвать маленького курьера.', instruction: 'Тук-тук. Это для Яны.', small: 'Позови котика к окну.', action: 'Позвать котика', chapter: 'Доставка для Яны' },
    delivery: { title: 'Доставка', em: 'для Яны.', description: 'Осторожно: тут\nкое-что очень нежное.', instruction: 'Маленький курьер справился.', small: 'И принёс тебе кое-что ещё.', chapter: 'Доставка для Яны' },
    complete: { title: '', em: '', description: '', instruction: '', small: '', chapter: 'Для Яны' }
  };
  function announce(message) { $('announcement').textContent = message; }
  function setLines(target, value) {
    target.replaceChildren(...value.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
  }
  function persist(checkpoint) {
    if (checkpoint === lastCheckpoint) return;
    lastCheckpoint = checkpoint;
    try { localStorage.setItem(STORAGE, JSON.stringify({ version: 1, checkpoint })); } catch (_) { /* Storage is optional; the story continues in memory. */ }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.version === 1 && checkpointNames.has(saved.checkpoint)) {
        model.restore(saved.checkpoint);
        lastCheckpoint = saved.checkpoint;
      }
    } catch (_) { /* An unavailable or damaged checkpoint starts a new walk. */ }
  }
  function stageAction() {
    if (!ready || renderFailed || disposed) return;
    if (userPaused) { userPaused = false; syncPause(); return; }
    if (document.hidden || pageSuspended) return;
    let acted = false;
    if (state.stage === 'intro') acted = model.start();
    else if (state.stage === 'bridge') acted = model.action('bridge');
    else if (state.stage === 'gate') acted = model.action('bell');
    else if (state.stage === 'window') acted = model.action('window');
    if (acted) {
      releaseDrag();
      update();
    }
  }
  function update() {
    if (!model) return;
    state = model.snapshot();
    persist(state.checkpoint);
    if (state.complete) showFinale();
    if (stageName === state.stage) return;
    stageName = state.stage;
    stageView.dataset.stage = state.stage;
    const text = copy[state.stage] || copy.intro;
    $('story-title').replaceChildren(document.createTextNode(text.title + ' '));
    const em = document.createElement('em'); em.textContent = text.em; $('story-title').append(em);
    setLines($('story-description'), text.description);
    $('story-description').hidden = !text.description;
    $('story-copy').classList.toggle('is-travelling', state.stage !== 'intro');
    $('instruction').textContent = text.instruction;
    $('small-note').textContent = text.small;
    $('small-note').hidden = !text.small;
    $('chapter-label').textContent = text.chapter;
    $('chapter-label').hidden = !text.chapter;
    $('restart-small').hidden = state.stage === 'intro';
    actionButton.hidden = !text.action;
    actionLabel.textContent = text.action || '';
    actionButton.disabled = !ready;
    hotspotButtons.forEach(button => { button.hidden = true; });
    if (state.stage === 'bridge') $('bridge-hotspot').hidden = false;
    if (state.stage === 'gate') $('bell-hotspot').hidden = false;
    if (state.stage === 'window') $('window-hotspot').hidden = false;
    syncPauseControls();
    if (ready && state.stage !== 'intro' && state.stage !== 'complete') announce([text.title, text.em, text.instruction].join(' '));
  }
  function syncPauseControls() {
    pauseButton.setAttribute('aria-pressed', String(userPaused));
    pauseButton.setAttribute('aria-label', userPaused ? 'Продолжить прогулку' : 'Приостановить прогулку');
    pauseButton.querySelector('use').setAttribute('href', userPaused ? '#play' : '#pause');
    hotspotButtons.forEach(button => { button.disabled = userPaused; });
    if (userPaused && !finaleShown) {
      actionButton.hidden = false;
      actionLabel.textContent = 'Продолжить прогулку';
      $('instruction').textContent = 'Котик немного отдохнёт.';
      $('small-note').textContent = 'Продолжим, когда захочешь.';
      $('small-note').hidden = false;
    }
  }
  function syncPause() {
    const paused = userPaused || document.hidden || pageSuspended;
    model?.setPaused(paused);
    if (paused) releaseDrag();
    stageName = '';
    update();
    lastFrame = 0;
  }
  function showFinale() {
    if (finaleShown) return;
    finaleShown = true;
    releaseDrag();
    stageView.hidden = true;
    finale.hidden = false;
    pauseButton.hidden = false;
    document.body.dataset.complete = 'true';
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('final-title').focus({ preventScroll: true });
    announce('Яна, у тебя всё получится. Я в тебя верю. Котик принёс розовые пионы и записку от Егора.');
  }
  function reset() {
    releaseDrag();
    model.reset();
    lastCheckpoint = '';
    persist('intro');
    stageName = '';
    finaleShown = false;
    userPaused = false;
    finale.hidden = true;
    stageView.hidden = false;
    pauseButton.hidden = false;
    delete document.body.dataset.complete;
    cameraX = 0;
    time = 0;
    syncPause();
    resize();
    actionButton.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    announce('Котик снова в саду. Можно отправиться в новую прогулку.');
  }
  function resize() {
    if (!ctx || stageView.hidden) return;
    releaseDrag();
    const rect = stageView.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    worldScale = width <= 700 ? width / 660 : Math.min(width / 1600, height / 900);
    worldScale = Math.max(.4, Math.min(worldScale, 1.2));
    const ground = height * (width <= 700 ? .70 : .76);
    offsetY = ground - 700 * worldScale;
    cameraX = Math.max(0, Math.min(cameraX, 3600 - width / worldScale));
    draw();
  }
  function cameraTarget() {
    const view = width / worldScale;
    let focus = state.x - view * .38;
    if (state.stage === 'bridge' || state.stage === 'making-bridge') focus = 930 - view * .57;
    if (state.stage === 'gate' || state.stage === 'opening-gate') focus = 1870 - view * .57;
    if (state.stage === 'window') focus = 3120 - view * .5;
    if (state.stage === 'delivery') focus = state.x - view * .38;
    return Math.max(0, Math.min(focus, Math.max(0, 3600 - view)));
  }
  function positionHotspots() {
    const pairs = [['bridge-hotspot', 'bridge'], ['bell-hotspot', 'gate'], ['window-hotspot', 'window']];
    pairs.forEach(([id, key]) => {
      const button = $(id);
      if (button.hidden || drag?.button === button) return;
      const [x, y] = worldPoints[key];
      button.style.left = (x - cameraX) * worldScale + 'px';
      button.style.top = offsetY + y * worldScale + 'px';
    });
  }
  function draw() {
    if (!ctx || !ready || renderFailed || !state || stageView.hidden) return;
    const ratio = canvas.width / width;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8e9d3'; ctx.fillRect(0, 0, width, height);
    const bottom = offsetY + 900 * worldScale;
    if (bottom < height) { ctx.fillStyle = '#c9ce9f'; ctx.fillRect(0, bottom, width, height - bottom); }
    ctx.save(); ctx.translate(-cameraX * worldScale, offsetY); ctx.scale(worldScale, worldScale);
    const options = { time: time * 1000, cameraX, viewportWidth: width / worldScale, progress: state.x / 3600, bridge: state.bridge, gate: state.gate, flowers: state.bridge + state.gate, plankPosition: drag?.moved ? drag.world : null, final: state.delivery, reducedMotion: reducedQuery.matches, assets };
    window.GardenWorld.draw(ctx, options);
    const jump = reducedQuery.matches && state.stage === 'delivery' ? 200 * Math.min(1, (state.x - 3000) / 380) : state.jump;
    window.CatCharacter.draw(ctx, { x: state.x, y: 700, time, speed: state.speed / 180, phase: state.phase, jump, pet: state.pet, delivery: state.delivery, reducedMotion: reducedQuery.matches });
    // The same little wrapped bouquet travels with the courier, then stays at the window.
    if (state.delivery < .9) {
      ctx.save(); ctx.translate(state.x + 77, 700 - jump - 28); ctx.rotate(-.24 + Math.sin(state.phase * 2) * .025 * Math.min(1, state.speed / 180));
      window.GardenWorld.drawBouquet(ctx, { x: 0, y: 0, scale: .24, open: 1, time: 0 }); ctx.restore();
    }
    window.GardenWorld.drawForeground(ctx, options);
    ctx.restore();
    if (offsetY > 0) {
      const edge = ctx.createLinearGradient(0, offsetY, 0, offsetY + 85);
      edge.addColorStop(0, '#f8e9d3'); edge.addColorStop(1, 'rgba(248,233,211,0)');
      ctx.fillStyle = edge; ctx.fillRect(0, offsetY, width, 85);
    }
    const bottomEdge = offsetY + 900 * worldScale;
    if (bottomEdge < height) {
      const paper = ctx.createLinearGradient(0, bottomEdge - 85, 0, bottomEdge);
      paper.addColorStop(0, 'rgba(247,239,227,0)'); paper.addColorStop(1, '#f7efe3');
      ctx.fillStyle = paper; ctx.fillRect(0, bottomEdge - 85, width, 85);
      ctx.fillStyle = '#f7efe3'; ctx.fillRect(0, bottomEdge, width, height - bottomEdge);
    }
    positionHotspots();
  }
  function drawFinalCat() {
    if (!finaleShown || !window.CatCharacter) return;
    const finalCanvas = $('final-cat');
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) return;
    finalCtx.clearRect(0, 0, 340, 220);
    window.CatCharacter.draw(finalCtx, { x: 177, y: 195, scale: 1.15, time, pet: .35, reducedMotion: reducedQuery.matches });
  }
  function frame(stamp) {
    if (disposed) return;
    const dt = lastFrame ? Math.min(.05, Math.max(0, (stamp - lastFrame) / 1000)) : 0;
    lastFrame = stamp;
    if (!document.hidden && !pageSuspended && !userPaused && ready && !renderFailed) {
      time += dt;
      model.step(dt); update();
      const target = cameraTarget();
      cameraX += (target - cameraX) * (1 - Math.exp(-dt * 3.8));
      try { draw(); drawFinalCat(); } catch (error) { failScene(error); }
    }
    raf = requestAnimationFrame(frame);
  }
  function failScene(error) {
    if (renderFailed) return;
    renderFailed = true;
    console.error('Garden rendering failed:', error);
    actionButton.hidden = false; actionButton.disabled = true;
    actionLabel.textContent = 'Сад не загрузился';
    $('instruction').textContent = 'Обнови страницу — попробуем ещё раз.';
    $('small-note').textContent = 'Яна, я в тебя верю. Егор.';
    announce('Сад не удалось открыть. Обнови страницу, чтобы попробовать ещё раз.');
  }
  function coordinates(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / worldScale + cameraX, y: (event.clientY - rect.top - offsetY) / worldScale };
  }
  function releaseDrag() {
    if (!drag) return;
    const current = drag; drag = null;
    current.button.classList.remove('is-dragging');
    try { if (current.button.hasPointerCapture(current.id)) current.button.releasePointerCapture(current.id); } catch (_) {}
    positionHotspots();
  }
  $('bridge-hotspot').addEventListener('pointerdown', event => {
    if (state?.stage !== 'bridge' || userPaused || !event.isPrimary || event.button !== 0) return;
    drag = { button: event.currentTarget, id: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
  });
  window.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) drag.moved = true;
    if (drag.moved) {
      drag.button.classList.add('is-dragging');
      drag.world = coordinates(event);
      const rect = stageView.getBoundingClientRect();
      drag.button.style.left = event.clientX - rect.left + 'px';
      drag.button.style.top = event.clientY - rect.top + 'px';
    }
  });
  window.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    if (moved) ignoreBridgeClickUntil = performance.now() + 600;
    const pos = coordinates(event);
    releaseDrag();
    if (moved && pos.x >= 850 && pos.x <= 1250 && pos.y >= 560 && pos.y <= 840) stageAction();
    else if (moved) announce('Доску можно положить на ручей или просто нажать на мостик.');
  });
  window.addEventListener('pointercancel', releaseDrag);
  $('bridge-hotspot').addEventListener('lostpointercapture', releaseDrag);
  hotspotButtons.forEach(button => button.addEventListener('click', event => {
    if (button.id === 'bridge-hotspot' && event.detail !== 0 && performance.now() < ignoreBridgeClickUntil) return;
    stageAction();
  }));
  canvas.addEventListener('pointerup', event => {
    if (!ready || userPaused || document.hidden || event.button !== 0) return;
    const p = coordinates(event);
    if (Math.abs(p.x - state.x) < 130 && p.y > 515 - state.jump && p.y < 730 - state.jump) {
      model.pet(); announce('Мр-р. Кажется, ему нравится.');
    } else if (p.y > 610) model.moveTo(p.x);
  });
  actionButton.addEventListener('click', stageAction);
  $('restart-small').addEventListener('click', reset);
  $('replay').addEventListener('click', reset);
  pauseButton.addEventListener('click', () => { userPaused = !userPaused; syncPause(); announce(userPaused ? 'Прогулка на паузе.' : 'Котик снова в пути.'); });
  window.addEventListener('blur', releaseDrag);
  document.addEventListener('keydown', event => {
    if (!model || finaleShown || event.repeat) return;
    if (event.key === 'Escape' && drag) releaseDrag();
    if (event.target instanceof HTMLButtonElement) return;
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); stageAction(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); model.moveTo(state.x + 70); }
  });
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image); image.onerror = () => reject(new Error('Image failed: ' + url)); image.src = url;
    });
  }
  const art = $('peony-art');
  function fallbackBouquet() {
    if (!window.GardenWorld) return;
    art.hidden = true;
    const c = $('bouquet-fallback'); c.hidden = false;
    const context = c.getContext('2d');
    if (context) { context.clearRect(0, 0, 600, 740); window.GardenWorld.drawBouquet(context, { x: 300, y: 670, scale: 2.1, open: 1 }); }
  }
  art.addEventListener('error', fallbackBouquet);
  window.addEventListener('resize', resize);
  reducedQuery.addEventListener('change', () => { draw(); });
  document.addEventListener('visibilitychange', syncPause);
  window.addEventListener('pagehide', event => {
    pageSuspended = true; releaseDrag(); model?.setPaused(true);
    if (!event.persisted) { disposed = true; cancelAnimationFrame(raf); }
  });
  window.addEventListener('pageshow', event => { if (event.persisted) { pageSuspended = false; syncPause(); } });
  async function init() {
    if (!ctx || !window.CatJourney || !window.GardenWorld || !window.CatCharacter) { failScene(new Error('Scene module unavailable')); return; }
    model = new window.CatJourney(); restore(); state = model.snapshot();
    const result = await Promise.allSettled([loadImage('assets/garden-background.png'), document.fonts.ready]);
    if (disposed) return;
    if (result[0].status === 'fulfilled') assets.background = result[0].value;
    if (art.complete && !art.naturalWidth) fallbackBouquet();
    ready = true; stageName = ''; update();
    resize(); cameraX = cameraTarget(); draw(); syncPause();
    raf = requestAnimationFrame(frame);
  }
  init().catch(failScene);
})();
