// 全局变量
let currentUser = null;
let currentToken = null;
let currentSchema = null;
let currentSchemaName = null;
let currentPage = 1;
let totalPages = 1;
let editingId = null;

// API基础URL
const API_BASE_URL = '';

// 工具函数
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function removeToken() {
    localStorage.removeItem('token');
}

function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function removeUser() {
    localStorage.removeItem('user');
}

// 初始化应用
function initApp() {
    // 检查本地存储中的认证信息
    currentToken = getToken();
    currentUser = getUser();
    
    if (currentToken && currentUser) {
        showAuthenticatedUI();
        loadSchemas();
        loadSchemaSelect();
    } else {
        showUnauthenticatedUI();
    }
    
    // 绑定事件监听器
    bindEventListeners();
}

// 绑定事件监听器
function bindEventListeners() {
    // 认证按钮
    document.getElementById('loginBtn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('registerBtn').addEventListener('click', () => openAuthModal('register'));
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // 认证表单
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
    
    // Schema管理
    document.getElementById('addSchemaBtn').addEventListener('click', openSchemaModal);
    document.getElementById('schemaForm').addEventListener('submit', handleSchemaSubmit);
    
    // 数据管理
    document.getElementById('schemaSelect').addEventListener('change', handleSchemaChange);
    document.getElementById('addDataBtn').addEventListener('click', openAddDataForm);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
    document.getElementById('cancelBtn').addEventListener('click', closeDataForm);
    document.getElementById('dataForm').addEventListener('submit', handleDataSubmit);
    
    // 分页
    document.getElementById('prevPage').addEventListener('click', () => changePage(currentPage - 1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(currentPage + 1));
    
    // 模态框关闭
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });
}

// 认证相关函数
function openAuthModal(type) {
    const modal = document.getElementById('authModal');
    const modalTitle = document.getElementById('modalTitle');
    const nameField = document.getElementById('name').parentNode;
    
    modal.style.display = 'block';
    
    if (type === 'login') {
        modalTitle.textContent = '登录';
        nameField.style.display = 'none';
    } else {
        modalTitle.textContent = '注册';
        nameField.style.display = 'block';
    }
    
    // 重置表单
    document.getElementById('authForm').reset();
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const modalTitle = document.getElementById('modalTitle').textContent;
    const endpoint = modalTitle === '登录' ? '/auth/login' : '/auth/register';
    
    if (modalTitle === '登录') {
        delete data.name;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // 保存认证信息
            currentToken = result.token;
            currentUser = result.user;
            setToken(currentToken);
            setUser(currentUser);
            
            // 更新UI
            showAuthenticatedUI();
            loadSchemas();
            loadSchemaSelect();
            closeModal();
        } else {
            alert(result.error || '操作失败');
        }
    } catch (error) {
        console.error('认证失败:', error);
        alert('认证失败，请稍后重试');
    }
}

function logout() {
    currentUser = null;
    currentToken = null;
    removeUser();
    removeToken();
    showUnauthenticatedUI();
}

function showAuthenticatedUI() {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('registerBtn').style.display = 'none';
    document.getElementById('userInfo').style.display = 'inline-block';
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('schemaManager').style.display = 'block';
    document.getElementById('dataManager').style.display = 'block';
}

function showUnauthenticatedUI() {
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('registerBtn').style.display = 'inline-block';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('schemaManager').style.display = 'none';
    document.getElementById('dataManager').style.display = 'none';
}

