// app.js — game client for "Study Abroad: Maple Corner Market"
import { renderMaya, renderBackground, renderCounter, leafIcon } from './art.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const el = {
  bg: $('#bg'), maya: $('#maya'), counter: $('#counter'),
  hud: $('#hud'), hudToggle: $('#hudToggle'), shopList: $('#shopList'), money: $('#money'),
  cartBody: $('#cartBody'), cartTotal: $('#cartTotal'), paidBadge: $('#paidBadge'), endBtn: $('#endBtn'),
  trace: $('#trace'), traceList: $('#traceList'), tokInfo: $('#tokInfo'),
  dialog: $('#dialog'), nameplate: $('#nameplate'), dlgText: $('#dlgText'), nextMark: $('#nextMark'),
  logBtn: $('#logBtn'), ttsBtn: $('#ttsBtn'), traceBtn: $('#traceBtn'),
  inputBar: $('#inputBar'), textIn: $('#textIn'), sendBtn: $('#sendBtn'), micBtn: $('#micBtn'), hint: $('#hint'),
  title: $('#title'), providerSel: $('#providerSel'), startBtn: $('#startBtn'), connStatus: $('#connStatus'),
  logOverlay: $('#logOverlay'), logList: $('#logList'),
  evaluating: $('#evaluating'), result: $('#result'), resultCard: $('#resultCard'),
  connBanner: $('#connBanner'), reconnectBtn: $('#reconnectBtn'), toasts: $('#toasts'),
};

const game = {
  ws: null,
  connected: false,
  providers: [],
  provider: null,
  inGame: false,
  waiting: false,     // waiting for Maya's reply
  sceneOver: false,
  ending: false,      // "end" sent
  resultShown: false,
  emotion: 'neutral',
  money: null,
  cartNames: new Set(),
  backlog: [],
  turn: 0,
  tokTurn: 0,
  tokTotal: 0,
  tts: false,
};

// ---------- art ----------
el.bg.innerHTML = renderBackground();
el.counter.innerHTML = renderCounter();
$('#titleLeaf').innerHTML = leafIcon(64);
setEmotion('neutral', false);

function setEmotion(emotion, bounce = true) {
  const changed = emotion !== game.emotion || !el.maya.firstChild;
  game.emotion = emotion;
  if (!changed) return;
  renderMaya(emotion, el.maya);
  if (bounce) {
    el.maya.classList.remove('bounce');
    void el.maya.offsetWidth; // restart animation
    el.maya.classList.add('bounce');
  }
}
el.maya.addEventListener('animationend', (e) => { if (e.target === el.maya) el.maya.classList.remove('bounce'); });

// ---------- toasts ----------
function toast(msg, kind = '', ms = 3800) {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  el.toasts.appendChild(t);
  while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 420); }, ms);
}

// ---------- WebSocket ----------
function connect() {
  if (game.ws && (game.ws.readyState === WebSocket.OPEN || game.ws.readyState === WebSocket.CONNECTING)) return;
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  el.connStatus.textContent = '連線中… Connecting';
  let ws;
  try { ws = new WebSocket(url); } catch (e) { onClosed(); return; }
  game.ws = ws;
  ws.onopen = () => {
    game.connected = true;
    el.connBanner.hidden = true;
    el.connStatus.textContent = '已連線 Connected';
  };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { console.warn('bad message', ev.data); return; }
    try { handle(msg); } catch (e) { console.error(e); }
  };
  ws.onclose = () => { if (game.ws === ws) onClosed(); };
  ws.onerror = () => {};
}

function onClosed() {
  const wasConnected = game.connected;
  game.connected = false;
  game.ws = null;
  el.startBtn.disabled = true;
  el.connStatus.textContent = '無法連線伺服器 Cannot reach server';
  el.connBanner.hidden = false;
  if (wasConnected) toast('連線中斷 Connection lost', 'err');
  if (game.waiting) { game.waiting = false; hideThinking(); }
  updateInputState();
}

