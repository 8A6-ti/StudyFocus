from flask import Flask, send_from_directory, request, jsonify
import pygetwindow as gw
import win32gui
import win32con
import win32ui
import win32api
import win32process
import ctypes
import io
import psutil
import base64
import logging
import tkinter as tk
from win10toast import ToastNotifier
from PIL import Image
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
    global response_data
    response_data = request.get_json()
    print("received data:", response_data)
    return jsonify({"status": "success", "message": "data received"}), 200

# send data (obj)
@app.route('/api/getdata', methods=['GET'])
def send_data():
    return jsonify({"data": response_data}), 200

# send open window titles - windows only
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

# recieve time allocation data
@app.route('/api/data/time', methods=['POST'])
def receive_time_data():
    global time_data
    time_data = request.get_json()
    print("received time data:", time_data)
    return jsonify({"status": "success", "message": "time data recieved"}), 200

# global store for saved apps
saved_apps = []

# receive saved apps
@app.route('/api/saveapps', methods=['POST'])
def save_apps():
    global saved_apps
    data = request.get_json()
    saved_apps = data.get('apps', [])
    print("received saved apps:", saved_apps)
    return jsonify({"status": "success", "message": "apps saved"}), 200

# run flask
if __name__ == '__main__':
    print("StudyFocus System Controller\nby 8A6 ti team\n--")
    if DEV_MODE:
        print("Developer mode has been turned on, all logs are enabled and debug mode has been enabled on Flask.")
        toast.show_toast(
            "StudyFocus Dev Mode",
            "Developer Mode has been enabled. You may experience instability and all logs are enabled in console along with Flask debug mode being enabled.",
            duration = 20,
            threaded = True,
        )
    app.run(host='0.0.0.0', port=PORT, debug=DEV_MODE)
