// ---- Settings (tweak these) ----
const LEVELS = [
  { size: 4 },
  { size: 6 },
  { size: 6, timeLimit: 240,
    warning: "You only have <strong>4 minutes</strong> to complete the 6x6 grid. When time runs out, you lose." },
  { size: 4, maxMistakes: 8,
    warning: "You can make at most <strong>8 mistakes</strong> on this 4x4 grid. The ninth one and you lose." },
  { size: 8, timeLimit: 480,
    warning: "You only have <strong>8 minutes</strong> to complete the 8x8 grid. When time runs out, you lose." },
];
const MATCH_POINTS = 100;
const WRONG_PENALTY = 10;
const SECONDS_PER_PAIR = 6;       // par time = pairs * this (for the time bonus)
const BONUS_PER_SECOND = 5;
const FLIP_BACK_DELAY = 800;      // ms
const BEST_KEY = "memory-match-best";
const CONTACT_EMAIL = "yourname@example.com"; // <-- change this

// 8x8 needs 32 different faces
const EMOJIS = ["🐶","🐱","🦊","🐼","🐸","🦁","🐙","🦋","🍎","🍕","🍩","⚽","🚀","🎸","🌵","🌈","⭐","🎲",
                "🐵","🐧","🐢","🦄","🍓","🍔","🍉","🏀","🚗","✈️","🎧","🔥","🌙","🍒","🐝","🍪","🎯"];

// ---- Elements ----
const $ = (id) => document.getElementById(id);
const menuScreen = $("menu-screen"), gameScreen = $("game-screen"), board = $("board");
const levelEl = $("level"), scoreEl = $("score"), movesEl = $("moves"), mistakesEl = $("mistakes");
const timeEl = $("time"), timeBox = $("time-box"), bestEl = $("best");
const overlay = $("overlay"), panelTitle = $("panel-title"), panelText = $("panel-text");
const panelDetails = $("panel-details"), panelButtons = $("panel-buttons");

// ---- State ----
let levelIndex, totalScore, levelScore, moves, mistakes, matchedPairs, totalPairs;
let firstCard, secondCard, locked, seconds, timerId, best, runId = 0;

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch {}
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");

// Delayed action that is cancelled if the player restarts or leaves the level
function later(fn, ms) {
  const id = runId;
  setTimeout(() => { if (id === runId) fn(); }, ms);
}

function updateStats() {
  const level = LEVELS[levelIndex];
  levelEl.textContent = (levelIndex + 1) + " / " + LEVELS.length;
  scoreEl.textContent = totalScore + levelScore;
  movesEl.textContent = moves;
  mistakesEl.textContent = level.maxMistakes ? mistakes + " / " + level.maxMistakes : mistakes;
  const remaining = level.timeLimit ? Math.max(0, level.timeLimit - seconds) : null;
  timeEl.textContent = fmt(remaining !== null ? remaining : seconds);
  timeBox.classList.toggle("danger", remaining !== null && remaining <= 30);
  bestEl.textContent = best;
}

function stopTimer() { clearInterval(timerId); timerId = null; }

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    seconds++;
    updateStats();
    const limit = LEVELS[levelIndex].timeLimit;
    if (limit && seconds >= limit) lose("Time ran out.");
  }, 1000);
}

// ---- Popup ----
function showPanel({ title, text = "", rows = [], buttons }) {
  panelTitle.textContent = title;
  panelText.innerHTML = text;
  panelText.hidden = !text;
  panelDetails.innerHTML = rows.map(([k, v]) => "<dt>" + k + "</dt><dd>" + v + "</dd>").join("");
  panelDetails.hidden = !rows.length;
  panelButtons.innerHTML = "";
  buttons.forEach((b) => {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = b.label;
    if (b.secondary) el.className = "secondary";
    el.onclick = () => { overlay.hidden = true; if (b.onClick) b.onClick(); };
    panelButtons.appendChild(el);
  });
  overlay.hidden = false;
  panelButtons.firstChild.focus();
}

// ---- Screens ----
function showMenu() {
  runId++;
  stopTimer();
  overlay.hidden = true;
  gameScreen.hidden = true;
  menuScreen.hidden = false;
}

function startGame() {
  menuScreen.hidden = true;
  gameScreen.hidden = false;
  totalScore = 0;
  best = loadBest();
  startLevel(0);
}

function showContact() {
  showPanel({
    title: "Contact us",
    text: 'Questions or feedback? Email us at <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + "</a>.",
    buttons: [{ label: "Close" }],
  });
}

