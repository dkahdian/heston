@echo off

echo Building Heston model simulation...

where emcc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Emscripten not found. Please install Emscripten SDK.
    echo Visit: https://emscripten.org/docs/getting_started/downloads.html
    exit /b 1
)

emcc heston.c ^
    -o simulation.js ^
    -s WASM=1 ^
    -s EXPORTED_RUNTIME_METHODS="[\"ccall\", \"cwrap\", \"getValue\", \"setValue\"]" ^
    -s EXPORTED_FUNCTIONS="[\"_malloc\", \"_free\"]" ^
    -s ALLOW_MEMORY_GROWTH=1 ^
    -s MODULARIZE=1 ^
    -s EXPORT_NAME="HestonModule" ^
    -O3 ^
    -s SAFE_HEAP=0 ^
    -s ASSERTIONS=0 ^
    -s INITIAL_MEMORY=67108864

if %ERRORLEVEL% equ 0 (
    echo Build successful! Generated simulation.js and simulation.wasm
) else (
    echo Build failed!
    exit /b 1
)
