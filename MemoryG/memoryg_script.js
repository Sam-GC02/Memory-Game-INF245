// ---- Settings (tweak these) ----
const LEVELS = [4, 6];            // grid sizes, one per level
const MATCH_POINTS = 100;
const WRONG_PENALTY = 10;
const SECONDS_PER_PAIR = 6;       // par time = pairs * this
const BONUS_PER_SECOND = 5;       // bonus for each second under par
const FLIP_BACK_DELAY = 800;      // ms before a wrong pair flips back
const BEST_KEY = "memory-match-best";

const EMOJIS = ["🐶","🐱","🦊","🐼","🐸","🦁","🐙","🦋","🍎","🍕","🍩","⚽","🚀","🎸","🌵","🌈","⭐","🎲"];

// ---- Elements ----
const board = document.getElementById("board");
const levelEl = document.getElementById("level");
const scoreEl = document.getElementById("score");
const movesEl = document.getElementById("moves");
const timeEl = document.getElementById("time");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const panelTitle = document.getElementById("panel-title");
const panelDetails = document.getElementById("panel-details");
const panelBtn = document.getElementById("panel-btn");

// ---- State ----
let levelIndex, totalScore, levelScore, moves, matchedPairs, totalPairs;
let firstCard, secondCard, locked, seconds, timerId, best;

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; }
  catch { return 0; }
}
function saveBest(value) {
  try { localStorage.setItem(BEST_KEY, String(value)); } catch {}
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function updateStats() {
  levelEl.textContent = levelIndex + 1;
  scoreEl.textContent = totalScore + levelScore;
  movesEl.textContent = moves;
  timeEl.textContent = seconds + "s";
  bestEl.textContent = best;
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    seconds++;
    updateStats();
  }, 1000);
}

function startLevel(index) {
  stopTimer();
  levelIndex = index;
  const size = LEVELS[index];
  totalPairs = (size * size) / 2;
  levelScore = 0;
  moves = 0;
  matchedPairs = 0;
  seconds = 0;
  firstCard = secondCard = null;
  locked = false;

  const faces = shuffle([...EMOJIS]).slice(0, totalPairs);
  const deck = shuffle([...faces, ...faces]);

  board.innerHTML = "";
  board.className = "board size-" + size;
  board.style.setProperty("--size", size);

  deck.forEach((emoji) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.dataset.emoji = emoji;
    card.setAttribute("aria-label", "Face-down card");
    card.innerHTML =
      '<span class="card-inner">' +
      '<span class="card-back"></span>' +
      '<span class="card-front">' + emoji + "</span></span>";
    card.addEventListener("click", () => flip(card));
    board.appendChild(card);
  });

  updateStats();
}

function flip(card) {
  if (locked || card === firstCard || card.classList.contains("matched")) return;

  startTimer(); // timer begins on the first flip
  card.classList.add("flipped");
  card.setAttribute("aria-label", "Card " + card.dataset.emoji);

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  moves++;
  locked = true;

  if (firstCard.dataset.emoji === secondCard.dataset.emoji) {
    levelScore += MATCH_POINTS;
    matchedPairs++;
    [firstCard, secondCard].forEach((c) => {
      c.classList.add("matched");
      c.disabled = true;
    });
    resetPick();
    updateStats();
    if (matchedPairs === totalPairs) setTimeout(finishLevel, 500);
  } else {
    levelScore = Math.max(0, levelScore - WRONG_PENALTY);
    updateStats();
    setTimeout(() => {
      [firstCard, secondCard].forEach((c) => {
        c.classList.remove("flipped");
        c.setAttribute("aria-label", "Face-down card");
      });
      resetPick();
    }, FLIP_BACK_DELAY);
  }
}

function resetPick() {
  firstCard = secondCard = null;
  locked = false;
}

function finishLevel() {
  stopTimer();
  const par = totalPairs * SECONDS_PER_PAIR;
  const bonus = Math.max(0, par - seconds) * BONUS_PER_SECOND;
  totalScore += levelScore + bonus;
  levelScore = 0;
  updateStats();

  const isLast = levelIndex === LEVELS.length - 1;
  const rows = [
    ["Moves", moves],
    ["Time", seconds + "s"],
    ["Time bonus", "+" + bonus],
    ["Total score", totalScore],
  ];

  if (isLast) {
    const newBest = totalScore > best;
    if (newBest) { best = totalScore; saveBest(best); updateStats(); }
    showPanel(newBest ? "You win! New best score" : "You win!", rows, "Play again", () => startGame());
  } else {
    showPanel("Level " + (levelIndex + 1) + " complete", rows, "Start level " + (levelIndex + 2), () => startLevel(levelIndex + 1));
  }
}

function showPanel(title, rows, buttonText, onClick) {
  panelTitle.textContent = title;
  panelDetails.innerHTML = rows.map(([k, v]) => "<dt>" + k + "</dt><dd>" + v + "</dd>").join("");
  panelBtn.textContent = buttonText;
  panelBtn.onclick = () => { overlay.hidden = true; onClick(); };
  overlay.hidden = false;
  panelBtn.focus();
}

function startGame() {
  totalScore = 0;
  best = loadBest();
  overlay.hidden = true;
  startLevel(0);
}

document.getElementById("restart").addEventListener("click", startGame);
startGame();