function send(obj) {
  if (!game.ws || game.ws.readyState !== WebSocket.OPEN) {
    toast('尚未連線 Not connected', 'err');
    el.connBanner.hidden = false;
    return false;
  }
  game.ws.send(JSON.stringify(obj));
  return true;
}

el.reconnectBtn.addEventListener('click', () => { game.reconnecting = true; connect(); });

// ---------- message handling ----------
function handle(msg) {
  switch (msg.type) {
    case 'info': onInfo(msg); break;
    case 'state': renderState(msg); break;
    case 'thinking':
      game.waiting = true; updateInputState();
      enqueue({ kind: 'thinking' });
      break;
    case 'tool':
      traceAdd('tool', msg);
      break;
    case 'guardrail':
      traceAdd('guard', msg);
      break;
    case 'clerk':
      game.waiting = false; updateInputState();
      logAdd('maya', msg.line);
      enqueue({ kind: 'line', speaker: 'maya', text: msg.line || '', emotion: msg.emotion || 'neutral' });
      break;
    case 'usage':
      game.tokTurn = Number(msg.tokens) || 0;
      game.tokTotal = Number(msg.total) || game.tokTotal + game.tokTurn;
      traceAdd('usage', msg);
      updateTok();
      break;
    case 'error':
      toast(msg.message || 'Error', 'err', 5200);
      traceAdd('err', msg);
      if (game.waiting) { game.waiting = false; hideThinking(true); }
      if (game.ending && !game.resultShown) { game.ending = false; el.evaluating.hidden = true; }
      updateInputState();
      break;
    case 'scene_over':
      game.sceneOver = true; game.waiting = false;
      logAdd('sys', '結帳完成！Checkout complete.');
      updateInputState();
      break;
    case 'evaluating':
      game.waiting = false;
      el.evaluating.hidden = false;
      updateInputState();
      break;
    case 'result':
      showResult(msg);
      break;
    default:
      console.debug('unknown message', msg);
  }
}

function onInfo(msg) {
  game.providers = Array.isArray(msg.providers) ? msg.providers : [];
  const sel = el.providerSel;
  const prev = game.provider || sel.value;
  sel.innerHTML = '';
  for (const p of game.providers) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.label + (p.available === false ? '（不可用 unavailable）' : '');
    o.disabled = p.available === false;
    sel.appendChild(o);
  }
  if (!game.providers.length) sel.innerHTML = '<option value="">(no providers)</option>';
  const want = game.providers.find((p) => p.id === prev && p.available !== false)
    || game.providers.find((p) => p.id === msg.default && p.available !== false)
    || game.providers.find((p) => p.available !== false);
  if (want) sel.value = want.id;
  sel.disabled = !game.providers.length;
  el.startBtn.disabled = !want;
  el.connStatus.textContent = want ? '已連線 Connected — 準備好了嗎？' : '沒有可用的模型 No model available';

  // Reconnected mid-game: the server session is per-connection, so restart the scene.
  if (game.reconnecting && game.inGame && !game.resultShown && game.provider) {
    toast('已重新連線，場景重新開始 Reconnected — scene restarted');
    startScene(game.provider);
  }
  game.reconnecting = false;
}

// ---------- HUD ----------
function renderState(s) {
  // shopping list
  const list = Array.isArray(s.list) ? s.list : [];
  el.shopList.innerHTML = list.map((it) => {
    const need = Number(it.need) || 1;
    const qty = need > 1 ? ` <span class="qty">×${need}${it.bought ? ` (${it.bought}/${need})` : ''}</span>` : '';
    const cart = !it.done && it.in_cart > 0 ? `<span class="incart" title="在購物車 In cart">🛒${it.in_cart > 1 || need > 1 ? ` ${it.in_cart}` : ''}</span>` : '';
    return `<li class="${it.done ? 'done' : ''}"><span class="cb">${it.done ? '✓' : ''}</span><span class="lbl">${esc(it.label)}</span>${qty}${cart}</li>`;
  }).join('') || '<li class="lbl">—</li>';

  // money
  if (typeof s.money === 'number') animateMoney(s.money);

  // cart
  const cart = Array.isArray(s.cart) ? s.cart : [];
  const names = new Set(cart.map((c) => c.name));
  el.cartBody.innerHTML = cart.length
    ? cart.map((c) => `<tr class="${game.cartNames.has(c.name) ? '' : 'new'}"><td class="n">${esc(c.name)}${c.unit ? `<small>${esc(c.unit)} · ${money(c.price)}</small>` : ''}</td><td class="q">×${esc(c.qty)}</td><td class="p">${money(c.line_total)}</td></tr>`).join('')
    : '<tr><td class="empty" colspan="3">購物車是空的 Cart is empty</td></tr>';
  game.cartNames = names;
  el.cartTotal.textContent = money(s.total);
  el.paidBadge.hidden = !s.checked_out;
}