// Schema管理相关函数
async function loadSchemas() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/schemas`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const schemas = await response.json();
            renderSchemaList(schemas);
        } else {
            console.error('加载Schema失败');
        }
    } catch (error) {
        console.error('加载Schema失败:', error);
    }
}

function renderSchemaList(schemas) {
    const schemaList = document.getElementById('schemaList');
    schemaList.innerHTML = '';
    
    schemas.forEach(schema => {
        const schemaItem = document.createElement('div');
        schemaItem.className = 'schema-item';
        
        const schemaObj = JSON.parse(schema.schema);
        
        schemaItem.innerHTML = `
            <h3>${schema.name}</h3>
            <div class="schema-meta">
                创建时间: ${new Date(schema.created_at).toLocaleString()}
            </div>
            <div class="schema-actions">
                <button class="btn btn-primary" onclick="viewSchema('${schema.name}')">查看</button>
            </div>
        `;
        
        schemaList.appendChild(schemaItem);
    });
}

function viewSchema(schemaName) {
    // 切换到数据管理视图
    document.getElementById('schemaSelect').value = schemaName;
    handleSchemaChange({ target: { value: schemaName } });
}

function openSchemaModal() {
    const modal = document.getElementById('schemaModal');
    modal.style.display = 'block';
    document.getElementById('schemaForm').reset();
}

async function handleSchemaSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        // 验证JSON格式
        JSON.parse(data.schema);
        
        const response = await fetch(`${API_BASE_URL}/admin/schemas`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            closeModal();
            loadSchemas();
            loadSchemaSelect();
            alert('Schema添加成功');
        } else {
            alert(result.error || '添加失败');
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
            alert('JSON格式错误');
        } else {
            console.error('添加Schema失败:', error);
            alert('添加失败，请稍后重试');
        }
    }
}

async function loadSchemaSelect() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/schemas`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const schemas = await response.json();
            const select = document.getElementById('schemaSelect');
            select.innerHTML = '<option value="">请选择Schema</option>';
            
            schemas.forEach(schema => {
                const option = document.createElement('option');
                option.value = schema.name;
                option.textContent = schema.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('加载Schema选择列表失败:', error);
    }
}

