const STORAGE = "labible_plan_dashboard_v1";
const $ = id => document.getElementById(id);

function getData(){
  return JSON.parse(localStorage.getItem(STORAGE)) || {
    startDate: null,
    done: []
  };
}

function saveData(data){
  localStorage.setItem(STORAGE, JSON.stringify(data));
}

function daysBetween(d1, d2){
  return Math.floor((d2 - d1) / (1000*60*60*24));
}

function getTodayIndex(startDate){
  const start = new Date(startDate);
  const today = new Date();
  return Math.min(364, Math.max(0, daysBetween(start, today)));
}

function calculateStreak(done){
  let streak = 0;
  for(let i = done.length - 1; i >= 0; i--){
    if(done[i]) streak++;
    else break;
  }
  return streak;
}

function updateUI(){
  const data = getData();

  if(!data.startDate){
    $("currentDay").textContent = "—";
    return;
  }

  const todayIndex = getTodayIndex(data.startDate);

  $("currentDay").textContent = "Jour " + (todayIndex + 1);

  const totalDone = data.done.filter(Boolean).length;
  $("progressStats").textContent = totalDone + " / 365";

  const percent = Math.round((totalDone / 365) * 100);
  $("progressBar").style.width = percent + "%";

  $("streakCount").textContent = calculateStreak(data.done) + " jours";

  renderPlan(todayIndex);
}

function renderPlan(todayIndex){
  const data = getData();
  const container = $("planList");
  container.innerHTML = "";

  for(let i=0;i<365;i++){
    const done = data.done[i];
    const row = document.createElement("div");
    row.style.padding = "8px 0";
    row.style.borderTop = "1px solid var(--border)";
    row.innerHTML = `
      <span style="font-weight:900;color:${done?"var(--primary)":"var(--muted)"}">
        ${done?"✅":"⬜"} Jour ${i+1}
      </span>
      <button class="btn btn-secondary" style="margin-left:10px;" onclick="toggleDay(${i})">
        ${done?"Annuler":"Marquer"}
      </button>
    `;
    container.appendChild(row);
  }
}

function toggleDay(i){
  const data = getData();
  data.done[i] = !data.done[i];
  saveData(data);
  updateUI();
}

$("btnStart").onclick = () => {
  const data = getData();
  data.startDate = new Date().toISOString();
  data.done = [];
  saveData(data);
  updateUI();
};

$("btnReset").onclick = () => {
  localStorage.removeItem(STORAGE);
  location.reload();
};

$("btnToday").onclick = () => {
  const data = getData();
  if(!data.startDate) return;
  const index = getTodayIndex(data.startDate);
  toggleDay(index);
};

updateUI();