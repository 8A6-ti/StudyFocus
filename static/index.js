// init
const { ipcRenderer } = window.require('electron');
const selectedApps = new Set();

// prog bar element init
function createProgressBar(initialStep, totalSteps) {
  const container = document.createElement('div');
  container.classList.add('progress-bar-container');
  container.innerHTML = `
      <div class="progress-bar">
          <div class="progress-fill"></div>
          <div class="checkpoints">
              <div class="checkpoint" style="left: 0%;">1</div>
              <div class="checkpoint" style="left: 25%;">2</div>
              <div class="checkpoint" style="left: 50%;">3</div>
              <div class="checkpoint" style="left: 75%;">4</div>
              <div class="checkpoint" style="left: 100%;">5</div>
          </div>
      </div>
  `;
  const progressFill = container.querySelector('.progress-fill');
  const checkpoints = container.querySelectorAll('.checkpoint');

  // update progress bar func
  function update(step) {
    const progressPercentage = (step / totalSteps) * 100;
    progressFill.style.width = `${progressPercentage}%`;
    checkpoints.forEach((checkpoint, index) => {
      if (index <= step) {
        checkpoint.classList.add('completed');
      } else {
        checkpoint.classList.remove('completed');
      }
    });
  }
  update(initialStep);
  return { element: container, update };
}

// hover anim on buttons
function addHoverAnimation(button) {
  button.style.transition = 'transform 0.3s ease-in-out';
  button.addEventListener('mouseover', () => {
    button.style.transform = 'scale(1.1)';
  });
  button.addEventListener('mouseout', () => {
    button.style.transform = 'scale(1)';
  });
}

// show view
function showView(viewId) {
  const views = [
    'index-view',
    'objectives-view',
    'timeallocation-view',
    'timeallocation1-view',
    'appallocation-view',
    'summary-view'
  ];
  views.forEach(id => {
    document.getElementById(id).style.display = (id === viewId) ? 'block' : 'none';
  });
}

// update bar progress
function setupTitlebarProgress(newStep, totalSteps = 4) {
    const titlebar = document.querySelector('.titlebar');
    const existingBar = titlebar.querySelector('.progress-bar-container');
    if (existingBar) {
      // update if prog bar exists
      const progressFill = existingBar.querySelector('.progress-fill');
      const checkpoints = existingBar.querySelectorAll('.checkpoint');
      setTimeout(() => {
        const progressPercentage = (newStep / totalSteps) * 100;
        progressFill.style.width = `${progressPercentage}%`;
        checkpoints.forEach((checkpoint, index) => {
          if (index <= newStep) {
            checkpoint.classList.add('completed');
          } else {
            checkpoint.classList.remove('completed');
          }
        });
      }, 0);
      // return update func
      return function update(step) {
        const progressPercentage = (step / totalSteps) * 100;
        progressFill.style.width = `${progressPercentage}%`;
        checkpoints.forEach((checkpoint, index) => {
          if (index <= step) {
            checkpoint.classList.add('completed');
          } else {
            checkpoint.classList.remove('completed');
          }
        });
      };
    } else {
      // create prog bar if none
      const { element, update } = createProgressBar(newStep, totalSteps);
      titlebar.appendChild(element);
      return update;
    }
  }

// views

function setupIndexView() {
  showView('index-view');
  const updateProgress = setupTitlebarProgress(0);
  const startSessionBtn = document.getElementById('start-session');
  if (startSessionBtn) {
    addHoverAnimation(startSessionBtn);
    startSessionBtn.addEventListener('click', () => {
      updateProgress(1);
      setTimeout(() => {
        setupObjectivesView();
      }, 500);
    });
  } else {
    console.error('btn not found');
  }
}

