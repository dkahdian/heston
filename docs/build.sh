#!/bin/bash

# Build script for compiling C to WebAssembly using Emscripten

echo "Building Heston model simulation..."

# Check if emscripten is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten not found. Please install Emscripten SDK."
    echo "Visit: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

# Compile C to WebAssembly
emcc heston.c \
    -o simulation.js \
    -s WASM=1 \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="HestonModule" \
    -O3 \
    -s SAFE_HEAP=0 \
    -s ASSERTIONS=0

if [ $? -eq 0 ]; then
    echo "Build successful! Generated simulation.js and simulation.wasm"
else
    echo "Build failed!"
    exit 1
fi