function exitGame() {
  window.close(); // only works if a script opened this tab
  setTimeout(() => showPanel({
    title: "Thanks for playing!",
    text: "Your browser doesn't let a page close its own tab, so you can close this tab yourself.",
    buttons: [{ label: "Back to menu" }],
  }), 200);
}

// ---- Levels ----
function startLevel(index) {
  runId++;
  stopTimer();
  levelIndex = index;
  const level = LEVELS[index];
  totalPairs = (level.size * level.size) / 2;
  levelScore = moves = mistakes = matchedPairs = seconds = 0;
  firstCard = secondCard = null;
  locked = false;

  const faces = shuffle([...EMOJIS]).slice(0, totalPairs);
  const deck = shuffle([...faces, ...faces]);

  board.innerHTML = "";
  board.className = "board size-" + level.size;
  board.style.setProperty("--size", level.size);

  deck.forEach((emoji) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.dataset.emoji = emoji;
    card.setAttribute("aria-label", "Face-down card");
    card.innerHTML = '<span class="card-inner"><span class="card-back"></span><span class="card-front">' + emoji + "</span></span>";
    card.addEventListener("click", () => flip(card));
    board.appendChild(card);
  });

  updateStats();

  if (level.warning) {
    locked = true;
    showPanel({
      title: "Level " + (index + 1) + ": heads up",
      text: level.warning,
      buttons: [{ label: "Start level", onClick: () => { locked = false; } }],
    });
  }
}

function flip(card) {
  if (locked || card === firstCard || card.classList.contains("matched")) return;

  startTimer(); // timer begins on the first flip
  card.classList.add("flipped");
  card.setAttribute("aria-label", "Card " + card.dataset.emoji);

  if (!firstCard) { firstCard = card; return; }

  secondCard = card;
  moves++;
  locked = true;

  if (firstCard.dataset.emoji === secondCard.dataset.emoji) {
    levelScore += MATCH_POINTS;
    matchedPairs++;
    [firstCard, secondCard].forEach((c) => { c.classList.add("matched"); c.disabled = true; });
    resetPick();
    updateStats();
    if (matchedPairs === totalPairs) later(finishLevel, 500);
    return;
  }

  mistakes++;
  levelScore = Math.max(0, levelScore - WRONG_PENALTY);
  updateStats();

  const max = LEVELS[levelIndex].maxMistakes;
  if (max && mistakes > max) {
    later(() => lose("You made more than " + max + " mistakes."), 700);
    return;
  }
  later(() => {
    [firstCard, secondCard].forEach((c) => {
      c.classList.remove("flipped");
      c.setAttribute("aria-label", "Face-down card");
    });
    resetPick();
  }, FLIP_BACK_DELAY);
}

function resetPick() { firstCard = secondCard = null; locked = false; }

// ---- End of level / game ----
function finishLevel() {
  stopTimer();
  const par = totalPairs * SECONDS_PER_PAIR;
  const bonus = Math.max(0, par - seconds) * BONUS_PER_SECOND;
  totalScore += levelScore + bonus;
  levelScore = 0;
  updateStats();

  const rows = [["Moves", moves], ["Mistakes", mistakes], ["Time", fmt(seconds)],
                ["Time bonus", "+" + bonus], ["Total score", totalScore]];

  if (levelIndex < LEVELS.length - 1) {
    showPanel({
      title: "Level " + (levelIndex + 1) + " complete",
      rows,
      buttons: [{ label: "Start level " + (levelIndex + 2), onClick: () => startLevel(levelIndex + 1) }],
    });
    return;
  }

  const newBest = totalScore > best;
  if (newBest) { best = totalScore; saveBest(best); updateStats(); }
  showPanel({
    title: "You win!",
    text: "You cleared all " + LEVELS.length + " levels." + (newBest ? " New best score!" : ""),
    rows,
    buttons: [{ label: "Retry from start", onClick: startGame },
              { label: "Main menu", secondary: true, onClick: showMenu }],
  });
}

function lose(reason) {
  stopTimer();
  locked = true;
  showPanel({
    title: "You lose",
    text: reason,
    rows: [["Level reached", levelIndex + 1], ["Score", totalScore + levelScore]],
    buttons: [{ label: "Retry from start", onClick: startGame },
              { label: "Main menu", secondary: true, onClick: showMenu }],
  });
}

// ---- Wiring ----
$("play-btn").addEventListener("click", startGame);
$("contact-btn").addEventListener("click", showContact);
$("exit-btn").addEventListener("click", exitGame);
$("menu-btn").addEventListener("click", showMenu);
$("restart").addEventListener("click", startGame);
