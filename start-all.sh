#!/bin/bash

set -e

echo "=========================================="
echo "🚀 Crypto Sentinel - 一键启动脚本"
echo "=========================================="

cleanup() {
    echo ""
    echo "🛑 正在停止所有服务..."
    kill $PYTHON_PID 2>/dev/null || true
    kill $NEST_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    wait $PYTHON_PID 2>/dev/null || true
    wait $NEST_PID 2>/dev/null || true
    wait $FRONTEND_PID 2>/dev/null || true
    echo "✅ 所有服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "📁 项目目录: $BASE_DIR"
echo ""

echo "=========================================="
echo "[1/3] 启动 Python 数据清洗模块..."
echo "=========================================="
cd "$BASE_DIR/python-analyzer"
if [ ! -d "venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
python main.py &
PYTHON_PID=$!
echo "   ✅ Python 模块已启动 (PID: $PYTHON_PID)"
cd "$BASE_DIR"

sleep 3

echo ""
echo "=========================================="
echo "[2/3] 启动 NestJS 后端接口..."
echo "=========================================="
cd "$BASE_DIR/nestjs-api"
if [ ! -d "node_modules" ]; then
    echo "安装 npm 依赖..."
    npm install --silent
fi
npm run start:dev > nestjs.log 2>&1 &
NEST_PID=$!
echo "   ✅ NestJS 接口已启动 (PID: $NEST_PID)"
echo "   📡 REST API: http://localhost:3001/api"
echo "   🔌 WebSocket: ws://localhost:3001/crypto-stream"
cd "$BASE_DIR"

sleep 5

echo ""
echo "=========================================="
echo "[3/3] 启动前端 3D 态势大屏..."
echo "=========================================="
cd "$BASE_DIR/frontend-dashboard"
if [ ! -d "node_modules" ]; then
    echo "安装 npm 依赖..."
    npm install --silent
fi
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   ✅ 前端已启动 (PID: $FRONTEND_PID)"
echo "   🌐 访问地址: http://localhost:5173/dex/visual"
cd "$BASE_DIR"

echo ""
echo "=========================================="
echo "🎉 所有服务启动完成！"
echo "=========================================="
echo ""
echo "📊 服务列表："
echo "   🐍 Python 数据清洗      (PID: $PYTHON_PID)"
echo "   🔷 NestJS 后端接口      (PID: $NEST_PID)"
echo "   ⚛️   React 前端大屏      (PID: $FRONTEND_PID)"
echo ""
echo "🌐 快速访问："
echo "   3D 态势大屏: http://localhost:5173/dex/visual"
echo "   API 文档:   http://localhost:3001/api/stats"
echo ""
echo "⏹  按 Ctrl+C 停止所有服务"
echo "=========================================="
echo ""

wait
