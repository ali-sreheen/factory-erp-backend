@echo off
chcp 65001 > nul
echo ====================================================
echo   تشغيل سيرفر نظام إدارة المصنع (Factory ERP Backend)
echo ====================================================
echo.
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
pause
