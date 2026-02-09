# DanJacky 協作記帳本 (Collaborative Accounting)

[English](#english) | [中文](#traditional-chinese)

---

<a name="english"></a>
## 🇬🇧 English

### Introduction
DanJacky Collaborative Accounting is a serverless web application designed for tracking shared expenses. It helps users manage monthly budgets, visualize spending categories, and collaborate on financial tracking.

### Features
*   **Budget Tracking**: Visual progress bar for monthly budget monitoring.
*   **Expense Visualization**: Interactive doughnut chart breaking down expenses by category.
*   **Multi-user Support**: Tag records by member (e.g., Daniel, Jacky).
*   **Settlement**: Automatically calculate balances and who owes whom.
*   **Responsive Design**: Built with Tailwind CSS and Glassmorphism UI.
*   **Serverless Architecture**: Powered by Cloudflare Pages and Functions.
*   **Database**: Uses Cloudflare D1 (SQLite) for persistent data storage.
*   **Security**: Designed to work behind Cloudflare Zero Trust / Access for authentication.

### Tech Stack
*   **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS, Chart.js.
*   **Backend**: Cloudflare Pages Functions.
*   **Database**: Cloudflare D1.

### Setup & Deployment

#### Prerequisites
*   Node.js and npm
*   Cloudflare Wrangler CLI installed globally (`npm install -g wrangler`)

#### 1. Clone the repository
```bash
git clone <repository-url>
cd <repository-directory>
npm install
```

#### 2. D1 Database Setup
This project uses a D1 database named `monthly_expenses`.

Create the database:
```bash
npx wrangler d1 create monthly_expenses
```

Update your `wrangler.jsonc` with the `database_id` returned by the creation command.

Initialize the database schema:
```bash
npx wrangler d1 execute monthly_expenses --file=migrations/schema.sql
```

#### 3. Local Development
To run the application locally, use the following command to start the Pages development server with the D1 binding:

```bash
npx wrangler pages dev . --d1 DB=monthly_expenses
```

#### 4. Deployment
Deploy to Cloudflare Pages:

```bash
npx wrangler pages deploy .
```

---

<a name="traditional-chinese"></a>
## 🇹🇼 Traditional Chinese (繁體中文)

### 簡介
DanJacky 協作記帳本是一款專為共同管理開支設計的無伺服器網頁應用程式。它能幫助使用者追蹤每月預算、視覺化消費類別，並進行協作記帳。

### 功能特色
*   **預算追蹤**：提供視覺化的每月預算進度條，隨時掌握開支狀況。
*   **支出分析**：透過互動式甜甜圈圖表，清晰呈現各類別支出佔比。
*   **多人協作**：支援標記成員（如：Daniel, Jacky），方便區分帳目。
*   **自動分帳**：自動計算每人應付金額與餘額。
*   **響應式設計**：使用 Tailwind CSS 與毛玻璃風格 (Glassmorphism)，完美適配手機與電腦版面。
*   **無伺服器架構**：基於 Cloudflare Pages 與 Functions 構建，輕量且高效。
*   **資料庫**：使用 Cloudflare D1 (SQLite) 儲存資料。
*   **安全性**：設計為配合 Cloudflare Zero Trust / Access 進行身份驗證。

### 技術棧
*   **前端**：HTML5, 原生 JavaScript, Tailwind CSS, Chart.js。
*   **後端**：Cloudflare Pages Functions。
*   **資料庫**：Cloudflare D1。

### 安裝與部署

#### 事前準備
*   Node.js 與 npm
*   已安裝 Cloudflare Wrangler CLI (`npm install -g wrangler`)

#### 1. 下載專案
```bash
git clone <repository-url>
cd <repository-directory>
npm install
```

#### 2. 設定 D1 資料庫
本專案使用名為 `monthly_expenses` 的 D1 資料庫。

建立資料庫：
```bash
npx wrangler d1 create monthly_expenses
```

建立後，請將回傳的 `database_id` 更新至您的 `wrangler.jsonc` 檔案中。

初始化資料庫結構：
```bash
npx wrangler d1 execute monthly_expenses --file=migrations/schema.sql
```

#### 3. 本地開發
使用以下指令在本地啟動開發伺服器（包含 D1 資料庫綁定）：

```bash
npx wrangler pages dev . --d1 DB=monthly_expenses
```

#### 4. 部署
部署至 Cloudflare Pages：

```bash
npx wrangler pages deploy .
```
