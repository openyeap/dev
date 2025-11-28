# Cloudflare Worker + D1动态Schema表单系统（支持多种控件类型）

## 项目目标
实现支持多种表单控件类型的动态Schema表单系统，包括输入框、下拉框、日期、时间、数值等，后端自动处理并存储数据。

## 核心功能
1. 支持多种表单控件类型的JSON Schema扩展
2. 前端动态表单生成
3. 用户认证和租户隔离
4. 动态API端点生成
5. 自动数据库表创建
6. 通用CRUD操作
7. 分页查询和CSV导出

## 实现步骤

### 1. 扩展JSON Schema支持多种控件类型
- 定义表单控件类型扩展（widget关键字）
- 支持输入框、下拉框、日期、时间、数值等
- 定义控件属性（如选项列表、最小值、最大值等）

### 2. 实现用户认证系统
- 用户注册、登录
- JWT令牌验证
- 租户隔离

### 3. 设计Schema存储机制
- 创建schema_registry表，支持租户隔离
- 实现Schema验证和存储

### 4. 开发表自动生成
- 支持多种数据类型映射
- 实现CREATE TABLE语句生成

### 5. 实现动态API路由
- /api/{schema_name} - 动态CRUD端点
- /api/{schema_name}/export - CSV导出
- /admin/schemas - Schema管理

### 6. 开发前端动态表单生成
- 解析JSON Schema中的widget类型
- 生成相应的表单控件
- 实现表单验证
- 支持数据提交和编辑

### 7. 实现通用CRUD逻辑
- 动态生成SQL查询
- 基于Schema验证请求数据
- 实现分页查询
- 实现CSV导出

### 8. 配置和部署
- 创建wrangler.toml
- 配置D1数据库
- 部署到Cloudflare

## 技术实现

### 扩展JSON Schema示例
```json
{
  "$id": "product",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "widget": "text",
      "title": "产品名称",
      "description": "请输入产品名称"
    },
    "category": {
      "type": "string",
      "widget": "select",
      "title": "产品分类",
      "enum": ["electronics", "clothing", "books"],
      "enumNames": ["电子产品", "服装", "书籍"]
    },
    "price": {
      "type": "number",
      "widget": "number",
      "title": "产品价格",
      "minimum": 0,
      "maximum": 10000
    },
    "release_date": {
      "type": "string",
      "widget": "date",
      "title": "发布日期",
      "format": "date"
    },
    "available": {
      "type": "boolean",
      "widget": "checkbox",
      "title": "是否可用"
    },
    "description": {
      "type": "string",
      "widget": "textarea",
      "title": "产品描述"
    }
  },
  "required": ["name", "category", "price"]
}
```

### 数据库设计

#### users表
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### schema_registry表
```sql
CREATE TABLE IF NOT EXISTS schema_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  schema TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 前端表单生成

#### 支持的控件类型
- text - 文本输入框
- textarea - 多行文本框
- number - 数值输入框
- select - 下拉选择框
- checkbox - 复选框
- radio - 单选按钮组
- date - 日期选择器
- time - 时间选择器
- datetime - 日期时间选择器
- file - 文件上传

#### 表单生成逻辑
1. 解析JSON Schema
2. 提取widget类型
3. 根据类型生成相应的HTML控件
4. 应用验证规则
5. 处理表单提交

### API设计

#### 认证API
```
POST /auth/register          # 用户注册
POST /auth/login             # 用户登录
GET  /auth/me                # 获取当前用户信息
```

#### Schema管理API
```
GET    /admin/schemas          # 获取Schema列表
POST   /admin/schemas          # 上传Schema
GET    /admin/schemas/:name    # 获取Schema详情
PUT    /admin/schemas/:name    # 更新Schema
DELETE /admin/schemas/:name    # 删除Schema
```

#### 动态数据API
```
GET    /api/:schema_name          # 获取数据列表
POST   /api/:schema_name          # 创建数据
GET    /api/:schema_name/:id      # 获取单条数据
PUT    /api/:schema_name/:id      # 更新数据
DELETE /api/:schema_name/:id      # 删除数据
GET    /api/:schema_name/export   # 导出CSV
```

## 预期文件结构
```
├── worker.js          # Cloudflare Worker主文件
├── wrangler.toml      # Wrangler配置文件
├── src/
│   ├── auth.js        # 用户认证
│   ├── schema.js      # Schema处理
│   ├── db.js          # 数据库操作
│   ├── api.js         # API路由
│   ├── csv.js         # CSV导出
│   └── validator.js   # 数据验证
├── public/
│   ├── index.html     # 主页面
│   ├── styles.css     # 样式文件
│   └── script.js      # 前端逻辑
└── migrations/
    └── 0000_init.sql  # 初始化数据库表
```

## 技术栈
- Cloudflare Worker
- D1数据库
- JSON Schema
- JWT
- 前端动态表单生成库
- Wrangler CLI

## 实现关键点

### 1. Schema扩展
- 使用JSON Schema的"widget"关键字扩展控件类型
- 支持enum和enumNames定义下拉选项
- 支持min/max等验证规则

### 2. 前端动态表单
- 基于Schema自动生成表单
- 支持各种控件类型
- 实现实时表单验证
- 支持数据编辑和提交

### 3. 后端处理
- 解析扩展Schema
- 自动生成数据库表
- 验证请求数据
- 实现CRUD操作

### 4. 租户隔离
- 每个用户独立的数据空间
- JWT令牌验证
- 数据访问权限控制

## 测试和部署
1. 本地测试：使用wrangler dev
2. 数据库迁移：wrangler d1 migrations apply
3. 部署：wrangler deploy