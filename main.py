from flask import Flask, send_from_directory, request, jsonify
import pygetwindow as gw
import win32gui
import win32con
import win32ui
import win32process
import ctypes
import io
import psutil
import base64
import logging
import tkinter as tk
import time
import datetime
from win10toast import ToastNotifier
from PIL import Image
import os
import json
import threading

# config
DEV_MODE = True # false on release
PORT = 5000  

# info box
window = tk.Tk()
window.title("StudyFocus Info")

#notif
toast = ToastNotifier()

# flask
app = Flask(__name__, static_folder='static')
log = logging.getLogger('werkzeug')
if DEV_MODE == False:
    log.setLevel(logging.ERROR)

# data init
response_data = None
time_data = None
session_active = False
session_mode = "study"  # "study" or "rest"
session_paused = False
session_start_time = None
current_time_left = None
objectives_data = None
active_window_info = None
last_unallowed_time = None
unallowed_app_warning_active = False
whitelisted_apps = []  # whitelisted apps to be saved (process name or title)
app_monitor_thread = None
app_monitor_running = False

# system processes to ignore
SYSTEM_PROCESSES = [
    "explorer.exe",      # Windows Explorer/Shell
    "SearchUI.exe",      # Windows Search
    "SearchApp.exe",     # Windows Search
    "StartMenuExperienceHost.exe",  # Start Menu
    "ShellExperienceHost.exe",      # Windows Shell Experience
    "Taskmgr.exe",      # Task Manager
    "SystemSettings.exe", # Windows Settings
    "RuntimeBroker.exe", # Runtime Broker
    "svchost.exe",      # Service Host 
    "dllhost.exe",      # COM Surrogate
    "electron.exe",    # studyfocus app
]

# parse time to seconds (MM:SS)
def parse_time_to_seconds(time_str):
    try:
        minutes, seconds = time_str.split(':')
        return int(minutes) * 60 + int(seconds)
    except:
        return 300  # default is 5 minutes
    
# format sec to time string
def format_seconds_to_time(seconds):
    minutes, seconds = divmod(max(0, seconds), 60)
    return f"{int(minutes):02d}:{int(seconds):02d}"

# index
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# other static files
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

# recieve data (obj)
@app.route('/api/data', methods=['POST'])
def receive_data():
    global response_data, objectives_data
    data = request.get_json()
    response_data = data
    
    # Transform objectives into objects with completion status
    if data and 'obj' in data and isinstance(data['obj'], list):
        objectives_data = {
            'obj': [{'text': obj, 'completed': False} for obj in data['obj']]
        }
    
    print("received data:", response_data)
    return jsonify({"status": "success", "message": "data received"}), 200

# send data (obj)
@app.route('/api/getdata', methods=['GET'])
def send_data():
    return jsonify({"data": objectives_data or response_data}), 200

# update obj when ticked
@app.route('/api/update-objective', methods=['POST'])
def update_objective():
    global objectives_data
    data = request.get_json()
    
    if not objectives_data or 'obj' not in objectives_data:
        return jsonify({"status": "error", "message": "No objectives data available"}), 400
    
    index = data.get('index')
    if index is None or not isinstance(index, int) or index < 0 or index >= len(objectives_data['obj']):
        return jsonify({"status": "error", "message": "Invalid objective index"}), 400
    
    objectives_data['obj'][index]['completed'] = data.get('completed', False)
    
    if data.get('completed', False) and 'completedAt' in data:
        objectives_data['obj'][index]['completedAt'] = data['completedAt']
    elif 'completedAt' in objectives_data['obj'][index]:
        del objectives_data['obj'][index]['completedAt']
    
    # Log the objective completion
    objective_text = objectives_data['obj'][index]['text']
    status = "completed" if data.get('completed', False) else "uncompleted"
    print(f"Objective '{objective_text}' marked as {status}")
    
    # Show notification
    if data.get('completed', False):
        toast.show_toast(
            "StudyFocus",
            f"Objective completed: {objective_text}",
            duration = 3,
            threaded = True,
        )
    
    return jsonify({"status": "success", "message": "Objective updated"}), 200

