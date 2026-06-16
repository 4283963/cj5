# Crypto Sentinel - 加密货币数据聚合平台

一套酷炫的加密货币链上数据聚合平台，专为加密货币持仓用户打造。

## 系统架构

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│   Python 数据清洗模块    │────▶│   ClickHouse 数据库     │────▶│   前端 3D 态势大屏      │
│  (Solana 链上分析)      │     │                         │     │  (React + Three.js)    │
│  (AI 风险评分模型)      │     └─────────────────────────┘     │  /dex/visual 路由      │
│                         │               ▲                     │  3D 粒子节点实时渲染   │
└─────────────────────────┘               │                     └─────────────────────────┘
                                          │
                                          ▼
                                ┌─────────────────────────┐
                                │   NestJS 数据接口层     │
                                │   (REST API + WS)       │
                                └─────────────────────────┘
```

## 三大核心模块

### 1. 数据清洗模块 (Python)
- 实时采集 Solana 链上大额交易流水
- **AI 多因子风险评分模型**，包括：
  - 交易模式分析（机器人模式、自动转账、异常大额等）
  - 黑名单关联检测（混币器、已知风险地址）
  - 交易量异常检测
  - 归集行为识别（资金集中、分散分发）
  - 交易对手网络分析
- 对风险地址打标签：`mixer_interaction`, `suspicious_gathering`, `bot_like_pattern` 等 11 种标签
- 写入 ClickHouse 数据库，支持实时分析

### 2. 全栈数据接口 (NestJS)
- 从 ClickHouse 提取安全标签和交易吞吐量数据
- **REST API** 提供历史数据查询
- **WebSockets** 实时广播数据到前端：
  - 风险节点实时更新
  - 交易吞吐量数据
  - 大额交易流水
  - 聚合统计数据

### 3. 前端 3D 态势大屏 (React + Three.js)
- `/dex/visual` 路由访问
- 每个风险地址渲染为**3D 粒子节点**：
  - **节点大小** 随 WebSocket 传来的交易量实时缩放
  - **节点颜色** 随 AI 风险评分实时抖动（高风险=红色, 中风险=黄色, 低风险=绿色）
  - **节点形状** 根据风险等级使用不同几何形状（二十面体、八面体、球体）
  - 发光效果、脉冲动画、旋转光环
- 节点间弧形连接线可视化交易关系
- 赛博朋克风格 HUD 界面

## 快速启动

### 方式一：一键启动所有服务
```bash
chmod +x start-all.sh
./start-all.sh
```

### 方式二：分别启动

#### 1. 启动 Python 数据清洗模块
```bash
cd python-analyzer
pip install -r requirements.txt
python main.py
```

#### 2. 启动 NestJS 后端接口
```bash
cd nestjs-api
npm install
npm run start:dev
```
- REST API: http://localhost:3001/api
- WebSocket: ws://localhost:3001/crypto-stream

#### 3. 启动前端 3D 态势大屏
```bash
cd frontend-dashboard
npm install
npm run dev
```
- 访问: http://localhost:5173/dex/visual

## API 接口列表

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/stats` | GET | 系统统计信息 |
| `/api/risk-addresses` | GET | 风险地址列表 (支持 min_score, level, limit 参数) |
| `/api/risk-addresses/high` | GET | 高/中风险地址 |
| `/api/address/:addr/risk` | GET | 单地址风险详情 |
| `/api/throughput` | GET | 吞吐量历史 (minutes 参数) |
| `/api/transactions/large` | GET | 大额交易列表 |

## WebSocket 事件

- `connected`: 连接成功
- `initial_snapshot`: 初始数据快照
- `realtime_update`: 实时数据更新（每 1.5 秒）
- `request_snapshot`: 客户端主动请求快照

## 技术栈

