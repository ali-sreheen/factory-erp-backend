import sys
import os
import threading
import socket
import uvicorn
import webview
import time

def find_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('0.0.0.0', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def start_backend(port):
    # Import main FastAPI app
    from main import app
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")

if __name__ == "__main__":
    # Check if default port 8000 is available, otherwise get a free one
    port = 8000
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(('0.0.0.0', port))
        s.close()
    except OSError:
        port = find_free_port()

    # Start FastAPI in a background thread
    t = threading.Thread(target=start_backend, args=(port,))
    t.daemon = True
    t.start()

    # Wait a moment for server initialization
    time.sleep(1)

    # Launch desktop window
    webview.create_window(
        "مصنع فراس وطارق الجدع للابواب المعدنية", 
        f"http://127.0.0.1:{port}", 
        width=1280, 
        height=850
    )
    webview.start()
