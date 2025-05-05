// Global variables
let isStudyMode = true;
let objectives = [];
let allowedApps = [];
let currentProgress = 100;
let timeData = { time: "25:00", restTime: "5:00" };
let countdownInterval = null;
let secondsLeft = 5;
let studyTotalSeconds = 25 * 60; // 25 minutes in seconds
let restTotalSeconds = 5 * 60;   // 5 minutes in seconds
let initialStudyTime = 25 * 60;  // 25 minutes in seconds
let initialRestTime = 5 * 60;    // 5 minutes in seconds

// Constants
const REFRESH_INTERVAL = 10000; // check every 10 secs
const COUNTDOWN_SECONDS = 5;    // give em 5 secs to switch back

// Show buttons only on hover
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.overlay-container');
  container.addEventListener('mouseenter', () => {
    document.getElementById('actions').style.display = 'flex';
  });
  container.addEventListener('mouseleave', () => {
    document.getElementById('actions').style.display = 'none';
  });
  
  // Initial data fetch
  fetchData();
  
  // Set up periodic data refresh
  setInterval(fetchData, REFRESH_INTERVAL);
});

// Fetch data from backend
function fetchData() {
  fetch('http://localhost:5000/api/getdata/all')
    .then(response => response.json())
    .then(data => {
      window.updateOverlayData(data);
    })
    .catch(error => {
      console.error("Error fetching overlay data:", error.message);
    });
}

// Updates the big timer display
function updateTimerDisplay() {
  const timeDisplay = document.getElementById('mainTimer');
  if (isStudyMode) {
    timeDisplay.textContent = timeData.time;
  } else {
    timeDisplay.textContent = timeData.restTime;
  }
}

// Changes the status indicator and text
function updateStatusIndicator() {
  const statusText = document.getElementById('statusText');
  const statusIndicator = document.querySelector('.status-indicator');
  
  statusIndicator.className = 'status-indicator';
  
  if (isStudyMode) {
    statusText.textContent = 'Study Mode';
    statusIndicator.classList.add('status-active');
  } else {
    statusText.textContent = 'Rest Mode';
    statusIndicator.classList.add('status-rest');
  }
}

// Renders the objectives list
function renderObjectives() {
  const objectivesList = document.getElementById('objectivesList');
  objectivesList.innerHTML = '';

  if (!objectives || objectives.length === 0) {
    objectivesList.innerHTML = '<div class="line">No objectives set for this session.</div>';
    return;
  }

  objectives.forEach((objective, index) => {
    const objectiveItem = document.createElement('li');
    objectiveItem.className = 'objective-item';
    if (objective.completed) {
      objectiveItem.classList.add('completed');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'objective-checkbox';
    checkbox.checked = objective.completed || false;
    
    // Only allow interaction if objective is not completed
    if (!objective.completed) {
      checkbox.addEventListener('change', () => toggleObjectiveCompletion(index));
    } else {
      checkbox.disabled = true; // Disable checkbox if objective is completed
    }

    const objectiveText = document.createElement('span');
    objectiveText.className = 'objective-text';
    if (objective.completed) {
      objectiveText.classList.add('objective-completed');
    }
    objectiveText.textContent = objective.text;

    objectiveItem.appendChild(checkbox);
    objectiveItem.appendChild(objectiveText);

    if (objective.completedAt) {
      const timestamp = document.createElement('span');
      timestamp.className = 'objective-timestamp';
      timestamp.textContent = formatTimestamp(objective.completedAt);
      objectiveItem.appendChild(timestamp);
    }

    objectivesList.appendChild(objectiveItem);
  });
}

// Formats timestamps to be more readable
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Marks an objective as completed
function toggleObjectiveCompletion(index) {
  if (!objectives[index].completed) {
    objectives[index].completed = true;
    objectives[index].completedAt = new Date().toISOString();
    
    // Send update to backend
    fetch('http://localhost:5000/api/update-objective', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        index: index,
        completed: true,
        completedAt: objectives[index].completedAt
      })
    }).catch(err => console.error('Failed to update objective:', err));
    
    renderObjectives();
  }
}

// Renders the whitelisted apps list
function renderAllowedApps() {
  const allowedAppsContainer = document.getElementById('allowedApps');
  allowedAppsContainer.innerHTML = '';

  if (!allowedApps || allowedApps.length === 0) {
    allowedAppsContainer.innerHTML = '<div class="line">No apps are whitelisted.</div>';
    return;
  }

  allowedApps.forEach(app => {
    const appElement = document.createElement('div');
    appElement.className = 'allowed-app';
    
    // Check if both title and process exist
    if (app.title && app.process) {
      appElement.textContent = `${app.title} (${app.process})`;
    } else if (app.title) {
      appElement.textContent = app.title;
    } else if (app.process) {
      appElement.textContent = app.process;
    } else {
      appElement.textContent = "Unknown app";
    }
    
    allowedAppsContainer.appendChild(appElement);
  });
}

