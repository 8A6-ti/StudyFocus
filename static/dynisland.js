// init
const { ipcRenderer } = window.require('electron');
const island = document.getElementById('island');
const compact = document.getElementById('compact');
const expanded = document.getElementById('expanded');

island.addEventListener('mouseenter', () => {
  compact.style.display = 'none';
  expanded.style.display = 'flex';
  island.classList.add('hover');
});

island.addEventListener('mouseleave', () => {
  compact.style.display = 'flex';
  expanded.style.display = 'none';
  island.classList.remove('hover');
});

function switchMode() {
  const mode = document.getElementById("mode");
  mode.innerText = mode.innerText === "Study" ? "Break" : "Study";
}

function tickObjective() {
  alert("Objective marked as completed!");
}

function endSession() {
  alert("Session ended.");
}