function setupObjectivesView() {
  showView('objectives-view');
  const updateProgress = setupTitlebarProgress(1);
  const objectiveContainer = document.querySelector('#objectives-view .objective');
  // clear container if any
  objectiveContainer.innerHTML = '';

  // init
  const addButton = document.createElement('button');
  addButton.textContent = 'Add Objective';
  addButton.id = 'add-objective';
  addButton.style.margin = '10px auto';
  addButton.style.display = 'block';
  addButton.style.padding = '8px 16px';
  addButton.style.border = 'none';
  addButton.style.borderRadius = '5px';
  addButton.style.backgroundColor = '#4CAF50';
  addButton.style.color = 'white';
  addButton.style.fontSize = '14px';
  addButton.style.cursor = 'pointer';
  addButton.style.fontFamily = 'PSBold, sans-serif';
  addHoverAnimation(addButton);
  objectiveContainer.appendChild(addButton);

  // init
  const submitButton = document.createElement('button');
  submitButton.textContent = 'Submit Objectives';
  submitButton.id = 'submit-objectives';
  submitButton.style.margin = '10px auto';
  submitButton.style.display = 'block';
  submitButton.style.padding = '8px 16px';
  submitButton.style.border = 'none';
  submitButton.style.borderRadius = '5px';
  submitButton.style.backgroundColor = '#008CBA';
  submitButton.style.color = 'white';
  submitButton.style.fontSize = '14px';
  submitButton.style.cursor = 'pointer';
  submitButton.style.fontFamily = 'PSBold, sans-serif';
  addHoverAnimation(submitButton);
  objectiveContainer.appendChild(submitButton);

  // update visibility if there is input
  function updateAddButtonVisibility() {
    const inputs = document.querySelectorAll('.objective-input');
    const lastInput = inputs[inputs.length - 1];
    const hasNonEmptyInput = Array.from(inputs).some(input => input.value.trim() !== '');
    addButton.style.display = (!lastInput || lastInput.value.trim() !== '') ? 'block' : 'none';
    submitButton.style.display = hasNonEmptyInput ? 'block' : 'none';
  }  

  // new obj txt input on click
  addButton.addEventListener('click', () => {
    // init div
    const objectiveDiv = document.createElement('div');
    objectiveDiv.classList.add('objective-item');
    objectiveDiv.style.display = 'flex';
    objectiveDiv.style.alignItems = 'center';
    objectiveDiv.style.justifyContent = 'center';
    objectiveDiv.style.marginBottom = '10px';
    objectiveDiv.style.opacity = '0';
    objectiveDiv.style.transition = 'opacity 0.5s ease-in-out';

    // init input
    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'objective';
    input.classList.add('objective-input');
    input.style.width = '250px';
    input.style.padding = '6px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '5px';
    input.style.fontSize = '14px';
    input.style.fontFamily = 'PS, sans-serif';
    input.style.textAlign = 'center';
    input.addEventListener('input', updateAddButtonVisibility);

    // init delete btn
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'X'; // change to emoji later
    deleteBtn.classList.add('delete-btn');
    deleteBtn.style.marginLeft = '10px';
    deleteBtn.style.padding = '5px 10px';
    deleteBtn.style.border = 'none';
    deleteBtn.style.borderRadius = '5px';
    deleteBtn.style.backgroundColor = 'red';
    deleteBtn.style.color = 'white';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.fontFamily = 'PSBold, sans-serif';
    // del obj div on click
    deleteBtn.addEventListener('click', () => {
      objectiveDiv.remove();
      updateAddButtonVisibility();
    });

    objectiveDiv.appendChild(input);
    objectiveDiv.appendChild(deleteBtn);
    objectiveContainer.insertBefore(objectiveDiv, addButton);

    setTimeout(() => {
      objectiveDiv.style.opacity = '1';
    }, 10);
    updateAddButtonVisibility();
  });

  // submit obj - send post req to python
  submitButton.addEventListener('click', () => {
    const inputs = document.querySelectorAll('.objective-input');
    const objectives = Array.from(inputs)
      .map(input => input.value.trim())
      .filter(text => text !== '');
    if (objectives.length === 0) {
      alert('Please enter at least one objective before submitting.');
      return;
    }
    console.log('submitting obj: ', objectives);
    updateProgress(2);
    setTimeout(() => {
      fetch('http://localhost:5000/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obj: objectives })
      })
        .then(response => response.json())
        .then(data => console.log('res:', data))
        .catch(error => console.error('err when sending data:', error));
    //   ipcRenderer.send('submit-objectives'); // removed
      setupTimeAllocationView();
    }, 500);
  });

  updateAddButtonVisibility();
}

