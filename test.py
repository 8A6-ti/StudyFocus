import win32gui
import win32con
import win32ui
import pygetwindow as gw
import ctypes
from PIL import Image

def get_window_icon(hwnd):
    """Retrieve the icon of a given window handle (hwnd)."""
    hicon = ctypes.windll.user32.SendMessageW(hwnd, win32con.WM_GETICON, 1, 0)
    
    if not hicon:
        hicon = ctypes.windll.user32.GetClassLongPtrW(hwnd, win32con.GCL_HICON)
    
    if not hicon:
        return None
    
    # icon to bitmap
    hdc = win32gui.GetDC(0)
    hdc_mem = win32gui.CreateCompatibleDC(hdc)
    hbitmap = win32ui.CreateBitmap()
    hbitmap.CreateCompatibleBitmap(win32ui.CreateDCFromHandle(hdc), 32, 32)
    hdc_old = win32gui.SelectObject(hdc_mem, hbitmap.GetHandle())

    ctypes.windll.user32.DrawIconEx(hdc_mem, 0, 0, hicon, 32, 32, 0, 0, 3)
    win32gui.SelectObject(hdc_mem, hdc_old)

    bmpinfo = hbitmap.GetInfo()
    bmpstr = hbitmap.GetBitmapBits(True)
    img = Image.frombuffer('RGBA', (bmpinfo['bmWidth'], bmpinfo['bmHeight']), bmpstr, 'raw', 'BGRA', 0, 1)

    win32gui.DeleteObject(hbitmap.GetHandle())
    win32gui.ReleaseDC(0, hdc)
    win32gui.DeleteDC(hdc_mem)

    return img

def get_open_window_icons():
    """Gets all open windows and their icons."""
    windows = gw.getWindowsWithTitle('')
    icons = {}

    for win in windows:
        if win.title:  # Ignore empty titles
            icon = get_window_icon(win._hWnd)
            if icon:
                icons[win.title] = icon
    
    return icons

#test to be impl
window_icons = get_open_window_icons()
for title, icon in window_icons.items():
    print(f"Window: {title}")
    icon.show()  # open icon in bitmap png
