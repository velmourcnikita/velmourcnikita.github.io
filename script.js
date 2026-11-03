'use strict';
(() => {
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); } catch {} }
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const effectsButton = document.getElementById('effects-toggle');
  const canvas = document.getElementById('snowfall');
  const ctx = canvas.getContext('2d');
  let effects = storage.get('bio.effects') !== 'off';
  let animation = 0, lastFrame = 0, width = 0, height = 0, flakes = [];
  function resizeSnow() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    flakes = Array.from({ length: width < 600 ? 14 : 30 }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      radius: .6 + Math.random(), speed: 9 + Math.random() * 14,
      opacity: .12 + Math.random() * .32
    }));
  }
  function drawSnow(now) {
    animation = 0;
    if (!ctx || !effects || reducedMotion.matches || document.hidden) return;
    if (now - lastFrame >= 1000 / 24) {
      const elapsed = lastFrame ? Math.min((now - lastFrame) / 1000, .1) : 0;
      lastFrame = now; ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#fff';
      for (const flake of flakes) {
        ctx.globalAlpha = flake.opacity;
        ctx.beginPath(); ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2); ctx.fill();
        flake.y += flake.speed * elapsed;
        if (flake.y > height + 2) { flake.y = -2; flake.x = Math.random() * width; }
      }
      ctx.globalAlpha = 1;
    }
    animation = requestAnimationFrame(drawSnow);
  }
  function syncEffects() {
    cancelAnimationFrame(animation); animation = 0; lastFrame = 0;
    const active = effects && !reducedMotion.matches;
    document.body.classList.toggle('effects-off', !active);
    effectsButton.setAttribute('aria-pressed', String(active));
    effectsButton.title = reducedMotion.matches ? 'Уменьшение движения включено в системе' : (active ? 'Выключить анимации' : 'Включить анимации');
    if (ctx) ctx.clearRect(0, 0, width, height);
    if (active && !document.hidden) animation = requestAnimationFrame(drawSnow);
    document.dispatchEvent(new Event('effectschange'));
  }
  effectsButton.addEventListener('click', () => {
    effects = !effects; storage.set('bio.effects', effects ? 'on' : 'off'); syncEffects();
  });
  reducedMotion.addEventListener('change', syncEffects);
  addEventListener('resize', resizeSnow, { passive: true });
  resizeSnow(); syncEffects();

  const DISCORD_ID = '1103000049031594024';
  const statusNames = { online: 'В сети', idle: 'Отошёл', dnd: 'Не беспокоить', offline: 'Не в сети' };
  let discordTimer = 0, discordRequest = null;
  const activityElement = document.getElementById('dc-card-activity');
  function showPresence(status, activity) {
    const known = Object.hasOwn(statusNames, status);
    for (const id of ['status-dot', 'dc-card-status']) document.getElementById(id).className = 'status-dot ' + (known ? status : 'unknown');
    document.getElementById('presence-label').textContent = known ? statusNames[status] : 'Нет данных';
    activityElement.textContent = activity || (known ? statusNames[status] : 'Статус недоступен');
  }
  for (const id of ['discord-avatar', 'dc-card-avatar']) {
    const image = document.getElementById(id);
    image.addEventListener('error', () => {
      if (image.getAttribute('src') !== 'assets/avatar.svg') image.src = 'assets/avatar.svg';
    });
  }
  async function updateDiscord() {
    clearTimeout(discordTimer);
    if (document.hidden || discordRequest) return;
    const controller = new AbortController(); discordRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.lanyard.rest/v1/users/' + DISCORD_ID, { signal: controller.signal });
      if (!response.ok) throw new Error('Presence request failed');
      const result = await response.json();
      if (!result.success || !result.data || !result.data.discord_user) throw new Error('Presence unavailable');
      const data = result.data, user = data.discord_user;
      document.getElementById('dc-card-username').textContent = user.global_name || user.username || '.bykzo';
      if (typeof user.avatar === 'string' && /^[a-zA-Z0-9_]+$/.test(user.avatar)) {
        const avatar = 'https://cdn.discordapp.com/avatars/' + DISCORD_ID + '/' + user.avatar + '.png?size=160';
        for (const id of ['discord-avatar', 'dc-card-avatar']) if (document.getElementById(id).src !== avatar) document.getElementById(id).src = avatar;
      }
      const activities = Array.isArray(data.activities) ? data.activities : [];
      const custom = activities.find(item => item && item.type === 4 && item.state);
      const activity = data.discord_status === 'offline' ? '' : custom ? custom.state : '';
      showPresence(data.discord_status, activity);
      window.DiscordActivity.render(data);
    } catch {
      showPresence('unknown', navigator.onLine ? 'Статус сейчас недоступен' : 'Нет подключения к сети');
      window.DiscordActivity.render(null);
    } finally {
      clearTimeout(timeout);
      if (discordRequest === controller) discordRequest = null;
      if (!document.hidden) discordTimer = setTimeout(updateDiscord, 15000);
    }
  }
  document.addEventListener('visibilitychange', () => {
    syncEffects(); clearTimeout(discordTimer);
    if (document.hidden) { if (discordRequest) discordRequest.abort(); }
    else updateDiscord();
  });
  addEventListener('online', updateDiscord); updateDiscord();

  const musicButton = document.getElementById('music-toggle'), musicIcon = document.getElementById('music-icon');
  const musicStatus = document.getElementById('music-status'), musicCard = document.querySelector('.music-card');
  const slider = document.getElementById('music-volume'), volumeLabel = document.getElementById('volume-label');
  const playerFrame = document.getElementById('soundcloud-player');
  const savedVolume = Number(storage.get('bio.volume') ?? 15);
  let volume = Number.isFinite(savedVolume) ? Math.max(0, Math.min(100, savedVolume)) : 15;
  let widget = null, ready = false, wanted = false, playing = false, failed = false;
  let startTimer = 0, readyTimer = 0;
  slider.value = String(volume); volumeLabel.textContent = volume + '%';
  if (storage.get('bio.music') === 'off') musicStatus.textContent = 'Музыка выключена';
  function renderMusic(message) {
    musicButton.setAttribute('aria-pressed', String(playing));
    musicButton.setAttribute('aria-label', wanted ? 'Выключить музыку' : 'Включить музыку');
    musicIcon.setAttribute('href', wanted ? '#i-pause' : '#i-play');
    musicCard.classList.toggle('is-playing', playing && volume > 0);
    musicStatus.textContent = message;
  }
  function startPlayback() {
    if (!ready || !wanted || !widget) return;
    widget.setVolume(volume); widget.play(); clearTimeout(startTimer);
    startTimer = setTimeout(() => {
      if (!playing && wanted) { wanted = false; widget.pause(); renderMusic('Нажми ▶, чтобы включить'); }
    }, 6000);
  }
  function setWanted(on) {
    wanted = on; storage.set('bio.music', on ? 'on' : 'off'); clearTimeout(startTimer);
    if (on) {
      renderMusic(ready ? 'Запускаю…' : 'Загружаю SoundCloud…');
      if (failed) initializePlayer();
      startPlayback();
    } else {
      if (widget && ready) widget.pause();
      playing = false; renderMusic('Музыка выключена');
    }
  }
  function playerError() {
    clearTimeout(readyTimer); clearTimeout(startTimer);
    ready = false; playing = false; failed = true; wanted = false;
    renderMusic('Плеер недоступен · открой трек по ссылке');
  }
  function bindWidget() {
    if (!window.SC || !window.SC.Widget) { playerError(); return; }
    widget = window.SC.Widget(playerFrame);
    const events = window.SC.Widget.Events;
    widget.bind(events.READY, () => {
      clearTimeout(readyTimer); ready = true; failed = false; widget.setVolume(volume);
      if (wanted) startPlayback();
    });
    widget.bind(events.PLAY, () => {
      if (!wanted && !playerFrame.closest('details').open) { widget.pause(); return; }
      clearTimeout(startTimer); wanted = true; playing = true; storage.set('bio.music', 'on'); widget.setVolume(volume);
      renderMusic(volume === 0 ? 'Играет без звука' : 'Играет · lemongirls');
    });
    widget.bind(events.PAUSE, () => {
      if (!playing) return;
      clearTimeout(startTimer); wanted = false; playing = false;
      storage.set('bio.music', 'off'); renderMusic('На паузе');
    });
    widget.bind(events.FINISH, () => { if (wanted) { widget.seekTo(0); widget.play(); } });
    widget.bind(events.ERROR, playerError);
  }
  function initializePlayer() {
    failed = false; ready = false;
    if (widget) for (const event of Object.values(window.SC.Widget.Events)) widget.unbind(event);
    playerFrame.src = playerFrame.dataset.src;
    clearTimeout(readyTimer); readyTimer = setTimeout(playerError, 20000);
    if (window.SC && window.SC.Widget) { bindWidget(); return; }
    const oldScript = document.getElementById('soundcloud-api'); if (oldScript) oldScript.remove();
    const script = document.createElement('script');
    script.id = 'soundcloud-api'; script.src = 'https://w.soundcloud.com/player/api.js'; script.async = true;
    script.onload = bindWidget; script.onerror = playerError; document.head.append(script);
  }
  musicButton.addEventListener('click', () => setWanted(!wanted));
  slider.addEventListener('input', () => {
    volume = Number(slider.value); storage.set('bio.volume', volume); volumeLabel.textContent = volume + '%';
    if (widget && ready) widget.setVolume(volume);
    if (playing) renderMusic(volume === 0 ? 'Играет без звука' : 'Играет · lemongirls');
  });
  function firstInteraction(event) {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    if (event.target instanceof Element && event.target.closest('[data-no-music]')) return;
    document.removeEventListener('pointerdown', firstInteraction); document.removeEventListener('keydown', firstInteraction);
    if (storage.get('bio.music') !== 'off' && !wanted && !playing) setWanted(true);
  }
  document.addEventListener('pointerdown', firstInteraction, { passive: true });
  document.addEventListener('keydown', firstInteraction);
  initializePlayer();
})();