function setupTimeAllocationView() {
  showView('timeallocation-view');
  const updateProgress = setupTitlebarProgress(2);
  const allocateBreaksBtn = document.getElementById('allocate-breaks');
  const allocateObjectivesBtn = document.getElementById('allocate-objectives');

  if (allocateBreaksBtn) {
    addHoverAnimation(allocateBreaksBtn);
    allocateBreaksBtn.addEventListener('click', () => {
    //   ipcRenderer.send('timenbreak'); // removed
      updateProgress(2); // XD quên
      setTimeout(() => {
        setupTimeAllocation1View();
      }, 500);
    });
  } else {
    console.error('btn not found');
  }

  if (allocateObjectivesBtn) {
    addHoverAnimation(allocateObjectivesBtn);
    allocateObjectivesBtn.addEventListener('click', () => {
      // to be added
    });
  }
}

// simple time alloc
function setupTimeAllocation1View() {
  showView('timeallocation1-view');
  setupTitlebarProgress(2);
  
  // time pickers dropdown init
  function populateSelect(selectElement, min, max, step = 1, pad = false) {
    for (let i = min; i <= max; i += step) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = pad ? i.toString().padStart(2, '0') : i;
      selectElement.appendChild(option);
    }
  }
  
  // init
  const studyHourPicker = document.getElementById('study-hour-picker');
  const studyMinutePicker = document.getElementById('study-minute-picker');
  const restHourPicker = document.getElementById('rest-hour-picker');
  const restMinutePicker = document.getElementById('rest-minute-picker');
  const confirmTimeBtn = document.getElementById('confirm-time');

  // clear
  studyHourPicker.innerHTML = '';
  studyMinutePicker.innerHTML = '';
  restHourPicker.innerHTML = '';
  restMinutePicker.innerHTML = '';

  populateSelect(studyHourPicker, 1, 23);
  populateSelect(restHourPicker, 1, 23);
  populateSelect(studyMinutePicker, 0, 59, 5, true);
  populateSelect(restMinutePicker, 0, 59, 5, true);

  addHoverAnimation(confirmTimeBtn);
  confirmTimeBtn.addEventListener('click', () => {
    // convert HH:MM to seconds
    const studyHours = parseInt(studyHourPicker.value);
    const studyMinutes = parseInt(studyMinutePicker.value);
    const restHours = parseInt(restHourPicker.value);
    const restMinutes = parseInt(restMinutePicker.value);

    const studyTimeInSeconds = (studyHours * 3600) + (studyMinutes * 60);
    const restTimeInSeconds = (restHours * 3600) + (restMinutes * 60);

    console.log(`Study time in seconds: ${studyTimeInSeconds}`);
    console.log(`Rest time in seconds: ${restTimeInSeconds}`);

    fetch('http://localhost:5000/api/data/time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        time: studyTimeInSeconds,
        restTime: restTimeInSeconds 
      })
    })
      .then(response => response.json())
      .then(data => console.log('res:', data))
      .catch(error => console.error('err:', error));
    setTimeout(() => {
      setupAppAllocationView();
    }, 500);
  });
}