let moneyAnim = 0;
function animateMoney(to) {
  const from = game.money;
  game.money = to;
  cancelAnimationFrame(moneyAnim);
  if (from === null || Math.abs(from - to) < 0.005) { el.money.textContent = money(to); return; }
  el.money.classList.remove('up', 'down');
  void el.money.offsetWidth;
  el.money.classList.add(to < from ? 'down' : 'up');
  const t0 = performance.now(), dur = 900;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.money.textContent = money(from + (to - from) * e);
    if (k < 1) moneyAnim = requestAnimationFrame(step);
    else setTimeout(() => el.money.classList.remove('up', 'down'), 600);
  };
  moneyAnim = requestAnimationFrame(step);
}

el.hudToggle.addEventListener('click', () => {
  const c = el.hud.classList.toggle('collapsed');
  el.hudToggle.setAttribute('aria-expanded', String(!c));
});
if (matchMedia('(max-aspect-ratio: 1/1)').matches) el.hud.classList.add('collapsed');

// ---------- End button (two-step confirm) ----------
let endConfirmTimer = 0;
el.endBtn.addEventListener('click', () => {
  if (!game.inGame || game.ending) return;
  if (!game.sceneOver && !el.endBtn.classList.contains('confirm')) {
    el.endBtn.classList.add('confirm');
    el.endBtn.innerHTML = '確定離開？ <span class="en">Click again to leave</span>';
    clearTimeout(endConfirmTimer);
    endConfirmTimer = setTimeout(resetEndBtn, 3500);
    return;
  }
  resetEndBtn();
  if (send({ type: 'end' })) {
    game.ending = true;
    stopSpeech();
    updateInputState();
  }
});
function resetEndBtn() {
  clearTimeout(endConfirmTimer);
  el.endBtn.classList.remove('confirm');
  el.endBtn.innerHTML = '🚪 離開超市 <span class="en">End scene</span>';
}

// ---------- input ----------
function updateInputState() {
  const canTalk = game.inGame && game.connected && !game.sceneOver && !game.ending && !game.resultShown;
  el.textIn.disabled = !canTalk;
  el.sendBtn.disabled = !canTalk || game.waiting;
  el.micBtn.disabled = !canTalk || game.waiting;
  el.endBtn.disabled = !game.inGame || game.ending || game.resultShown;
  el.hint.hidden = !(game.sceneOver && !game.ending && !game.resultShown);
  el.endBtn.classList.toggle('glow', game.sceneOver && !game.ending);
  el.textIn.placeholder = game.sceneOver ? '已結帳 — 按「離開超市」看結果' : (game.waiting ? 'Maya 正在回應… Maya is replying' : '用英文跟 Maya 說話… Say something in English');
}

el.inputBar.addEventListener('submit', (e) => { e.preventDefault(); sendSay(); });

function sendSay() {
  const text = el.textIn.value.trim();
  if (!text || el.sendBtn.disabled) return;
  if (!send({ type: 'say', text })) return;
  el.textIn.value = '';
  game.waiting = true;
  game.turn += 1;
  traceAdd('turn', { text });
  logAdd('you', text);
  stopSpeech();
  if (typing) typing.skip();
  // flush pending Maya lines, the player has moved on
  for (const q of queue) if (q.kind === 'line' && q.speaker === 'maya') q.fast = true;
  if (advanceResolve) advanceResolve();
  enqueue({ kind: 'line', speaker: 'you', text });
  updateInputState();
}

