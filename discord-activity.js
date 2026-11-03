'use strict';
(() => {
  const container = document.getElementById('dc-activities');
  const types = {
    0: ['Играет', '◈'], 1: ['В эфире', '↗'], 2: ['Слушает', '♫'],
    3: ['Смотрит', '▷'], 5: ['Участвует в соревновании', '⚑']
  };
  let clocks = [], timer = 0;
  function text(value) { return typeof value === 'string' ? value.trim().slice(0, 300) : ''; }
  function element(tag, className, content) {
    const node = document.createElement(tag); node.className = className;
    if (content) node.textContent = content;
    return node;
  }
  function time(value) {
    if (!Number.isFinite(value) || value < 0) return '0:00';
    const seconds = Math.floor(value / 1000), minutes = Math.floor(seconds / 60);
    return minutes >= 60 ? Math.floor(minutes / 60) + ':' + String(minutes % 60).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0') : minutes + ':' + String(seconds % 60).padStart(2, '0');
  }
  function tick() {
    if (document.hidden) return;
    const now = Date.now();
    for (const clock of clocks) {
      const elapsed = Math.max(0, now - clock.start);
      if (clock.end) {
        const duration = clock.end - clock.start;
        clock.label.textContent = time(Math.min(elapsed, duration)) + ' / ' + time(duration);
        clock.progress.value = Math.min(elapsed, duration);
      } else clock.label.textContent = time(elapsed) + ' в активности';
    }
  }
  function syncTimer() {
    clearInterval(timer); timer = 0;
    if (clocks.length && !document.hidden) { tick(); timer = setInterval(tick, 1000); }
  }
  function render(data) {
    clocks = []; container.replaceChildren(); container.hidden = true; syncTimer();
    if (!data || !['online', 'idle', 'dnd'].includes(data.discord_status)) return;
    const rows = [];
    const spotify = data.listening_to_spotify && data.spotify;
    if (spotify && text(spotify.song)) {
      rows.push({ type: 2, name: 'Spotify', details: spotify.song, state: spotify.artist,
        extra: spotify.album, timestamps: spotify.timestamps });
    }
    const activities = Array.isArray(data.activities) ? data.activities : [];
    for (const activity of activities) {
      if (!activity || !Object.hasOwn(types, activity.type) || !text(activity.name)) continue;
      if (spotify && activity.type === 2 && activity.name.toLowerCase() === 'spotify') continue;
      rows.push(activity);
      if (rows.length === 6) break;
    }
    for (const activity of rows.slice(0, 6)) {
      const [verb, mark] = types[activity.type];
      const name = text(activity.name), details = text(activity.details), state = text(activity.state);
      const row = element('div', 'dc-activity-row');
      const icon = element('span', 'dc-activity-mark', mark); icon.setAttribute('aria-hidden', 'true');
      const copy = element('div', 'dc-activity-copy');
      const isMedia = activity.type === 2 || activity.type === 3;
      const title = isMedia ? details || name : name;
      const label = verb + (isMedia && details ? ' · ' + name : '');
      copy.append(element('p', 'dc-activity-kind', label), element('p', 'dc-activity-title', title));
      const lines = [...new Set([!isMedia ? details : '', state, text(activity.extra)].filter(value => value && value !== title))];
      for (const line of lines) copy.append(element('p', 'dc-activity-detail', line));
      const start = activity.timestamps?.start, end = activity.timestamps?.end;
      if (Number.isFinite(start) && start > 0 && start <= Date.now()) {
        const clock = { start, label: element('p', 'dc-activity-time') };
        if (Number.isFinite(end) && end > start && isMedia) {
          clock.end = end; clock.progress = element('progress', 'dc-track-progress');
          clock.progress.max = end - start; clock.progress.value = 0;
          clock.progress.setAttribute('aria-label', 'Позиция воспроизведения');
          copy.append(clock.progress);
        }
        copy.append(clock.label); clocks.push(clock);
      }
      row.append(icon, copy); container.append(row);
    }
    container.hidden = rows.length === 0; syncTimer();
  }
  document.addEventListener('visibilitychange', syncTimer);
  window.DiscordActivity = { render };
})();