# switch modes
@app.route('/api/switch-mode', methods=['POST'])
def switch_mode():
    global session_mode
    data = request.get_json()
    
    if data and 'mode' in data:
        session_mode = data['mode']
        print(f"Session mode switched to: {session_mode}")
        
        toast.show_toast(
            "StudyFocus",
            f"Switched to {session_mode.capitalize()} Mode",
            duration = 3,
            threaded = True,
        )
        
        return jsonify({"status": "success", "message": f"Mode changed to {session_mode}"}), 200
    
    return jsonify({"status": "error", "message": "Invalid mode data"}), 400

# end session
@app.route('/api/end-session', methods=['POST'])
def end_session():
    global session_active, session_start_time, app_monitor_running
    
    # stop app monitoring
    app_monitor_running = False
    if app_monitor_thread:
        app_monitor_thread.join(timeout=1.0)
    
    # calc total time
    total_time = 0
    if session_start_time:
        total_time = int(time.time() - session_start_time)
        hours, remainder = divmod(total_time, 3600)
        minutes, seconds = divmod(remainder, 60)
        time_str = f"{hours}h {minutes}m {seconds}s"
    else:
        time_str = "Unknown"
    
    # calc completed objectives
    completed_objectives = 0
    if objectives_data and 'obj' in objectives_data:
        completed_objectives = sum(1 for obj in objectives_data['obj'] if obj.get('completed', False))
    
    session_active = False
    
    # win10 toast notification
    toast.show_toast(
        "StudyFocus Session Ended",
        f"Total time: {time_str}\nObjectives completed: {completed_objectives}",
        duration = 5,
        threaded = True,
    )
    
    # save to json (upload later?)
    try:
        session_stats = {
            "date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "duration": total_time,
            "duration_str": time_str,
            "objectives_total": len(objectives_data['obj']) if objectives_data and 'obj' in objectives_data else 0,
            "objectives_completed": completed_objectives,
            "objectives_details": objectives_data['obj'] if objectives_data and 'obj' in objectives_data else []
        }
        
        # create stats dir on system
        if not os.path.exists('stats'):
            os.makedirs('stats')
        
        # save to file with timestamp
        filename = f"stats/session_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(session_stats, f, indent=2)
        
        print(f"Session statistics saved to {filename}")
    except Exception as e:
        print(f"Failed to save session statistics: {e}")
    
    return jsonify({
        "status": "success", 
        "message": "Session ended",
        "stats": {
            "time": time_str,
            "completed_objectives": completed_objectives
        }
    }), 200

# func to get active window info
def get_active_window_info():
    try:
        hwnd = win32gui.GetForegroundWindow()
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        
        window_title = win32gui.GetWindowText(hwnd)
        
        try:
            process = psutil.Process(pid)
            process_name = process.name()
            
            return {
                'title': window_title,
                'process': process_name,
                'pid': pid,
                'hwnd': hwnd
            }
        except Exception as e:
            print(f"Error getting process info: {e}")
            return {
                'title': window_title,
                'process': "unknown",
                'pid': pid,
                'hwnd': hwnd
            }
    except Exception as e:
        print(f"Error getting active window: {e}")
        return None

# check if app is whitelisted
def is_app_whitelisted(app_info):
    if not app_info:
        return True  # default to true atm if no app info
    
    # ign system processes
    if app_info['process'] in SYSTEM_PROCESSES:
        return True
    
    # check if app is whitelisted
    for whitelisted_app in whitelisted_apps:
        # proc name match
        if 'process' in whitelisted_app and app_info['process'] and whitelisted_app['process'].lower() == app_info['process'].lower():
            return True
        
        # window title match or partial match
        if 'title' in whitelisted_app and app_info['title'] and whitelisted_app['title'].lower() in app_info['title'].lower():
            return True
    
    # StudyFocus app window should always be allowed
    if app_info['title'] and "StudyFocus" in app_info['title']:
        return True
    
    return False