// Focus the input when the player starts typing anywhere.
document.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  if (e.key === '`') { e.preventDefault(); toggleTrace(); return; }
  if (e.key === 'Escape') { if (!el.logOverlay.hidden) { el.logOverlay.hidden = true; return; } }
  if (inField || tag === 'BUTTON') return;
  if (!game.inGame || !el.logOverlay.hidden || game.resultShown) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); return; }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !el.textIn.disabled) el.textIn.focus();
});

// ---------- speech recognition (hold to talk) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) {
  el.micBtn.hidden = true;
} else {
  let rec = null, recActive = false, released = false, finalText = '';
  const startRec = (e) => {
    e.preventDefault();
    if (el.micBtn.disabled || recActive) return;
    try { el.micBtn.setPointerCapture(e.pointerId); } catch {}
    rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    finalText = ''; released = false; recActive = true;
    stopSpeech();
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      el.textIn.value = (finalText + interim).trim();
    };
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast('無法使用麥克風 Microphone blocked', 'err');
      else if (ev.error !== 'no-speech' && ev.error !== 'aborted') toast(`語音辨識錯誤 Speech error: ${ev.error}`, 'err');
    };
    rec.onend = () => {
      recActive = false;
      el.micBtn.classList.remove('rec');
      if (released && el.textIn.value.trim()) sendSay();
    };
    try { rec.start(); el.micBtn.classList.add('rec'); } catch (err) { recActive = false; toast('語音辨識無法啟動 Speech unavailable', 'err'); }
  };
  const stopRec = () => {
    if (!recActive || released) return;
    released = true;
    try { rec.stop(); } catch {}
  };
  el.micBtn.addEventListener('pointerdown', startRec);
  el.micBtn.addEventListener('pointerup', stopRec);
  el.micBtn.addEventListener('pointercancel', stopRec);
  el.micBtn.addEventListener('lostpointercapture', stopRec);
  el.micBtn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------- TTS ----------
const synth = window.speechSynthesis;
let voice = null;
function pickVoice() {
  if (!synth) return;
  const vs = synth.getVoices().filter((v) => /^en[-_]US/i.test(v.lang));
  const fem = /(female|samantha|zira|aria|jenny|ava|allison|susan|emma|michelle|google us english)/i;
  voice = vs.find((v) => fem.test(v.name) && /natural|online|neural/i.test(v.name)) || vs.find((v) => fem.test(v.name)) || vs[0] || null;
}
if (!synth) el.ttsBtn.hidden = true;
else { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }
try { game.tts = localStorage.getItem('mcm_tts') === '1'; } catch {}
function renderTtsBtn() {
  el.ttsBtn.textContent = game.tts ? '🔊 VOICE' : '🔇 VOICE';
  el.ttsBtn.setAttribute('aria-pressed', String(game.tts));
}
renderTtsBtn();
el.ttsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  game.tts = !game.tts;
  try { localStorage.setItem('mcm_tts', game.tts ? '1' : '0'); } catch {}
  renderTtsBtn();
  if (!game.tts) stopSpeech();
});
function speak(text) {
  if (!game.tts || !synth || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (voice) u.voice = voice;
  u.rate = 1.0; u.pitch = 1.1;
  synth.speak(u);
}
function stopSpeech() { try { synth && synth.cancel(); } catch {} }

// ---------- dialogue: typewriter + queue ----------
const CPS = 30;
let typing = null;        // { skip }
let advanceResolve = null;
let mouthTimer = 0;
const queue = [];
let pumping = false;
let thinkingShown = false;

function setSpeaker(who) {
  el.nameplate.className = `nameplate ${who === 'you' ? 'you' : who === 'sys' ? 'sys' : 'maya'}`;
  el.nameplate.textContent = who === 'you' ? 'You' : who === 'sys' ? 'System' : 'Maya';
  el.dlgText.className = `dlg-text ${who === 'you' ? 'you' : who === 'sys' ? 'sys' : ''}`;
}

function startMouth() {
  stopMouth();
  mouthTimer = setInterval(() => el.maya.classList.toggle('talk'), 115);
}
function stopMouth() { clearInterval(mouthTimer); mouthTimer = 0; el.maya.classList.remove('talk'); }

function typeLine(who, text, cps = CPS) {
  return new Promise((resolve) => {
    setSpeaker(who);
    el.nextMark.hidden = true;
    el.dlgText.textContent = '';
    const chars = Array.from(text);
    let done = false, raf = 0;
    const t0 = performance.now();
    if (who === 'maya') startMouth();
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      el.dlgText.textContent = text;
      el.dlgText.scrollTop = el.dlgText.scrollHeight;
      stopMouth();
      el.nextMark.hidden = false;
      typing = null;
      resolve();
    };
    const step = (now) => {
      const n = Math.floor(((now - t0) / 1000) * cps);
      if (n >= chars.length) return finish();
      el.dlgText.textContent = chars.slice(0, n).join('');
      el.dlgText.scrollTop = el.dlgText.scrollHeight;
      raf = requestAnimationFrame(step);
    };
    typing = { skip: finish };
    raf = requestAnimationFrame(step);
  });
}

