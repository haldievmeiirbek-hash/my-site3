/**
 * PyLearn KZ — Accessibility System v1.0
 * 6 бағыт: Көру · Есту · Таныmdық · Моторлық · AI Чат · СДВГ
 */

(function() {
'use strict';

// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
const A11Y = {
  // Көру
  dyslexia: false,
  highContrast: false,
  readingGuide: false,
  fontSize: 0,        // -2..+4
  // Есту
  tts: false,
  ttsRate: 1,
  ttsPitch: 1,
  signLang: false,
  // Таныmdық
  autism: false,
  focusMode: false,
  noAnimations: false,
  // Моторлық
  voiceControl: false,
  tabNav: false,
  // СДВГ
  pomodoro: false,
  pomodoroMin: 25,
  pomodoroState: 'idle', // idle/work/break
  pomodoroLeft: 25*60,
  pomodoroInterval: null,
  // Panel
  panelOpen: false,
};

let recognition = null;
let ttsUtterance = null;
let readingGuideEl = null;

// ══════════════════════════════════════════
// SAVE / LOAD
// ══════════════════════════════════════════
function saveState() {
  const s = {
    dyslexia: A11Y.dyslexia, highContrast: A11Y.highContrast,
    readingGuide: A11Y.readingGuide, fontSize: A11Y.fontSize,
    tts: A11Y.tts, ttsRate: A11Y.ttsRate, ttsPitch: A11Y.ttsPitch,
    autism: A11Y.autism, focusMode: A11Y.focusMode, noAnimations: A11Y.noAnimations,
    tabNav: A11Y.tabNav, pomodoro: A11Y.pomodoro, pomodoroMin: A11Y.pomodoroMin,
  };
  try { localStorage.setItem('a11y_state', JSON.stringify(s)); } catch(e) {}
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('a11y_state') || '{}');
    Object.assign(A11Y, s);
  } catch(e) {}
}