// Switches between study and rest modes
function switchMode() {
  isStudyMode = !isStudyMode;
  
  // Update UI
  updateStatusIndicator();
  updateTimerDisplay();
  updateProgressBar();
  
  // Update button text
  const modeButton = document.getElementById('modeButton');
  modeButton.textContent = isStudyMode ? 'Switch to Rest' : 'Switch to Study';
  
  // Call backend API to switch mode
  fetch('http://localhost:5000/api/switch-mode', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: isStudyMode ? 'study' : 'rest' })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to switch mode');
    }
    return response.json();
  })
  .then(data => {
    console.log("Mode switched successfully:", data);
    // Force refresh data
    fetchData();
  })
  .catch(err => console.error('Failed to switch mode:', err));
}

// Ends the current study session
function endSession() {
  if (confirm('Are you sure you want to end this study session?')) {
    fetch('http://localhost:5000/api/end-session', { 
      method: 'POST' 
    }).then(() => {
      // Close the overlay window
      if (window.electron) {
        window.electron.closeWindow();
      }
    }).catch(err => console.error('Failed to end session:', err));
  }
}

// Starts the warning countdown when using unauthorized apps
function startAppDetectionCountdown() {
  const warningBanner = document.getElementById('warningBanner');
  const countdownElement = document.getElementById('countdown');
  const statusIndicator = document.querySelector('.status-indicator');
  
  // Show warning banner
  warningBanner.style.display = 'block';
  
  // Change status indicator to warning
  statusIndicator.className = 'status-indicator status-warning';
  
  // Reset and start countdown
  secondsLeft = COUNTDOWN_SECONDS;
  countdownElement.textContent = secondsLeft;
  
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  countdownInterval = setInterval(() => {
    secondsLeft--;
    countdownElement.textContent = secondsLeft;
    
    if (secondsLeft <= 0) {
      // Time's up - deduct from rest time
      clearInterval(countdownInterval);
      deductFromRestTime();
    }
  }, 1000);
}

// Stops the warning countdown
function stopAppDetectionCountdown() {
  const warningBanner = document.getElementById('warningBanner');
  
  // Hide warning banner
  warningBanner.style.display = 'none';
  
  // Update status indicator back to normal
  updateStatusIndicator();
  
  // Clear the countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

// Parses a time string in format "MM:SS" to seconds
function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    // Format is MM:SS
    return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
  } else if (parts.length === 3) {
    // Format is HH:MM:SS
    return (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseInt(parts[2]);
  }
  return 0;
}

// Formats seconds into a time string (MM:SS)
function formatSecondsToTime(seconds) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainingSeconds = Math.max(0, seconds) % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Calculates progress based on current time remaining
function calculateTimeProgress() {
  // Determine if we're in study or rest mode
  const currentTimeStr = isStudyMode ? timeData.time : timeData.restTime;
  const currentSeconds = parseTimeToSeconds(currentTimeStr);
  
  // Get the appropriate total time
  const totalSeconds = isStudyMode ? initialStudyTime : initialRestTime;
  
  // Calculate the progress percentage
  let percentage = (currentSeconds / totalSeconds) * 100;
  
  // Ensure the percentage is within 0-100 range
  percentage = Math.max(0, Math.min(100, percentage));
  
  return percentage;
}

// Updates the progress bar
function updateProgressBar() {
  const progressPercentage = calculateTimeProgress();
  const progressFill = document.getElementById('progressFill');
  progressFill.style.width = `${progressPercentage}%`;
  
  // Change color based on progress (green to red as time decreases)
  if (progressPercentage > 66) {
    progressFill.style.backgroundColor = "#4CAF50"; // Green
  } else if (progressPercentage > 33) {
    progressFill.style.backgroundColor = "#FFA500"; // Orange
  } else {
    progressFill.style.backgroundColor = "#F44336"; // Red
  }
}