function waitAdvance() {
  return new Promise((resolve) => { advanceResolve = () => { advanceResolve = null; resolve(); }; });
}

function advance() {
  if (typing) typing.skip();
  else if (advanceResolve) advanceResolve();
}
el.dialog.addEventListener('click', (e) => { if (!e.target.closest('.quick-menu')) advance(); });

function showThinking() {
  thinkingShown = true;
  setEmotion('thinking');
  setSpeaker('maya');
  el.nextMark.hidden = true;
  el.dlgText.innerHTML = '<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>';
}
function hideThinking(withError = false) {
  // remove pending thinking items
  for (let i = queue.length - 1; i >= 0; i--) if (queue[i].kind === 'thinking') queue.splice(i, 1);
  if (!thinkingShown) return;
  thinkingShown = false;
  if (withError) {
    setEmotion('sorry');
    setSpeaker('sys');
    el.dlgText.textContent = '（出了點問題，請再說一次 Something went wrong — please try again.）';
    el.nextMark.hidden = true;
  }
}

function enqueue(item) { queue.push(item); pump(); }

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length) {
      const it = queue.shift();
      if (it.kind === 'thinking') {
        if (queue.some((q) => q.kind === 'line')) continue; // reply already here
        showThinking();
        continue;
      }
      thinkingShown = false;
      if (it.speaker === 'maya') {
        setEmotion(it.emotion);
        speak(it.text);
        await typeLine('maya', it.text, it.fast ? 400 : CPS);
        if (queue.some((q) => q.kind === 'line' && q.speaker === 'maya') && !it.fast) await waitAdvance();
      } else {
        await typeLine(it.speaker, it.text, 75);
        await sleep(650);
      }
    }
  } finally {
    pumping = false;
  }
}

function resetDialog() {
  queue.length = 0;
  if (typing) typing.skip();
  if (advanceResolve) advanceResolve();
  stopMouth();
  stopSpeech();
  thinkingShown = false;
  setSpeaker('maya');
  el.dlgText.textContent = '';
  el.nextMark.hidden = true;
}

// ---------- backlog ----------
function logAdd(who, text) {
  game.backlog.push({ who, text });
  if (!el.logOverlay.hidden) renderLog();
}
function renderLog() {
  el.logList.innerHTML = game.backlog.length
    ? game.backlog.map((b) => `<div class="log-item ${b.who}">${b.who === 'sys' ? esc(b.text) : `<b>${b.who === 'you' ? 'You' : 'Maya'}</b> ${esc(b.text)}`}</div>`).join('')
    : '<div class="log-empty">還沒有對話 No lines yet</div>';
  el.logList.scrollTop = el.logList.scrollHeight;
}
el.logBtn.addEventListener('click', (e) => { e.stopPropagation(); renderLog(); el.logOverlay.hidden = false; });
$('#logClose').addEventListener('click', () => { el.logOverlay.hidden = true; });
el.logOverlay.addEventListener('click', (e) => { if (e.target === el.logOverlay) el.logOverlay.hidden = true; });