// ══════════════════════════════════════════
// BUILD PANEL UI
// ══════════════════════════════════════════
function buildPanel() {
  const style = document.createElement('style');
  style.textContent = `
    /* ── TRIGGER BUTTON ── */
    #a11yTrigger {
      position: fixed; bottom: 24px; right: 24px; z-index: 9000;
      width: 54px; height: 54px; border-radius: 50%;
      background: linear-gradient(135deg, #7c6af7, #4af7b0);
      border: none; cursor: pointer; box-shadow: 0 6px 24px rgba(124,106,247,.5);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem; transition: transform .3s, box-shadow .3s;
      animation: a11yPulse 3s infinite;
    }
    #a11yTrigger:hover { transform: scale(1.1); box-shadow: 0 10px 32px rgba(124,106,247,.6); }
    @keyframes a11yPulse { 0%,100%{box-shadow:0 6px 24px rgba(124,106,247,.5)} 50%{box-shadow:0 6px 32px rgba(124,106,247,.8)} }

    /* ── PANEL ── */
    #a11yPanel {
      position: fixed; bottom: 90px; right: 24px; z-index: 9001;
      width: 340px; max-height: 80vh;
      background: #111118; border: 1px solid rgba(255,255,255,.1);
      border-radius: 20px; overflow: hidden;
      box-shadow: 0 24px 60px rgba(0,0,0,.7);
      display: none; flex-direction: column;
      font-family: 'DM Sans', sans-serif;
      animation: a11ySlide .25s ease;
    }
    #a11yPanel.open { display: flex; }
    @keyframes a11ySlide { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

    .a11y-head {
      padding: 16px 18px 12px;
      border-bottom: 1px solid rgba(255,255,255,.07);
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(124,106,247,.08);
      flex-shrink: 0;
    }
    .a11y-head-title { font-weight: 700; font-size: .9rem; color: #fff; }
    .a11y-head-sub { font-size: .7rem; color: rgba(255,255,255,.4); margin-top: 2px; }
    .a11y-close { background: none; border: none; color: rgba(255,255,255,.5); cursor: pointer; font-size: 1.1rem; transition: color .2s; }
    .a11y-close:hover { color: #f74a6a; }

    .a11y-tabs {
      display: flex; border-bottom: 1px solid rgba(255,255,255,.07);
      flex-shrink: 0; overflow-x: auto; scrollbar-width: none;
    }
    .a11y-tabs::-webkit-scrollbar { display: none; }
    .a11y-tab {
      flex: 1; min-width: 42px; padding: 9px 6px; border: none; background: none;
      color: rgba(255,255,255,.4); cursor: pointer; font-size: .7rem;
      transition: all .2s; display: flex; flex-direction: column; align-items: center; gap: 2px;
      white-space: nowrap;
    }
    .a11y-tab .ti { font-size: 1.1rem; }
    .a11y-tab:hover { background: rgba(255,255,255,.04); color: rgba(255,255,255,.7); }
    .a11y-tab.active { color: #7c6af7; border-bottom: 2px solid #7c6af7; background: rgba(124,106,247,.06); }

    .a11y-body { overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: #7c6af7 transparent; }
    .a11y-section { display: none; padding: 14px 16px; }
    .a11y-section.active { display: block; }

    /* Toggle rows */
    .a11y-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; border-radius: 10px; margin-bottom: 8px;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06);
      transition: background .2s;
    }
    .a11y-row:hover { background: rgba(255,255,255,.07); }
    .a11y-row-info { flex: 1; }
    .a11y-row-label { font-size: .82rem; font-weight: 600; color: #e8e8f0; display: flex; align-items: center; gap: 7px; }
    .a11y-row-desc { font-size: .72rem; color: rgba(255,255,255,.4); margin-top: 2px; }

    /* Toggle switch */
    .a11y-toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; margin-left: 10px; }
    .a11y-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .a11y-slider {
      position: absolute; inset: 0; background: rgba(255,255,255,.15);
      border-radius: 22px; cursor: pointer; transition: background .3s;
    }
    .a11y-slider::before {
      content: ''; position: absolute; width: 16px; height: 16px;
      left: 3px; top: 3px; background: #fff; border-radius: 50%;
      transition: transform .3s; box-shadow: 0 1px 4px rgba(0,0,0,.3);
    }
    .a11y-toggle input:checked + .a11y-slider { background: #7c6af7; }
    .a11y-toggle input:checked + .a11y-slider::before { transform: translateX(18px); }

    /* Slider controls */
    .a11y-control { margin-bottom: 10px; }
    .a11y-control-label { font-size: .78rem; color: rgba(255,255,255,.6); margin-bottom: 6px; display: flex; justify-content: space-between; }
    .a11y-control-label span { color: #7c6af7; font-weight: 700; }
    .a11y-range { width: 100%; accent-color: #7c6af7; cursor: pointer; }

    /* Buttons */
    .a11y-btn-group { display: flex; gap: 6px; flex-wrap: wrap; }
    .a11y-btn {
      padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.05); color: #e8e8f0; cursor: pointer;
      font-size: .78rem; font-weight: 600; transition: all .2s;
      font-family: 'DM Sans', sans-serif;
    }
    .a11y-btn:hover { border-color: #7c6af7; color: #7c6af7; background: rgba(124,106,247,.1); }
    .a11y-btn.active-btn { background: rgba(124,106,247,.2); border-color: #7c6af7; color: #7c6af7; }

    /* Pomodoro */
    .pomo-display {
      text-align: center; padding: 16px;
      background: rgba(255,255,255,.03); border-radius: 12px;
      border: 1px solid rgba(255,255,255,.07); margin-bottom: 12px;
    }
    .pomo-timer {
      font-family: 'Space Mono', monospace; font-size: 2.4rem; font-weight: 700;
      color: #7c6af7; line-height: 1; margin-bottom: 6px;
    }
    .pomo-state { font-size: .75rem; color: rgba(255,255,255,.5); letter-spacing: 2px; text-transform: uppercase; }
    .pomo-prog-track { height: 6px; background: rgba(255,255,255,.08); border-radius: 3px; margin: 10px 0; overflow: hidden; }
    .pomo-prog-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #7c6af7, #4af7b0); transition: width .5s; }
    .pomo-btns { display: flex; gap: 8px; justify-content: center; }
    .pomo-btn {
      padding: 8px 18px; border-radius: 8px; border: none; cursor: pointer;
      font-weight: 700; font-size: .8rem; font-family: 'DM Sans', sans-serif;
      transition: all .2s;
    }
    .pomo-start { background: #7c6af7; color: #fff; }
    .pomo-start:hover { background: #6a58e0; }
    .pomo-stop { background: rgba(247,74,106,.2); color: #f74a6a; border: 1px solid rgba(247,74,106,.3); }
    .pomo-stop:hover { background: rgba(247,74,106,.3); }

    /* TTS status */
    .tts-reading {
      background: rgba(74,247,176,.08); border: 1px solid rgba(74,247,176,.2);
      border-radius: 10px; padding: 8px 12px; font-size: .78rem; color: #4af7b0;
      margin-bottom: 10px; display: none; align-items: center; gap: 8px;
    }
    .tts-reading.show { display: flex; }
    .tts-dot { width: 8px; height: 8px; border-radius: 50%; background: #4af7b0; animation: a11yPulse 1s infinite; }

    /* Voice status */
    .voice-status {
      background: rgba(247,201,72,.07); border: 1px solid rgba(247,201,72,.2);
      border-radius: 10px; padding: 10px 12px; font-size: .8rem;
      color: rgba(255,255,255,.6); margin-top: 10px; line-height: 1.5;
      display: none;
    }
    .voice-status.show { display: block; }
    .voice-listening { color: #f7c948; font-weight: 700; }

    /* Section divider */
    .a11y-divider { height: 1px; background: rgba(255,255,255,.05); margin: 10px 0; }

    /* Reset btn */
    .a11y-reset {
      width: 100%; padding: 9px; border: 1px solid rgba(247,74,106,.25);
      border-radius: 9px; background: rgba(247,74,106,.07); color: #f74a6a;
      cursor: pointer; font-size: .78rem; font-weight: 600;
      font-family: 'DM Sans', sans-serif; margin-top: 8px; transition: all .2s;
    }
    .a11y-reset:hover { background: rgba(247,74,106,.15); }

    /* ── APPLIED STYLES ── */
    body.a11y-dyslexia * { font-family: 'OpenDyslexic', 'Comic Sans MS', 'Arial', sans-serif !important; letter-spacing: .06em !important; word-spacing: .18em !important; line-height: 1.9 !important; }
    body.a11y-high-contrast { filter: contrast(1.5) brightness(1.1); }
    body.a11y-no-anim *, body.a11y-no-anim *::before, body.a11y-no-anim *::after { animation: none !important; transition: none !important; }
    body.a11y-focus-mode .card:not(:focus-within):not(:hover) { opacity: .35; }
    body.a11y-focus-mode .section:not(:focus-within) { opacity: .35; }
    body.a11y-tab-nav :focus { outline: 3px solid #7c6af7 !important; outline-offset: 3px !important; border-radius: 4px; }
    body.a11y-autism { background: #0c0c12 !important; }
    body.a11y-autism * { border-radius: 6px !important; }
    body.a11y-autism .card { transform: none !important; box-shadow: none !important; }
    body.a11y-autism .card::before { display: none !important; }

    /* Reading guide */
    #a11yReadGuide {
      position: fixed; left: 0; right: 0; height: 44px;
      background: rgba(124,106,247,.12); border-top: 2px solid rgba(124,106,247,.4);
      border-bottom: 2px solid rgba(124,106,247,.4);
      pointer-events: none; z-index: 8999;
      display: none; transition: top .05s;
    }
    #a11yReadGuide.show { display: block; }

    /* TTS highlight */
    .tts-highlight { background: rgba(247,201,72,.25) !important; border-radius: 3px; }

    /* Font size */
    body.a11y-fs-1 { font-size: 105% !important; }
    body.a11y-fs-2 { font-size: 112% !important; }
    body.a11y-fs-3 { font-size: 120% !important; }
    body.a11y-fs-4 { font-size: 130% !important; }
    body.a11y-fs--1 { font-size: 95% !important; }
    body.a11y-fs--2 { font-size: 88% !important; }

    /* Pomodoro overlay */
    #a11yPomoOverlay {
      display: none; position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(10,10,15,.95); border: 1px solid rgba(124,106,247,.4);
      border-radius: 14px; padding: 10px 20px; z-index: 8998;
      font-family: 'Space Mono', monospace; color: #7c6af7;
      font-size: .85rem; box-shadow: 0 8px 30px rgba(0,0,0,.5);
      align-items: center; gap: 10px;
    }
    #a11yPomoOverlay.show { display: flex; }
    .pomo-mini-time { font-size: 1.1rem; font-weight: 700; }
    .pomo-mini-label { font-size: .68rem; color: rgba(255,255,255,.4); }

    /* Sign lang badge */
    #a11ySignBadge {
      display: none; position: fixed; bottom: 90px; left: 20px; z-index: 8997;
      background: rgba(10,10,15,.9); border: 1px solid rgba(74,247,176,.3);
      border-radius: 12px; padding: 8px 14px; font-size: .78rem; color: #4af7b0;
      font-family: 'DM Sans', sans-serif;
    }
    #a11ySignBadge.show { display: block; }

    /* Mobile */
    @media (max-width: 480px) {
      #a11yPanel { width: calc(100vw - 20px); right: 10px; bottom: 80px; }
      #a11yTrigger { bottom: 16px; right: 16px; }
    }
  `;
  document.head.appendChild(style);

  // Reading guide element
  readingGuideEl = document.createElement('div');
  readingGuideEl.id = 'a11yReadGuide';
  document.body.appendChild(readingGuideEl);

  // Pomodoro overlay
  const pomoOv = document.createElement('div');
  pomoOv.id = 'a11yPomoOverlay';
  pomoOv.innerHTML = `<div>⏱</div><div><div class="pomo-mini-time" id="pomoMiniTime">25:00</div><div class="pomo-mini-label" id="pomoMiniLabel">ЖҰМЫС</div></div>`;
  document.body.appendChild(pomoOv);

  // Sign lang badge
  const signB = document.createElement('div');
  signB.id = 'a11ySignBadge';
  signB.textContent = '🤟 Ым тілі белсенді';
  document.body.appendChild(signB);

  // Trigger button
  const trigger = document.createElement('button');
  trigger.id = 'a11yTrigger';
  trigger.setAttribute('aria-label', 'Қолжетімділік баптаулары');
  trigger.innerHTML = '♿';
  trigger.onclick = togglePanel;
  document.body.appendChild(trigger);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'a11yPanel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Accessibility баптаулары');
  panel.innerHTML = `
    <div class="a11y-head">
      <div>
        <div class="a11y-head-title">♿ Қолжетімділік</div>
        <div class="a11y-head-sub">Accessibility · 6 бағыт</div>
      </div>
      <button class="a11y-close" onclick="togglePanel()" aria-label="Жабу">✕</button>
    </div>

    <div class="a11y-tabs">
      <button class="a11y-tab active" onclick="switchTab(0,this)"><span class="ti">👁️</span>Көру</button>
      <button class="a11y-tab" onclick="switchTab(1,this)"><span class="ti">👂</span>Есту</button>
      <button class="a11y-tab" onclick="switchTab(2,this)"><span class="ti">🧠</span>Таным</button>
      <button class="a11y-tab" onclick="switchTab(3,this)"><span class="ti">⌨️</span>Мотор</button>
      <button class="a11y-tab" onclick="switchTab(4,this)"><span class="ti">🤖</span>AI</button>
      <button class="a11y-tab" onclick="switchTab(5,this)"><span class="ti">⏱</span>СДВГ</button>
    </div>

    <div class="a11y-body">

      <!-- 0: КӨРУ -->
      <div class="a11y-section active" id="a11y-s0">
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">📖 Дислексия шрифті</div>
            <div class="a11y-row-desc">Оқуға ыңғайлы арнайы шрифт</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-dyslexia" onchange="applyDyslexia(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">🌗 Жоғары контраст</div>
            <div class="a11y-row-desc">Мәтін көріну деңгейін арттыру</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-contrast" onchange="applyContrast(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">📏 Оқу сызғышы</div>
            <div class="a11y-row-desc">Тінтуір жолын бөлектейді</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-guide" onchange="applyGuide(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-divider"></div>
        <div class="a11y-control">
          <div class="a11y-control-label">Шрифт өлшемі <span id="fsVal">${A11Y.fontSize >= 0 ? '+' : ''}${A11Y.fontSize}</span></div>
          <input type="range" class="a11y-range" min="-2" max="4" value="${A11Y.fontSize}" oninput="applyFontSize(+this.value)" id="fs-range">
        </div>
        <div class="a11y-btn-group">
          <button class="a11y-btn" onclick="applyFontSize(A11Y.fontSize-1)">A−</button>
          <button class="a11y-btn" onclick="applyFontSize(0)">A Қалыпты</button>
          <button class="a11y-btn" onclick="applyFontSize(A11Y.fontSize+1)">A+</button>
        </div>
      </div>

      <!-- 1: ЕСТУ -->
      <div class="a11y-section" id="a11y-s1">
        <div class="tts-reading" id="ttsStatus">
          <div class="tts-dot"></div>
          <span id="ttsStatusText">Оқылуда...</span>
          <button onclick="ttsStop()" style="margin-left:auto;background:none;border:none;color:#f74a6a;cursor:pointer;font-size:.8rem">⏹ Тоқта</button>
        </div>
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">🔊 Мәтінді дауыстап оқу (TTS)</div>
            <div class="a11y-row-desc">Бетті/таңдалған мәтінді оқиды</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-tts" onchange="applyTTS(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">🤟 Ым тілі режимі</div>
            <div class="a11y-row-desc">Бетте ым тілі белгісін көрсету</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-sign" onchange="applySign(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-divider"></div>
        <div class="a11y-control">
          <div class="a11y-control-label">Оқу жылдамдығы <span id="ttsRateVal">${A11Y.ttsRate}x</span></div>
          <input type="range" class="a11y-range" min="0.5" max="2" step="0.1" value="${A11Y.ttsRate}" oninput="A11Y.ttsRate=+this.value;document.getElementById('ttsRateVal').textContent=this.value+'x';saveState()">
        </div>
        <div class="a11y-control">
          <div class="a11y-control-label">Дауыс биіктігі <span id="ttsPitchVal">${A11Y.ttsPitch}</span></div>
          <input type="range" class="a11y-range" min="0.5" max="2" step="0.1" value="${A11Y.ttsPitch}" oninput="A11Y.ttsPitch=+this.value;document.getElementById('ttsPitchVal').textContent=this.value;saveState()">
        </div>
        <div class="a11y-btn-group" style="margin-top:4px">
          <button class="a11y-btn" onclick="ttsReadPage()">📄 Бетті оқу</button>
          <button class="a11y-btn" onclick="ttsReadSelected()">✂️ Таңдалғанды</button>
          <button class="a11y-btn" onclick="ttsStop()">⏹ Тоқта</button>
        </div>
      </div>

      <!-- 2: ТАНЫМ -->
      <div class="a11y-section" id="a11y-s2">
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">🎨 Аутизм режимі</div>
            <div class="a11y-row-desc">Жеңілдетілген, тыныш дизайн</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-autism" onchange="applyAutism(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">🎯 Фокус режимі</div>
            <div class="a11y-row-desc">Тышқан астындағы элемент ғана айқын</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-focus" onchange="applyFocusMode(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">🚫 Анимацияларды өшіру</div>
            <div class="a11y-row-desc">Барлық қозғалысты тоқтату</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-noanim" onchange="applyNoAnim(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-divider"></div>
        <div style="font-size:.75rem;color:rgba(255,255,255,.4);line-height:1.6;padding:4px 0">
          💡 Аутизм режимі: жарқыраған анимациялар, күтпеген өзгерістер азаяды. Тыныш, болжамды интерфейс ұсынылады.
        </div>
      </div>

      <!-- 3: МОТОРЛЫҚ -->
      <div class="a11y-section" id="a11y-s3">
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">🎤 Дауыспен басқару</div>
            <div class="a11y-row-desc">Дауыс командалары (Chrome)</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-voice" onchange="applyVoice(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="voice-status" id="voiceStatus">
          <div class="voice-listening" id="voiceListening">🎤 Тыңдалуда...</div>
          <div style="margin-top:6px;font-size:.72rem">Командалар: <br>
          🔵 <b>"Жоғары"</b> — бет жоғары<br>
          🔵 <b>"Төмен"</b> — бет төмен<br>
          🔵 <b>"Басты бет"</b> — index<br>
          🔵 <b>"Сабақ"</b> — sabaq.html<br>
          🔵 <b>"Тест"</b> — test.html<br>
          🔵 <b>"Ойын"</b> — game.html<br>
          🔵 <b>"Оқу"</b> — TTS бастау<br>
          🔵 <b>"Тоқта"</b> — TTS тоқтату</div>
        </div>
        <div class="a11y-row" style="margin-top:10px">
          <div class="a11y-row-info">
            <div class="a11y-row-label">⌨️ Tab навигация режимі</div>
            <div class="a11y-row-desc">Пернетақтамен толық навигация</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-tab" onchange="applyTabNav(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-divider"></div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.4);line-height:1.5;padding:4px 0">
          ⌨️ Tab: Tab/Shift+Tab — навигация, Enter/Space — активация, Esc — жабу
        </div>
      </div>

      <!-- 4: AI ЧАТ -->
      <div class="a11y-section" id="a11y-s4">
        <div style="background:rgba(124,106,247,.07);border:1px solid rgba(124,106,247,.2);border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:.82rem;font-weight:600;color:#e8e8f0;margin-bottom:6px">🤖 AI Кіріктірілген Көмек</div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.5);line-height:1.6">Claude API арқылы тікелей қолжетімділік сұрақтарына жауап аласыз. Бет мазмұны туралы сұрауға болады.</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <textarea id="a11yAiInput" placeholder="Сұрағыңызды жазыңыз..." rows="3" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;color:#e8e8f0;font-family:'DM Sans',sans-serif;font-size:.82rem;outline:none;resize:none;box-sizing:border-box;transition:border-color .2s" onfocus="this.style.borderColor='#7c6af7'" onblur="this.style.borderColor='rgba(255,255,255,.1)'" onkeydown="if(event.ctrlKey&&event.key==='Enter')a11yAiAsk()"></textarea>
          <div style="display:flex;gap:8px">
            <button class="a11y-btn" onclick="a11yAiAsk()" style="flex:1;background:rgba(124,106,247,.2);border-color:#7c6af7;color:#7c6af7">🤖 Сұра</button>
            <button class="a11y-btn" onclick="a11yAiReadPage()" style="flex:1">📄 Беттің мазмұны</button>
          </div>
          <div id="a11yAiResp" style="display:none;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;font-size:.8rem;color:rgba(255,255,255,.8);line-height:1.6;max-height:180px;overflow-y:auto"></div>
        </div>
      </div>

      <!-- 5: СДВГ -->
      <div class="a11y-section" id="a11y-s5">
        <div class="pomo-display">
          <div class="pomo-timer" id="pomoTimer">25:00</div>
          <div class="pomo-state" id="pomoState">ДАЙЫН</div>
          <div class="pomo-prog-track"><div class="pomo-prog-fill" id="pomoProgFill" style="width:0%"></div></div>
          <div class="pomo-btns">
            <button class="pomo-btn pomo-start" onclick="pomoStart()">▶ Бастау</button>
            <button class="pomo-btn pomo-stop" onclick="pomoStop()">⏹ Тоқта</button>
          </div>
        </div>
        <div class="a11y-control">
          <div class="a11y-control-label">Жұмыс уақыты <span id="pomoMinVal">${A11Y.pomodoroMin} мин</span></div>
          <input type="range" class="a11y-range" min="5" max="60" step="5" value="${A11Y.pomodoroMin}" oninput="A11Y.pomodoroMin=+this.value;A11Y.pomodoroLeft=+this.value*60;document.getElementById('pomoMinVal').textContent=this.value+' мин';updatePomoDisplay();saveState()">
        </div>
        <div class="a11y-row">
          <div class="a11y-row-info">
            <div class="a11y-row-label">📊 Прогресс трекері</div>
            <div class="a11y-row-desc">Оқу прогресін бетте бөлектеу</div>
          </div>
          <label class="a11y-toggle"><input type="checkbox" id="tog-pomo" onchange="applyPomodoro(this.checked)"><span class="a11y-slider"></span></label>
        </div>
        <div class="a11y-divider"></div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.4);line-height:1.6;padding:4px 0">
          ⏱ Pomodoro: 25 мин жұмыс → 5 мин үзіліс. СДВГ кезінде фокус ұстауға помагает.
        </div>
      </div>

    </div><!-- /body -->

    <div style="padding:12px 16px;border-top:1px solid rgba(255,255,255,.06);flex-shrink:0">
      <button class="a11y-reset" onclick="resetAll()">↺ Барлық баптауларды қалпына келтіру</button>
    </div>
  `;
  document.body.appendChild(panel);
}