# app monitoring thread
def monitor_active_apps():
    global active_window_info, last_unallowed_time, unallowed_app_warning_active, app_monitor_running
    
    app_monitor_running = True
    print("App monitoring thread started")
    
    while app_monitor_running:
        current_app = get_active_window_info()
        if current_app:
            active_window_info = current_app
            
            # check if app is whitelisted
            if not is_app_whitelisted(current_app):
                if not unallowed_app_warning_active:
                    # unallowed app detected
                    unallowed_app_warning_active = True
                    last_unallowed_time = time.time()
                    print(f"Unallowed app detected: {current_app['title']} ({current_app['process']})")
                else:
                    # is still in unallowed app
                    elapsed_time = time.time() - last_unallowed_time
                    if elapsed_time >= 5.0:  # 5 second threshold
                        # deduct time from rest (maybe make this the actual time?)
                        deduct_rest_time()
                        # reset timer
                        last_unallowed_time = time.time()
            else:
                # reset
                unallowed_app_warning_active = False
                last_unallowed_time = None
        
        time.sleep(0.5)  # check 0.5 seconds
    
    print("App monitoring thread stopped")

# start app monitoring thread
def start_app_monitoring():
    global app_monitor_thread
    
    if app_monitor_thread is None or not app_monitor_thread.is_alive():
        app_monitor_thread = threading.Thread(target=monitor_active_apps, daemon=True)
        app_monitor_thread.start()

# deduct rest time (30 seconds by default)
def deduct_rest_time(seconds_to_deduct=30):
    global time_data, session_mode
    
    if not time_data:
        return
    
    # win10 toast notification
    toast.show_toast(
        "StudyFocus Warning",
        f"Using unallowed app - {seconds_to_deduct} seconds deducted from rest time!",
        duration = 3,
        threaded = True,
    )
    
    print(f"Deducting {seconds_to_deduct} seconds from rest time")
    
    # convert time to seconds
    rest_seconds = parse_time_to_seconds(time_data.get('restTime', '5:00'))
    
    # deduct time
    if rest_seconds > seconds_to_deduct:
        rest_seconds -= seconds_to_deduct
    else:
        # if rest time is less than 0, set to 0
        rest_seconds = 0
        toast.show_toast(
            "StudyFocus Warning",
            f"You have no rest time left!",
            duration = 3,
            threaded = True,
        )
        # switch to study mode
        session_mode = "study"
    
    # update time data
    time_data['restTime'] = format_seconds_to_time(rest_seconds)
    
    return {
        'time': time_data.get('time', '25:00'),
        'restTime': time_data['restTime']
    }

# API endpoint for deducting rest time
@app.route('/api/deduct-rest-time', methods=['POST'])
def api_deduct_rest_time():
    data = request.get_json()
    seconds = data.get('deductSeconds', 30)
    
    updated_time = deduct_rest_time(seconds)
    
    return jsonify({
        "status": "success",
        "message": f"Deducted {seconds} seconds from rest time",
        "time": updated_time
    }), 200

# send window icon base64 - windows only
def get_window_icon_base64(hwnd):
    try:
        hicon = ctypes.windll.user32.SendMessageW(hwnd, win32con.WM_GETICON, 1, 0)

        if not hicon:
            hicon = ctypes.windll.user32.GetClassLongPtrW(hwnd, win32con.GCL_HICON)

        if not hicon:
            return None

        # create bitmap img
        hdc = win32gui.GetDC(0)
        hdc_mem = win32gui.CreateCompatibleDC(hdc)
        hbitmap = win32ui.CreateBitmap()
        hbitmap.CreateCompatibleBitmap(win32ui.CreateDCFromHandle(hdc), 32, 32)
        hdc_old = win32gui.SelectObject(hdc_mem, hbitmap.GetHandle())

        ctypes.windll.user32.DrawIconEx(hdc_mem, 0, 0, hicon, 32, 32, 0, 0, 3)
        win32gui.SelectObject(hdc_mem, hdc_old)

        # convert to png bitmap
        bmpinfo = hbitmap.GetInfo()
        bmpstr = hbitmap.GetBitmapBits(True)
        img = Image.frombuffer('RGBA', (bmpinfo['bmWidth'], bmpinfo['bmHeight']), bmpstr, 'raw', 'BGRA', 0, 1)

        # encode to b64
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        encoded_icon = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return encoded_icon

    except Exception as e:
        print(f"failed to get icon for hwnd {hwnd}: {e}")
        toast.show_toast(
            "StudyFocus Error",
            "Icons weren't fetched. This could be because you have too many apps open.",
            duration = 20,
            threaded = True,
        )
        return None

