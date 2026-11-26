@echo off
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo 没有检测到 Python。
  echo 你可以：
  echo   1. 安装 Python 后重新运行本文件
  echo   2. 用 VS Code 打开本目录，右键 index.html - Open with Live Server
  echo   3. 直接推送到 GitHub Pages，不需要本地预览
  echo.
  pause
  exit /b 1
)

echo.
echo 本地预览地址：http://localhost:8000/
echo 浏览器会自动打开；关闭本窗口即停止服务。
echo.

start "" /b cmd /c "timeout /t 2 >nul && start http://localhost:8000/"
python -m http.server 8000