// app alloc - p
// Gãy tay vẫn chạy deadline =)))))
function setupAppAllocationView() {
  showView('appallocation-view');
  setupTitlebarProgress(3);

  const confirmBtn = document.getElementById('confirm-app');
  addHoverAnimation(confirmBtn);

  const selectedApps = new Set();
  const welcomeDiv = document.querySelector('#appallocation-view .welcome');

  // hide button
  confirmBtn.style.display = 'none';

  // func to show when smth there
  function updateConfirmButtonState() {
    confirmBtn.style.display = selectedApps.size === 0 ? 'none' : 'inline-block';
  }

  let menuContainer = document.createElement('div');
  menuContainer.className = 'app-menu-container';
  Object.assign(menuContainer.style, {
    margin: '20px 0',
    width: '100%'
  });

  let toggleButton = document.createElement('button');
  toggleButton.textContent = 'Show Open Applications';
  Object.assign(toggleButton.style, {
    width: '30%',
    padding: '12px',
    backgroundColor: '#444',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    cursor: 'pointer',
    marginBottom: '10px',
    fontFamily: 'PSBold, sans-serif'
  });
  addHoverAnimation(toggleButton);

  let appListContainer = document.createElement('div');
  appListContainer.className = 'app-list-container';
  Object.assign(appListContainer.style, {
    display: 'none',
    maxHeight: '300px',
    overflow: 'hidden',
    transition: 'max-height 0.3s ease-in-out'
  });

  let isOpen = false;
  toggleButton.addEventListener('click', () => {
    ipcRenderer.send('maximize');
    isOpen = !isOpen;
    appListContainer.style.display = isOpen ? 'block' : 'none';
    appListContainer.style.maxHeight = isOpen ? `${appListContainer.scrollHeight}px` : '0';
    toggleButton.textContent = isOpen ? 'Hide Open Applications' : 'Show Open Applications';
  });

  menuContainer.append(toggleButton, appListContainer);
  welcomeDiv.querySelector('.app-menu-container')?.remove();
  welcomeDiv.insertBefore(menuContainer, confirmBtn);

  function renderApps(apps) {
    appListContainer.innerHTML = '';

    apps.forEach(app => {
      const appKey = `${app.title}||${app.process}`;

      const appEntry = document.createElement('div');
      Object.assign(appEntry.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '10px 400px',
        padding: '12px',
        backgroundColor: selectedApps.has(appKey) ? '#2e7031' : '#333',
        borderRadius: '8px',
        transition: 'background-color 0.4s ease'
      });

      const iconImg = document.createElement('img');
      iconImg.src = `data:image/png;base64,${app.icon}`;
      iconImg.alt = 'icon';
      Object.assign(iconImg.style, {
        width: '32px',
        height: '32px',
        borderRadius: '6px',
        flexShrink: '0'
      });

      const titleSpan = document.createElement('span');
      titleSpan.textContent = `${app.title} (${app.process})`;
      Object.assign(titleSpan.style, {
        fontFamily: 'PS, sans-serif',
        fontSize: '14px',
        color: '#fff'
      });

      appEntry.append(iconImg, titleSpan);

      appEntry.addEventListener('click', () => {
        if (selectedApps.has(appKey)) {
          selectedApps.delete(appKey);
          appEntry.style.backgroundColor = '#333';
        } else {
          selectedApps.add(appKey);
          appEntry.style.backgroundColor = '#2e7031';
        }
        updateConfirmButtonState(); // show btn
      });

      appListContainer.appendChild(appEntry);
    });

    updateConfirmButtonState(); // show btn
  }

  async function fetchAndRenderApps() {
    try {
      const response = await fetch('http://localhost:5000/api/getdata/openwindows');
      const data = await response.json();

      const uniqueApps = Array.from(
        new Map(data.data.map(app => [app.process, app])).values()
      );
      // app blacklist (windows)
      const blockedProcesses = ['explorer.exe', 'systemsettings.exe', 'textinputhost.exe'];
      const blockedTitles = ['nvidia', 'nvidia geforce overlay', 'program manager', 'settings', 'windows input experience', 'studyfocus'];

      const filteredApps = uniqueApps.filter(app => {
        const proc = app.process?.toLowerCase();
        const title = app.title?.toLowerCase();
        return !blockedProcesses.includes(proc) && !blockedTitles.includes(title);
      });

      renderApps(filteredApps);
    } catch (error) {
      console.error('Error fetching open windows:', error);
    }
  }

  fetchAndRenderApps();
  const refreshInterval = setInterval(fetchAndRenderApps, 1000);

  confirmBtn.addEventListener('click', () => {
    ipcRenderer.send('unmaximize');
    clearInterval(refreshInterval);

    const selectedList = Array.from(selectedApps).map(str => {
      const [title, process] = str.split('||');
      return { title, process };
    });

    fetch('http://localhost:5000/api/saveapps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apps: selectedList })
    })
    .then(res => res.json())
    .then(res => console.log('Apps saved:', res))
    .catch(err => console.error('Error saving apps:', err));
    setTimeout(() => {
      setupSummaryView();
    }, 500);
  });
}

function setupSummaryView() {
  showView('summary-view');
  const startsesh = document.getElementById('confirm-sesh');
  startsesh.addEventListener('click', () => {
    // Start the session before creating overlay
    fetch('http://localhost:5000/api/start-session', {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      console.log('Session started:', data);
      createDynIsland();
    })
    .catch(err => console.error('Failed to start session:', err));
  });
}

function createDynIsland() {
  ipcRenderer.send('open-notification-overlay');
}

// page init
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('close btn clicked ipc req sent');
      ipcRenderer.send('close-window');
    });
  } else {
    console.error('btn not found');
    alert("Something may have been corrupted in your client install.");
  }
  
  setupIndexView();
});