# get open windows - windows only
@app.route('/api/getdata/openwindows', methods=['GET'])
def get_window_titles_and_icons():
    try:
        windows = []
        for window in gw.getWindowsWithTitle(""):
            title = window.title.strip()
            if title:
                hwnd = window._hWnd
                icon_base64 = get_window_icon_base64(hwnd)

                # get process name
                try:
                    _, pid = win32process.GetWindowThreadProcessId(hwnd)
                    process_name = psutil.Process(pid).name()
                except Exception:
                    process_name = None

                windows.append({
                    "title": title,
                    "icon": icon_base64,     # null if none
                    "process": process_name  # null if error
                })
        return jsonify({"data": windows}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# receive time allocation data
@app.route('/api/data/time', methods=['POST'])
def receive_time_data():
    global time_data
    time_data = request.get_json()
    print("received time data:", time_data)
    return jsonify({"status": "success", "message": "time data recieved"}), 200

# global store for saved apps (now whitelisted apps)
@app.route('/api/saveapps', methods=['POST'])
def save_apps():
    global whitelisted_apps
    data = request.get_json()
    whitelisted_apps = data.get('apps', [])
    print("received whitelisted apps:", whitelisted_apps)
    return jsonify({"status": "success", "message": "whitelisted apps saved"}), 200

# Calculate and add progress percentage
def calculate_progress():
    # Placeholder for actual time calculation logic
    if not time_data:
        return 100
    # reuturn random percentage for now
    # calculate actual progress based on time_data later
    import random
    return random.randint(0, 100)

# send all saved data (objectives, time, apps)
@app.route('/api/getdata/all', methods=['GET'])
def get_all_data():
    # calculate progress percentage
    progress = calculate_progress()
    
    # use obj data if available, otherwise use response data
    obj_data = objectives_data or response_data
    
    return jsonify({
        "objectives": obj_data,
        "time": time_data,
        "apps": whitelisted_apps,
        "progress": progress,
        "mode": session_mode,
        "paused": session_paused,
        "currentApp": active_window_info,
        "unallowedAppWarning": unallowed_app_warning_active
    }), 200

# start session
@app.route('/api/start-session', methods=['POST'])
def start_session():
    global session_active, session_start_time, session_mode, session_paused
    
    session_active = True
    session_start_time = time.time()
    session_mode = "study"
    session_paused = False
    
    # Start app monitoring
    start_app_monitoring()
    
    toast.show_toast(
        "StudyFocus",
        "Study session started!",
        duration = 3,
        threaded = True,
    )
    
    return jsonify({"status": "success", "message": "Session started"}), 200

# tick-objective endpoint (for overlay)
@app.route('/api/tick-objective', methods=['POST'])
def tick_objective():
    if objectives_data and 'obj' in objectives_data:
        for i, obj in enumerate(objectives_data['obj']):
            if not obj.get('completed', False):
                objectives_data['obj'][i]['completed'] = True
                objectives_data['obj'][i]['completedAt'] = datetime.datetime.now().isoformat()
                
                toast.show_toast(
                    "StudyFocus",
                    f"Objective completed: {obj['text']}",
                    duration = 3,
                    threaded = True,
                )
                
                return jsonify({
                    "status": "success", 
                    "message": "Objective completed",
                    "index": i
                }), 200
                
    return jsonify({"status": "info", "message": "No uncompleted objectives found"}), 200

# end sesh (old)
@app.route('/end-session', methods=['POST'])
def end_session_legacy():
    return end_session()

# run flask
if __name__ == '__main__':
    os.system('title StudyFocus System Controller')
    print("StudyFocus System Controller\nby 8A6 ti team\n--")
    if DEV_MODE:
        print("Developer mode has been turned on, all logs are enabled and debug mode has been enabled on Flask.")
        toast.show_toast(
            "StudyFocus Dev Mode",
            "Developer Mode has been enabled. You may experience instability and all logs are enabled in console along with Flask debug mode being enabled.",
            duration = 20,
            threaded = True,
        )
        
    # start the app monitoring thread
    start_app_monitoring()
    
    app.run(host='0.0.0.0', port=PORT, debug=DEV_MODE)