function deductFromRestTime() {
    // First check current app status
    fetch('http://localhost:5000/api/getdata/all')
      .then(response => response.json())
      .then(data => {
        // Only deduct time if user is still in unallowed app
        if (data.unallowedAppWarning) {
          // Proceed with time deduction
          fetch('http://localhost:5000/api/deduct-rest-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deductSeconds: 30 })
          })
          .then(response => {
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            return response.json();
          })
          .then(data => {
            if (data.time) {
              timeData = data.time;
              updateTimerDisplay();
              updateProgressBar();
              
              // Switch to study mode if rest time is depleted
              if (parseTimeToSeconds(timeData.restTime) <= 0 && !isStudyMode) {
                switchMode();
              }
            }
          })
          .catch(err => {
            console.error('Failed to deduct rest time:', err);
            // Fallback UI update if backend fails
            if (timeData && timeData.restTime) {
              const restSeconds = parseTimeToSeconds(timeData.restTime);
              if (restSeconds > 30) {
                timeData.restTime = formatSecondsToTime(restSeconds - 30);
              } else {
                timeData.restTime = "00:00";
                if (!isStudyMode) {
                  switchMode();
                }
              }
              updateTimerDisplay();
              updateProgressBar();
            }
          });
        } else {
          // User has switched to allowed app, stop countdown
          console.log('User returned to allowed app, no time deducted');
        }
        // Always stop the countdown after checking
        stopAppDetectionCountdown();
      })
      .catch(err => {
        console.error('Failed to check app status:', err);
        stopAppDetectionCountdown();
      });
}

// Checks if the current application is allowed
function checkCurrentApp(currentAppData) {
  // No app data provided
  if (!currentAppData || !currentAppData.process) {
    stopAppDetectionCountdown(); // No active app data, so stop any warnings
    return;
  }
  
  // Check if the app is in the allowed list
  const isAllowed = allowedApps.some(app => 
    (app.process && currentAppData.process && app.process.toLowerCase() === currentAppData.process.toLowerCase()) || 
    (app.title && currentAppData.title && currentAppData.title.toLowerCase().includes(app.title.toLowerCase()))
  );
  
  // Check if it's a system process (these should always be allowed)
  const systemProcesses = [
    "explorer.exe", "SearchUI.exe", "SearchApp.exe", "StartMenuExperienceHost.exe",
    "ShellExperienceHost.exe", "Taskmgr.exe", "SystemSettings.exe", "RuntimeBroker.exe",
    "svchost.exe", "dllhost.exe", "electron.exe"
  ];
  
  const isSystemProcess = systemProcesses.includes(currentAppData.process);
  
  // Check if the window title contains StudyFocus (our own app)
  const isStudyFocusApp = currentAppData.title && currentAppData.title.includes("StudyFocus");
  
  // If the app is allowed, is a system process, or is our own app, it's allowed
  if (isAllowed || isSystemProcess || isStudyFocusApp) {
    stopAppDetectionCountdown();
  } else {
    startAppDetectionCountdown();
  }
}

// Updates the overlay data with information from the backend
window.updateOverlayData = function(data) {
  // Update time data
  if (data && data.time) {
    timeData = data.time;
    
    // Store the initial times if this is the first data we've received
    if (initialStudyTime === 25 * 60 && data.time.time) {
      initialStudyTime = parseTimeToSeconds(data.time.time);
    }
    if (initialRestTime === 5 * 60 && data.time.restTime) {
      initialRestTime = parseTimeToSeconds(data.time.restTime);
    }
    
    updateTimerDisplay();
  }

  // Update objectives
  if (data && data.objectives && data.objectives.obj) {
    objectives = Array.isArray(data.objectives.obj) ? data.objectives.obj : [];
    
    // Make sure each objective has the correct format
    objectives = objectives.map(obj => {
      if (typeof obj === 'string') {
        return { text: obj, completed: false };
      } else if (typeof obj === 'object' && obj !== null) {
        return obj;
      }
      return { text: "Unknown objective", completed: false };
    });
    
    renderObjectives();
  }
  
  // Update allowed apps
  if (data && data.apps) {
    allowedApps = data.apps;
    renderAllowedApps();
  }
  
  // Update mode
  if (data && data.mode) {
    const newMode = data.mode === "study";
    
    // Only update if the mode has changed
    if (isStudyMode !== newMode) {
      isStudyMode = newMode;
      updateStatusIndicator();
      
      // Update button text
      const modeButton = document.getElementById('modeButton');
      if (modeButton) {
        modeButton.textContent = isStudyMode ? 'Switch to Rest' : 'Switch to Study';
      }
    }
  }
  
  // Update progress bar
  updateProgressBar();
  
  // Check if current app is allowed
  if (data && data.currentApp) {
    checkCurrentApp(data.currentApp);
  }
  
  // Handle unallowed app warning
  if (data && data.unallowedAppWarning) {
    startAppDetectionCountdown();
  } else if (data && data.unallowedAppWarning === false) {
    stopAppDetectionCountdown();
  }
};