// ---------- trace panel ----------
function toggleTrace(force) {
  el.trace.hidden = typeof force === 'boolean' ? !force : !el.trace.hidden;
  if (!el.trace.hidden) el.traceList.scrollTop = el.traceList.scrollHeight;
}
el.traceBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleTrace(); });
$('#traceClose').addEventListener('click', () => toggleTrace(false));
$('#traceClear').addEventListener('click', () => { el.traceList.innerHTML = ''; });

function short(v, n = 80) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s && s.length > n ? `${s.slice(0, n)}…` : (s ?? '');
}
function pretty(v) {
  if (typeof v === 'string') {
    try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; }
  }
  return JSON.stringify(v, null, 2);
}
function traceAdd(kind, m) {
  const d = document.createElement('div');
  d.className = 'tr';
  if (kind === 'turn') {
    d.classList.add('tr-turn');
    d.textContent = `── Turn ${game.turn}: “${short(m.text, 60)}”`;
  } else if (kind === 'tool') {
    d.classList.add('tr-tool');
    d.innerHTML = `<details><summary>🔧 ${esc(m.name)}(${esc(short(m.args ?? {}, 70))})</summary><pre>args: ${esc(pretty(m.args ?? {}))}\n→ ${esc(pretty(m.result ?? ''))}</pre></details>`;
  } else if (kind === 'guard') {
    d.classList.add('tr-guard');
    d.textContent = `⚠ guardrail ${m.name}: ${m.detail ?? ''}`;
  } else if (kind === 'usage') {
    d.classList.add('tr-usage');
    d.textContent = `Σ tokens turn ${m.tokens} · total ${m.total}`;
  } else if (kind === 'err') {
    d.classList.add('tr-err');
    d.textContent = `✖ error: ${m.message ?? ''}`;
  } else if (kind === 'sys') {
    d.textContent = m.text;
  }
  const atBottom = el.traceList.scrollHeight - el.traceList.scrollTop - el.traceList.clientHeight < 30;
  el.traceList.appendChild(d);
  if (atBottom) el.traceList.scrollTop = el.traceList.scrollHeight;
}
function updateTok() { el.tokInfo.textContent = `tokens · turn ${game.tokTurn} · total ${game.tokTotal}`; }

// ---------- start / title ----------
el.startBtn.addEventListener('click', () => {
  const id = el.providerSel.value;
  if (!id) return;
  startScene(id);
});

function startScene(providerId) {
  if (!send({ type: 'start', provider: providerId })) return;
  game.provider = providerId;
  game.inGame = true;
  game.waiting = true;
  game.sceneOver = false;
  game.ending = false;
  game.resultShown = false;
  game.turn = 0;
  game.backlog = [];
  game.money = null;
  game.cartNames = new Set();
  el.result.hidden = true;
  el.evaluating.hidden = true;
  el.title.hidden = true;
  resetEndBtn();
  resetDialog();
  const p = game.providers.find((x) => x.id === providerId);
  traceAdd('sys', { text: `▶ start · provider=${p ? p.label : providerId}` });
  setEmotion('neutral', false);
  showThinking();
  updateInputState();
  setTimeout(() => { if (!el.textIn.disabled) el.textIn.focus(); }, 50);
}