// 数据管理相关函数
async function handleSchemaChange(e) {
    const schemaName = e.target.value;
    if (!schemaName) {
        return;
    }
    
    currentSchemaName = schemaName;
    currentPage = 1;
    
    try {
        // 获取Schema详情
        const response = await fetch(`${API_BASE_URL}/admin/schemas/${schemaName}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const schemaResult = await response.json();
            currentSchema = JSON.parse(schemaResult.schema);
            loadData();
        }
    } catch (error) {
        console.error('获取Schema详情失败:', error);
    }
}

async function loadData() {
    if (!currentSchemaName || !currentSchema) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/${currentSchemaName}?page=${currentPage}&limit=10`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            renderDataTable(result.data);
            updatePagination(result.pagination);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

function renderDataTable(data) {
    const headers = document.getElementById('tableHeaders');
    const body = document.getElementById('tableBody');
    
    // 清空表格
    headers.innerHTML = '';
    body.innerHTML = '';
    
    if (!currentSchema) {
        return;
    }
    
    // 生成表头
    const properties = Object.keys(currentSchema.properties);
    properties.forEach(prop => {
        const th = document.createElement('th');
        th.textContent = prop;
        headers.appendChild(th);
    });
    
    // 添加操作列
    const actionTh = document.createElement('th');
    actionTh.textContent = '操作';
    headers.appendChild(actionTh);
    
    // 生成数据行
    data.forEach(item => {
        const tr = document.createElement('tr');
        
        properties.forEach(prop => {
            const td = document.createElement('td');
            td.textContent = item[prop] || '';
            tr.appendChild(td);
        });
        
        // 添加操作按钮
        const actionTd = document.createElement('td');
        actionTd.innerHTML = `
            <div class="action-buttons">
                <button class="btn btn-primary" onclick="editData(${item.id})">编辑</button>
                <button class="btn btn-danger" onclick="deleteData(${item.id})">删除</button>
            </div>
        `;
        tr.appendChild(actionTd);
        
        body.appendChild(tr);
    });
}

function updatePagination(pagination) {
    currentPage = pagination.page;
    totalPages = pagination.pages;
    
    document.getElementById('pageInfo').textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

function changePage(page) {
    if (page < 1 || page > totalPages) {
        return;
    }
    
    currentPage = page;
    loadData();
}

function openAddDataForm() {
    if (!currentSchema) {
        alert('请先选择Schema');
        return;
    }
    
    editingId = null;
    document.getElementById('formTitle').textContent = '添加数据';
    generateDynamicForm();
    document.getElementById('dynamicForm').style.display = 'block';
}

function editData(id) {
    editingId = id;
    document.getElementById('formTitle').textContent = '编辑数据';
    generateDynamicForm();
    document.getElementById('dynamicForm').style.display = 'block';
    
    // 加载数据
    loadDataForEdit(id);
}

async function loadDataForEdit(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/${currentSchemaName}/${id}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // 填充表单数据
            Object.keys(data).forEach(key => {
                const input = document.getElementById(`field_${key}`);
                if (input) {
                    input.value = data[key];
                }
            });
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

function generateDynamicForm() {
    const form = document.getElementById('dataForm');
    form.innerHTML = '';
    
    if (!currentSchema) {
        return;
    }
    
    const properties = currentSchema.properties;
    
    for (const [key, prop] of Object.entries(properties)) {
        // 跳过id、created_at、updated_at字段
        if (['id', 'created_at', 'updated_at'].includes(key)) {
            continue;
        }
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.htmlFor = `field_${key}`;
        label.textContent = key;
        
        let input;
        
        // 根据Schema类型生成不同的表单控件
        if (prop.widget === 'select' || prop.enum) {
            // 下拉选择框
            input = document.createElement('select');
            input.id = `field_${key}`;
            input.name = key;
            
            const options = prop.enum || [];
            const optionNames = prop.enumNames || options;
            
            options.forEach((option, index) => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = optionNames[index];
                input.appendChild(opt);
            });
        } else if (prop.widget === 'textarea' || (prop.type === 'string' && prop.maxLength > 200)) {
            // 多行文本框
            input = document.createElement('textarea');
            input.id = `field_${key}`;
            input.name = key;
            input.rows = 4;
        } else if (prop.widget === 'checkbox' || prop.type === 'boolean') {
            // 复选框
            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `field_${key}`;
            input.name = key;
        } else if (prop.widget === 'date' || (prop.format && prop.format.includes('date'))) {
            // 日期选择器
            input = document.createElement('input');
            input.type = 'date';
            input.id = `field_${key}`;
            input.name = key;
        } else if (prop.widget === 'time' || (prop.format && prop.format.includes('time'))) {
            // 时间选择器
            input = document.createElement('input');
            input.type = 'time';
            input.id = `field_${key}`;
            input.name = key;
        } else if (prop.widget === 'datetime' || (prop.format && prop.format.includes('datetime'))) {
            // 日期时间选择器
            input = document.createElement('input');
            input.type = 'datetime-local';
            input.id = `field_${key}`;
            input.name = key;
        } else if (prop.type === 'number' || prop.type === 'integer') {
            // 数值输入框
            input = document.createElement('input');
            input.type = 'number';
            input.id = `field_${key}`;
            input.name = key;
            
            if (prop.minimum !== undefined) {
                input.min = prop.minimum;
            }
            if (prop.maximum !== undefined) {
                input.max = prop.maximum;
            }
        } else {
            // 默认文本输入框
            input = document.createElement('input');
            input.type = 'text';
            input.id = `field_${key}`;
            input.name = key;
        }
        
        // 设置必填属性
        if (currentSchema.required && currentSchema.required.includes(key)) {
            input.required = true;
        }
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        form.appendChild(formGroup);
    }
}

function closeDataForm() {
    document.getElementById('dynamicForm').style.display = 'none';
    document.getElementById('dataForm').reset();
    editingId = null;
}

async function handleDataSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // 处理布尔值
    Object.keys(data).forEach(key => {
        if (data[key] === 'on') {
            data[key] = true;
        } else if (data[key] === '') {
            data[key] = null;
        } else if (!isNaN(data[key]) && data[key] !== '') {
            data[key] = parseFloat(data[key]);
        }
    });
    
    try {
        let response;
        
        if (editingId) {
            // 更新数据
            response = await fetch(`${API_BASE_URL}/api/${currentSchemaName}/${editingId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else {
            // 创建数据
            response = await fetch(`${API_BASE_URL}/api/${currentSchemaName}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }
        
        if (response.ok) {
            closeDataForm();
            loadData();
            alert(editingId ? '更新成功' : '添加成功');
        } else {
            const result = await response.json();
            alert(result.error || '操作失败');
        }
    } catch (error) {
        console.error('操作失败:', error);
        alert('操作失败，请稍后重试');
    }
}

async function deleteData(id) {
    if (!confirm('确定要删除这条数据吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/${currentSchemaName}/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            loadData();
            alert('删除成功');
        } else {
            const result = await response.json();
            alert(result.error || '删除失败');
        }
    } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败，请稍后重试');
    }
}

async function exportCSV() {
    if (!currentSchemaName) {
        alert('请先选择Schema');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/${currentSchemaName}/export`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentSchemaName}_export.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } else {
            const result = await response.json();
            alert(result.error || '导出失败');
        }
    } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败，请稍后重试');
    }
}

// 模态框相关函数
function closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// 示例Schema（用于测试）
const exampleSchema = {
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
};

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', initApp);