| 层级 | 技术 |
|------|------|
| **数据层** | Python 3.10+, scikit-learn, ClickHouse |
| **接口层** | NestJS 10, Socket.IO, TypeScript |
| **可视化** | React 18, Three.js, @react-three/fiber, Zustand, TailwindCSS |
| **通信** | WebSocket (Socket.IO), HTTP |

## 数据库表结构

### risk_addresses (风险地址表)
- ReplacingMergeTree 引擎，按地址去重
- 字段：address, risk_score, risk_level, risk_tags, total_transactions, total_volume, timestamps

### large_transactions (大额交易表)
- MergeTree 引擎，按月分区
- 字段：tx_hash, block_number, block_time, from_address, to_address, amount, token_mint, tx_type

### tx_throughput_mv (吞吐量物化视图)
- SummingMergeTree 引擎
- 按分钟聚合统计交易量

## 风险标签说明

| 标签 | 说明 |
|------|------|
| `known_mixer` | 已知混币器地址 |
| `known_exchange` | 已知交易所地址 |
| `mixer_interaction` | 与混币器有多次交互 |
| `mixer_touched` | 与混币器有过接触 |
| `suspicious_gathering` | 可疑资金归集 |
| `high_activity_cluster` | 高活跃度集群 |
| `bot_like_pattern` | 机器人交易模式 |
| `automated_transfers` | 自动转账模式 |
| `rapid_funding_cluster` | 快速集资集群 |
| `crowd_funding_pattern` | 众筹模式 |
| `concentration_hub` | 资金集中枢纽 |
| `distribution_hub` | 资金分发枢纽 |
| `irregular_large_txs` | 不规则大额交易 |
| `round_number_txs` | 整数金额交易 |
| `high_risk_neighborhood` | 高危邻居网络 |
| `risky_associates` | 关联风险地址 |
| `extreme_volume` | 极端交易量 |
| `high_avg_tx_value` | 高额平均交易 |
| `only_receiving_suspect` | 只进不出可疑 |

## 目录结构

```
cj5/
├── python-analyzer/          # 数据清洗模块
│   ├── main.py               # 主程序入口
│   ├── config.py             # 配置管理
│   ├── clickhouse_client.py  # ClickHouse 客户端
│   ├── risk_scoring_model.py # AI 风险评分模型
│   └── solana_collector.py   # Solana 数据采集器
├── nestjs-api/               # NestJS 后端接口
│   └── src/
│       ├── main.ts           # 服务入口
│       ├── app.module.ts     # 模块定义
│       ├── clickhouse/       # ClickHouse 服务
│       ├── gateway/          # WebSocket Gateway
│       └── controllers/      # REST 控制器
└── frontend-dashboard/       # 前端 3D 态势大屏
    └── src/
        ├── main.tsx          # 入口
        ├── App.tsx           # 路由
        ├── pages/            # 页面组件
        ├── components/
        │   ├── 3d/           # Three.js 3D 组件
        │   └── hud/          # HUD 界面组件
        ├── hooks/            # 自定义 Hooks
        ├── store/            # Zustand 状态管理
        ├── types/            # TypeScript 类型
        └── utils/            # 工具函数
```

## 操作说明

- **鼠标左键拖动**: 旋转 3D 视角
- **鼠标滚轮**: 缩放视图
- **鼠标右键拖动**: 平移视图
- **点击节点**: 查看节点详情（风险评分、标签、交易量等）
- **控制面板**: 可切换暂停/继续、风险等级过滤、节点大小缩放、显示/隐藏连接线和标签

## 特色功能

1. **AI 智能风险评分**：多因子加权评分模型，精准识别高风险地址
2. **实时 3D 可视化**：节点大小、颜色、形状、发光强度均与风险数据联动
3. **赛博朋克风格**：霓虹色调、扫描线效果、HUD 边角装饰、玻璃态面板
4. **全链路实时**：从链上数据到前端可视化，毫秒级延迟
5. **弹性架构**：支持接入真实 Solana RPC，或使用模拟数据快速演示