// ---------- result ----------
function meter(label, v) {
  const val = Math.max(-2, Math.min(2, Math.round(Number(v) || 0)));
  let cells = '';
  for (let i = -2; i <= 2; i++) {
    let c = i === 0 ? 'mid' : '';
    if (val > 0 && i > 0 && i <= val) c = 'pos';
    if (val < 0 && i < 0 && i >= val) c = 'neg';
    if (val === 0 && i === 0) c = 'zero';
    cells += `<i class="${c}"></i>`;
  }
  return `<div class="meter"><span>${label}</span><div class="cells" aria-label="${val}">${cells}</div><span class="v">${val > 0 ? '+' : ''}${val}</span></div>`;
}

function showResult(r) {
  game.resultShown = true;
  game.waiting = false;
  el.evaluating.hidden = true;
  el.hint.hidden = true;
  resetDialog();
  updateInputState();

  const items = Array.isArray(r.items) ? r.items : [];
  const completed = r.completed ?? items.filter((i) => i.ok).length;
  const totalItems = r.total_items ?? items.length;
  const allDone = totalItems > 0 && completed >= totalItems;
  setEmotion(allDone ? 'happy' : 'sorry');

  const itemsHtml = items.map((i) => `<li class="${i.ok ? '' : 'bad'}"><span>${i.ok ? '✅' : '❌'}</span><span>${esc(i.label)}</span><span class="cnt">${esc(i.bought ?? 0)}/${esc(i.need ?? 1)}</span></li>`).join('') || '<li>—</li>';
  const extra = Array.isArray(r.extra) && r.extra.length ? r.extra.map(esc).join(', ') : '無 None';

  let scoreHtml;
  const s = r.score;
  if (s && typeof s === 'object') {
    const vocab = Array.isArray(s.vocab) && s.vocab.length ? `<div class="chips">${s.vocab.map((w) => `<span class="chip">${esc(w)}</span>`).join('')}</div>` : '<p class="en">—</p>';
    const tips = Array.isArray(s.tips) && s.tips.length ? `<ul class="tips">${s.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<p class="en">—</p>';
    scoreHtml = `
      <div class="rbox">
        <h3>🗣️ 英文表現 <span class="en">Your English</span></h3>
        ${meter('流暢度 <span class="en">Fluency</span>', s.fluency)}
        ${meter('禮貌 <span class="en">Politeness</span>', s.politeness)}
        ${meter('正確性 <span class="en">Accuracy</span>', s.accuracy)}
        <h3 style="margin-top:.7em">📚 新單字 <span class="en">New words</span></h3>
        ${vocab}
        <h3 style="margin-top:.7em">💡 小建議 <span class="en">Tips</span></h3>
        ${tips}
      </div>`;
  } else {
    scoreHtml = `<div class="rbox"><h3>🗣️ 英文表現 <span class="en">Your English</span></h3><p>評分暫時無法使用。<br><span class="en">The evaluator is unavailable this time.</span></p></div>`;
  }

  el.resultCard.innerHTML = `
    <h2>${allDone ? '🎉 任務完成！' : '🧾 購物結果'} <span class="en">${allDone ? 'Mission complete!' : 'Results'}</span></h2>
    <p class="rsub">Maple Corner Market · ${esc(completed)}/${esc(totalItems)} items</p>
    <div class="result-grid">
      <div class="rbox">
        <h3>📝 購物清單 <span class="en">Shopping list</span></h3>
        <div class="big-score">${esc(completed)}<small> / ${esc(totalItems)}</small></div>
        <ul class="ritems">${itemsHtml}</ul>
        <div class="rmeta">
          <div>🧺 額外購買 <span class="en">Extras</span>：${extra}</div>
          <div>💵 剩餘金額 <span class="en">Money left</span>：${money(r.money_left)}</div>
        </div>
      </div>
      ${scoreHtml}
    </div>
    ${s && s.summary ? `<p class="summary">${esc(s.summary)}</p>` : ''}
    <div class="result-actions"><button id="againBtn" class="btn" type="button">再玩一次 Play again ↻</button></div>`;
  el.result.hidden = false;
  $('#againBtn').addEventListener('click', () => location.reload());
  logAdd('sys', `結果 Result: ${completed}/${totalItems}`);
}

// ---------- boot ----------
updateInputState();
connect();