// ══════════════════════════════════════════
// PANEL CONTROL
// ══════════════════════════════════════════
function togglePanel() {
  const p = document.getElementById('a11yPanel');
  A11Y.panelOpen = !A11Y.panelOpen;
  p.classList.toggle('open', A11Y.panelOpen);
}

function switchTab(i, btn) {
  document.querySelectorAll('.a11y-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.a11y-section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('a11y-s' + i).classList.add('active');
}

// ══════════════════════════════════════════
// 1. КӨРУ
// ══════════════════════════════════════════
function applyDyslexia(on) {
  A11Y.dyslexia = on;
  document.body.classList.toggle('a11y-dyslexia', on);
  saveState();
}

function applyContrast(on) {
  A11Y.highContrast = on;
  document.body.classList.toggle('a11y-high-contrast', on);
  saveState();
}

function applyGuide(on) {
  A11Y.readingGuide = on;
  const el = document.getElementById('a11yReadGuide');
  el.classList.toggle('show', on);
  if (on) {
    document.addEventListener('mousemove', moveGuide);
  } else {
    document.removeEventListener('mousemove', moveGuide);
  }
  saveState();
}

function moveGuide(e) {
  const el = document.getElementById('a11yReadGuide');
  if (el) el.style.top = (e.clientY - 22) + 'px';
}

function applyFontSize(n) {
  n = Math.max(-2, Math.min(4, n));
  A11Y.fontSize = n;

  // Remove old injected style
  const oldStyle = document.getElementById('a11y-font-style');
  if (oldStyle) oldStyle.remove();

  if (n !== 0) {
    // Scale factors per step
    const scale = {'-2':0.82, '-1':0.90, 0:1, 1:1.12, 2:1.25, 3:1.40, 4:1.58};
    const z = scale[n] || 1;

    // Inject <style> that overrides ALL font-size with !important
    // Uses CSS calc() to multiply each rem value
    const style = document.createElement('style');
    style.id = 'a11y-font-style';
    style.textContent = `
      html { font-size: ${Math.round(16 * z)}px !important; }

      /* Force-override every text element — catches px, rem, em, all */
      body *:not(#a11yPanel):not(#a11yPanel *):not(#a11yTrigger) {
        font-size: calc(1em * ${z.toFixed(3)}) !important;
      }

      /* Named sizes — multiply base values */
      body h1:not(#a11yPanel *) { font-size: calc(2.2rem * ${z.toFixed(3)}) !important; }
      body h2:not(#a11yPanel *) { font-size: calc(1.4rem * ${z.toFixed(3)}) !important; }
      body h3:not(#a11yPanel *) { font-size: calc(1.1rem * ${z.toFixed(3)}) !important; }
      body h4:not(#a11yPanel *) { font-size: calc(0.95rem * ${z.toFixed(3)}) !important; }
      body p:not(#a11yPanel *), body li:not(#a11yPanel *), body td:not(#a11yPanel *) {
        font-size: calc(0.9rem * ${z.toFixed(3)}) !important;
      }
      body .card h3:not(#a11yPanel *) { font-size: calc(0.95rem * ${z.toFixed(3)}) !important; }
      body .card p:not(#a11yPanel *) { font-size: calc(0.82rem * ${z.toFixed(3)}) !important; }
      body .nav-link:not(#a11yPanel *) { font-size: calc(0.8rem * ${z.toFixed(3)}) !important; }
      body .nav-logo:not(#a11yPanel *) { font-size: calc(1rem * ${z.toFixed(3)}) !important; }
      body header h1 { font-size: clamp(calc(1.6rem * ${z.toFixed(3)}), 4vw, calc(2.8rem * ${z.toFixed(3)})) !important; }
      body .task-desc:not(#a11yPanel *),
      body .post-excerpt:not(#a11yPanel *),
      body .rev-text:not(#a11yPanel *),
      body .game-desc:not(#a11yPanel *),
      body .faq-a:not(#a11yPanel *) {
        font-size: calc(0.88rem * ${z.toFixed(3)}) !important;
      }
      body code:not(#a11yPanel *), body .ie-code:not(#a11yPanel *) {
        font-size: calc(0.82rem * ${z.toFixed(3)}) !important;
      }
      body .section-label:not(#a11yPanel *),
      body .header-badge:not(#a11yPanel *) {
        font-size: calc(0.65rem * ${z.toFixed(3)}) !important;
      }
      body .btn-primary:not(#a11yPanel *),
      body .btn-outline:not(#a11yPanel *),
      body .back-btn:not(#a11yPanel *),
      body .game-btn:not(#a11yPanel *),
      body .open-editor-btn:not(#a11yPanel *) {
        font-size: calc(0.9rem * ${z.toFixed(3)}) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Update UI
  const range = document.getElementById('fs-range');
  if (range) range.value = n;
  const val = document.getElementById('fsVal');
  if (val) val.textContent = (n >= 0 ? '+' : '') + n;
  saveState();
}

// ══════════════════════════════════════════
// 2. ЕСТУ — TTS
// ══════════════════════════════════════════
function applyTTS(on) {
  A11Y.tts = on;
  if (!on) ttsStop();
  saveState();
}

function applySign(on) {
  A11Y.signLang = on;
  document.getElementById('a11ySignBadge').classList.toggle('show', on);
  saveState();
}

function ttsSpeak(text) {
  if (!('speechSynthesis' in window)) { alert('Браузер TTS қолдамайды'); return; }
  ttsStop();
  if (!text || !text.trim()) return;
  ttsUtterance = new SpeechSynthesisUtterance(text);
  ttsUtterance.rate = A11Y.ttsRate;
  ttsUtterance.pitch = A11Y.ttsPitch;
  ttsUtterance.lang = 'ru-RU'; // closest to Kazakh
  const st = document.getElementById('ttsStatus');
  const stTxt = document.getElementById('ttsStatusText');
  if (st) { st.classList.add('show'); }
  if (stTxt) stTxt.textContent = text.substring(0, 40) + (text.length > 40 ? '...' : '');
  ttsUtterance.onend = () => { if (st) st.classList.remove('show'); };
  ttsUtterance.onerror = () => { if (st) st.classList.remove('show'); };
  window.speechSynthesis.speak(ttsUtterance);
}

function ttsReadPage() {
  const body = document.querySelector('main, .container, header') || document.body;
  const text = body.innerText.substring(0, 2000);
  ttsSpeak(text);
}

function ttsReadSelected() {
  const sel = window.getSelection();
  if (sel && sel.toString().trim()) {
    ttsSpeak(sel.toString());
  } else {
    ttsReadPage();
  }
}

function ttsStop() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const st = document.getElementById('ttsStatus');
  if (st) st.classList.remove('show');
}

// Auto-read on click if TTS is on
document.addEventListener('click', function(e) {
  if (!A11Y.tts) return;
  const el = e.target.closest('p, h1, h2, h3, h4, .card, .task-desc, .rev-text, .faq-q-text');
  if (el) {
    e.preventDefault();
    ttsSpeak(el.innerText);
  }
}, true);

// ══════════════════════════════════════════
// 3. ТАНЫМ
// ══════════════════════════════════════════
function applyAutism(on) {
  A11Y.autism = on;
  document.body.classList.toggle('a11y-autism', on);
  if (on) applyNoAnim(true);
  saveState();
}

function applyFocusMode(on) {
  A11Y.focusMode = on;
  document.body.classList.toggle('a11y-focus-mode', on);
  saveState();
}

function applyNoAnim(on) {
  A11Y.noAnimations = on;
  document.body.classList.toggle('a11y-no-anim', on);
  const tog = document.getElementById('tog-noanim');
  if (tog) tog.checked = on;
  saveState();
}

// ══════════════════════════════════════════
// 4. МОТОРЛЫҚ
// ══════════════════════════════════════════
function applyTabNav(on) {
  A11Y.tabNav = on;
  document.body.classList.toggle('a11y-tab-nav', on);
  // Make all cards keyboard-accessible
  if (on) {
    document.querySelectorAll('.card, .option, .cq-opt').forEach(el => {
      if (!el.tabIndex) el.tabIndex = 0;
      el.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });
  }
  saveState();
}

function applyVoice(on) {
  A11Y.voiceControl = on;
  const status = document.getElementById('voiceStatus');
  if (status) status.classList.toggle('show', on);

  if (!on) {
    if (recognition) { try { recognition.stop(); } catch(e){} recognition = null; }
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('Браузер дауыс тануды қолдамайды. Chrome пайдаланыңыз.');
    const tog = document.getElementById('tog-voice');
    if (tog) tog.checked = false;
    A11Y.voiceControl = false;
    if (status) status.classList.remove('show');
    return;
  }

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'ru-RU';

  recognition.onresult = function(e) {
    const cmd = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
    const li = document.getElementById('voiceListening');
    if (li) li.textContent = '🎤 "' + cmd + '"';
    handleVoiceCmd(cmd);
  };

  recognition.onerror = function(e) {
    console.log('Voice error:', e.error);
    if (e.error === 'not-allowed') {
      alert('Микрофонға рұқсат беріңіз!');
      const tog = document.getElementById('tog-voice');
      if (tog) tog.checked = false;
    }
  };

  recognition.onend = function() {
    if (A11Y.voiceControl) {
      try { recognition.start(); } catch(e) {}
    }
  };

  try { recognition.start(); } catch(e) {}
}

function handleVoiceCmd(cmd) {
  const nav = (url) => { window.location.href = url; };
  if (cmd.includes('жоғары') || cmd.includes('жогары')) window.scrollBy(0, -300);
  else if (cmd.includes('төмен') || cmd.includes('темен')) window.scrollBy(0, 300);
  else if (cmd.includes('басты') || cmd.includes('главная')) nav('index.html');
  else if (cmd.includes('сабақ') || cmd.includes('урок')) nav('sabaq.html');
  else if (cmd.includes('тест')) nav('test.html');
  else if (cmd.includes('ойын') || cmd.includes('игра')) nav('game.html');
  else if (cmd.includes('практика')) nav('practice.html');
  else if (cmd.includes('оқу') || cmd.includes('читать')) ttsReadPage();
  else if (cmd.includes('тоқта') || cmd.includes('стоп')) ttsStop();
  else if (cmd.includes('үлкейт') || cmd.includes('zoom')) applyFontSize(A11Y.fontSize + 1);
  else if (cmd.includes('кіші') || cmd.includes('уменьши')) applyFontSize(A11Y.fontSize - 1);
}

// ══════════════════════════════════════════
// 5. AI
// ══════════════════════════════════════════
async function a11yAiAsk() {
  const input = document.getElementById('a11yAiInput');
  const respEl = document.getElementById('a11yAiResp');
  const q = input.value.trim();
  if (!q) return;

  respEl.style.display = 'block';
  respEl.innerHTML = '<span style="color:#7c6af7">⏳ Жауап іздеуде...</span>';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: 'Сен 7-сынып Python оқулығының AI көмекшісісің. Қысқа, нақты қазақша жауап бер. Оқушыға достық тонда сөйле.',
        messages: [{ role: 'user', content: q }]
      })
    });
    const data = await res.json();
    const txt = data.content?.[0]?.text || 'Жауап алынбады';
    respEl.innerHTML = txt.replace(/\n/g, '<br>');
    if (A11Y.tts) ttsSpeak(txt);
  } catch(e) {
    respEl.innerHTML = '<span style="color:#f74a6a">Қате: API-ға қосылу мүмкін болмады</span>';
  }
}

async function a11yAiReadPage() {
  const input = document.getElementById('a11yAiInput');
  const pageText = (document.querySelector('.container') || document.body).innerText.substring(0, 800);
  input.value = 'Осы беттің мазмұнын қысқаша түсіндір: ' + pageText;
  await a11yAiAsk();
}

// ══════════════════════════════════════════
// 6. СДВГ — POMODORO
// ══════════════════════════════════════════
function applyPomodoro(on) {
  A11Y.pomodoro = on;
  saveState();
}

function pomoStart() {
  if (A11Y.pomodoroState === 'idle' || A11Y.pomodoroState === 'done') {
    A11Y.pomodoroState = 'work';
    A11Y.pomodoroLeft = A11Y.pomodoroMin * 60;
  }
  clearInterval(A11Y.pomodoroInterval);
  A11Y.pomodoroInterval = setInterval(pomoClock, 1000);
  document.getElementById('a11yPomoOverlay').classList.add('show');
  updatePomoDisplay();
}

function pomoStop() {
  clearInterval(A11Y.pomodoroInterval);
  A11Y.pomodoroState = 'idle';
  A11Y.pomodoroLeft = A11Y.pomodoroMin * 60;
  document.getElementById('a11yPomoOverlay').classList.remove('show');
  updatePomoDisplay();
}

function pomoClock() {
  if (A11Y.pomodoroLeft <= 0) {
    clearInterval(A11Y.pomodoroInterval);
    if (A11Y.pomodoroState === 'work') {
      A11Y.pomodoroState = 'break';
      A11Y.pomodoroLeft = 5 * 60;
      ttsSpeak('Үзіліс уақыты! 5 минут демалыңыз.');
      A11Y.pomodoroInterval = setInterval(pomoClock, 1000);
    } else {
      A11Y.pomodoroState = 'done';
      ttsSpeak('Pomodoro аяқталды! Жарайсың!');
      document.getElementById('a11yPomoOverlay').classList.remove('show');
    }
  } else {
    A11Y.pomodoroLeft--;
  }
  updatePomoDisplay();
}

function updatePomoDisplay() {
  const m = Math.floor(A11Y.pomodoroLeft / 60).toString().padStart(2, '0');
  const s = (A11Y.pomodoroLeft % 60).toString().padStart(2, '0');
  const total = A11Y.pomodoroState === 'break' ? 300 : A11Y.pomodoroMin * 60;
  const pct = Math.round((1 - A11Y.pomodoroLeft / total) * 100);
  const stateLabel = A11Y.pomodoroState === 'work' ? '⚡ ЖҰМЫС' : A11Y.pomodoroState === 'break' ? '☕ ҮЗІЛІС' : 'ДАЙЫН';

  const timerEl = document.getElementById('pomoTimer');
  const stateEl = document.getElementById('pomoState');
  const fillEl = document.getElementById('pomoProgFill');
  const miniEl = document.getElementById('pomoMiniTime');
  const miniLbl = document.getElementById('pomoMiniLabel');

  if (timerEl) timerEl.textContent = m + ':' + s;
  if (stateEl) stateEl.textContent = stateLabel;
  if (fillEl) fillEl.style.width = pct + '%';
  if (miniEl) miniEl.textContent = m + ':' + s;
  if (miniLbl) miniLbl.textContent = stateLabel;

  // Color
  const color = A11Y.pomodoroState === 'break' ? '#4af7b0' : '#7c6af7';
  if (timerEl) timerEl.style.color = color;
  if (fillEl) fillEl.style.background = `linear-gradient(90deg, ${color}, ${A11Y.pomodoroState === 'break' ? '#7c6af7' : '#f7c948'})`;
}

// ══════════════════════════════════════════
// RESET
// ══════════════════════════════════════════
function resetAll() {
  ttsStop();
  pomoStop();
  if (recognition) { try { recognition.stop(); } catch(e){} recognition = null; }
  document.removeEventListener('mousemove', moveGuide);

  ['a11y-dyslexia','a11y-high-contrast','a11y-autism','a11y-focus-mode',
   'a11y-no-anim','a11y-tab-nav'].forEach(c => document.body.classList.remove(c));
  for (let i = -2; i <= 4; i++) document.body.classList.remove('a11y-fs-' + i);

  document.getElementById('a11yReadGuide').classList.remove('show');
  document.getElementById('a11ySignBadge').classList.remove('show');

  Object.assign(A11Y, {
    dyslexia:false, highContrast:false, readingGuide:false, fontSize:0,
    tts:false, signLang:false, autism:false, focusMode:false, noAnimations:false,
    voiceControl:false, tabNav:false, pomodoro:false, pomodoroMin:25,
    pomodoroState:'idle', pomodoroLeft:25*60,
  });

  // Reset font size
  document.documentElement.style.fontSize = '16px';
  const fsStyle = document.getElementById('a11y-font-style');
  if (fsStyle) fsStyle.remove();

  // Reset all toggles
  document.querySelectorAll('.a11y-toggle input').forEach(t => t.checked = false);
  const fr = document.getElementById('fs-range');
  if (fr) fr.value = 0;
  const fv = document.getElementById('fsVal');
  if (fv) fv.textContent = '+0';
  updatePomoDisplay();
  saveState();
}

// ══════════════════════════════════════════
// APPLY SAVED STATE
// ══════════════════════════════════════════
function applySavedState() {
  if (A11Y.dyslexia) { applyDyslexia(true); setTog('tog-dyslexia', true); }
  if (A11Y.highContrast) { applyContrast(true); setTog('tog-contrast', true); }
  if (A11Y.readingGuide) { applyGuide(true); setTog('tog-guide', true); }
  if (A11Y.fontSize !== 0) { applyFontSize(A11Y.fontSize); }
  if (A11Y.autism) { applyAutism(true); setTog('tog-autism', true); }
  if (A11Y.focusMode) { applyFocusMode(true); setTog('tog-focus', true); }
  if (A11Y.noAnimations) { applyNoAnim(true); setTog('tog-noanim', true); }
  if (A11Y.tabNav) { applyTabNav(true); setTog('tog-tab', true); }
  if (A11Y.signLang) { applySign(true); setTog('tog-sign', true); }
  if (A11Y.pomodoro) { setTog('tog-pomo', true); }
  A11Y.pomodoroLeft = A11Y.pomodoroMin * 60;
  updatePomoDisplay();
}

function setTog(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
}

// ══════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  // Alt+A = toggle panel
  if (e.altKey && e.key === 'a') { e.preventDefault(); togglePanel(); }
  // Alt+R = read page
  if (e.altKey && e.key === 'r') { e.preventDefault(); ttsReadPage(); }
  // Alt+S = stop TTS
  if (e.altKey && e.key === 's') { e.preventDefault(); ttsStop(); }
  // Alt+P = pomodoro start/stop
  if (e.altKey && e.key === 'p') { e.preventDefault(); A11Y.pomodoroState === 'idle' ? pomoStart() : pomoStop(); }
  // Esc = close panel
  if (e.key === 'Escape' && A11Y.panelOpen) togglePanel();
});

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
function init() {
  loadState();
  buildPanel();
  applySavedState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose globally for inline handlers
window.togglePanel = togglePanel;
window.switchTab = switchTab;
window.applyDyslexia = applyDyslexia;
window.applyContrast = applyContrast;
window.applyGuide = applyGuide;
window.applyFontSize = applyFontSize;
window.applyTTS = applyTTS;
window.applySign = applySign;
window.ttsReadPage = ttsReadPage;
window.ttsReadSelected = ttsReadSelected;
window.ttsStop = ttsStop;
window.applyAutism = applyAutism;
window.applyFocusMode = applyFocusMode;
window.applyNoAnim = applyNoAnim;
window.applyVoice = applyVoice;
window.applyTabNav = applyTabNav;
window.applyPomodoro = applyPomodoro;
window.pomoStart = pomoStart;
window.pomoStop = pomoStop;
window.resetAll = resetAll;
window.a11yAiAsk = a11yAiAsk;
window.a11yAiReadPage = a11yAiReadPage;
window.A11Y = A11Y;
window.saveState = saveState;

})();
