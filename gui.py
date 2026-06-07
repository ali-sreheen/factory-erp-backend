import webview

def start_gui():
    # الرابط الخاص بالسيرفر السحابي
    cloud_url = "https://factory-erp-backend-wcs1.onrender.com"
    
    # Launch desktop window directly connected to the cloud
    webview.create_window(
        "مصنع فراس وطارق الجدع للابواب المعدنية - النسخة السحابية", 
        cloud_url, 
        width=1280, 
        height=850
    )
    webview.start()

if __name__ == "__main__":
    start_gui()
