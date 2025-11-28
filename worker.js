// Cloudflare Worker环境中直接可用crypto模块

// 生成JWT令牌
function generateJWT(userId, email, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: userId,
    email: email,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24小时过期
  };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const encoder = new TextEncoder();
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signature = btoa(String.fromCharCode(...signatureArray));
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// 验证JWT令牌
async function verifyJWT(token, secret) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const expectedSignatureBuffer = await crypto.subtle.sign('HMAC', key, data);
    const expectedSignatureArray = Array.from(new Uint8Array(expectedSignatureBuffer));
    const expectedSignature = btoa(String.fromCharCode(...expectedSignatureArray));
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const payload = JSON.parse(atob(encodedPayload));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

// 生成密码哈希
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return btoa(String.fromCharCode(...hashArray));
}

// 验证密码
async function verifyPassword(password, hash) {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;

// 从JSON Schema生成SQL CREATE TABLE语句
function generateCreateTableSQL(tableName, schema) {
  const properties = schema.properties;
  const required = schema.required || [];
  
  let columns = [
    'id INTEGER PRIMARY KEY AUTOINCREMENT',
    'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  ];
  
  for (const [key, prop] of Object.entries(properties)) {
    if (key === 'id' || key === 'created_at' || key === 'updated_at') {
      continue;
    }
    
    let sqlType = 'TEXT';
    let constraints = [];
    
    if (required.includes(key)) {
      constraints.push('NOT NULL');
    }
    
    switch (prop.type) {
      case 'integer':
        sqlType = 'INTEGER';
        break;
      case 'number':
        sqlType = 'REAL';
        break;
      case 'boolean':
        sqlType = 'INTEGER'; // SQLite使用INTEGER存储布尔值
        break;
      case 'string':
        sqlType = 'TEXT';
        break;
    }
    
    columns.push(`${key} ${sqlType} ${constraints.join(' ')}`);
  }
  
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;
}

// 解析请求体
async function parseRequestBody(request) {
  try {
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await request.json();
    }
    return null;
  } catch (error) {
    return null;
  }
}

// 生成CSV内容
function generateCSV(data, schema) {
  const properties = Object.keys(schema.properties);
  const headers = properties.join(',');
  
  const rows = data.map(item => {
    return properties.map(prop => {
      const value = item[prop];
      if (value === null || value === undefined) {
        return '';
      }
      // 处理包含逗号或引号的值
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
}

// 主Worker函数
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // 认证API
    if (path.startsWith('/auth/')) {
      if (path === '/auth/register' && method === 'POST') {
        // 用户注册
        const body = await parseRequestBody(request);
        if (!body || !body.email || !body.password || !body.name) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        
        try {
          const passwordHash = await hashPassword(body.password);
          const result = await env.DB.prepare(
            'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
          ).bind(body.email, passwordHash, body.name).run();
          
          const token = await generateJWT(result.meta.last_row_id, body.email, env.JWT_SECRET);
          return new Response(JSON.stringify({ token, user: { id: result.meta.last_row_id, email: body.email, name: body.name } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          if (error.message.includes('UNIQUE constraint failed')) {
            return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ error: 'Registration failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }
      
      if (path === '/auth/login' && method === 'POST') {
        // 用户登录
        const body = await parseRequestBody(request);
        if (!body || !body.email || !body.password) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        
        try {
          const user = await env.DB.prepare(
            'SELECT id, email, password_hash, name FROM users WHERE email = ?'
          ).bind(body.email).first();
          
          if (!user || !(await verifyPassword(body.password, user.password_hash))) {
            return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
          }
          
          const token = await generateJWT(user.id, user.email, env.JWT_SECRET);
          return new Response(JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Login failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }
      
      if (path === '/auth/me' && method === 'GET') {
        // 获取当前用户信息
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const payload = await verifyJWT(token, env.JWT_SECRET);
        if (!payload) {
          return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        
        try {
          const user = await env.DB.prepare(
            'SELECT id, email, name, created_at FROM users WHERE id = ?'
          ).bind(payload.sub).first();
          
          if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          
          return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to get user info' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }
      
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    
    // 管理API - 需要认证
    if (path.startsWith('/admin/')) {
      // 验证JWT
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token, env.JWT_SECRET);
      if (!payload) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      
      const tenantId = payload.sub;
      
      // Schema管理API
      if (path.startsWith('/admin/schemas')) {
        if (path === '/admin/schemas' && method === 'GET') {
          // 获取当前租户的所有Schema
          try {
            const schemas = await env.DB.prepare(
              'SELECT id, name, schema, created_at, updated_at FROM schema_registry WHERE tenant_id = ?'
            ).bind(tenantId).all();
            
            return new Response(JSON.stringify(schemas.results), { status: 200, headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            return new Response(JSON.stringify({ error: 'Failed to get schemas' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
        
        if (path === '/admin/schemas' && method === 'POST') {
          // 上传新Schema
          const body = await parseRequestBody(request);
          if (!body || !body.name || !body.schema) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          
          try {
            // 验证Schema格式
            const schemaObj = JSON.parse(body.schema);
            if (!schemaObj.type || schemaObj.type !== 'object') {
              return new Response(JSON.stringify({ error: 'Schema must be an object type' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            
            // 存储Schema
            const result = await env.DB.prepare(
              'INSERT INTO schema_registry (tenant_id, name, schema) VALUES (?, ?, ?)'
            ).bind(tenantId, body.name, body.schema).run();
            
            // 自动创建数据库表
            const tableName = `${tenantId}_${body.name}`;
            const createTableSQL = generateCreateTableSQL(tableName, schemaObj);
            await env.DB.exec(createTableSQL);
            
            return new Response(JSON.stringify({ id: result.meta.last_row_id, name: body.name, schema: body.schema }), { status: 201, headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
              return new Response(JSON.stringify({ error: 'Schema name already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
            }
            if (error instanceof SyntaxError) {
              return new Response(JSON.stringify({ error: 'Invalid JSON schema' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify({ error: 'Failed to create schema' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
        
        // 获取、更新、删除Schema的逻辑
        const schemaName = path.split('/')[3];
        if (path === `/admin/schemas/${schemaName}` && method === 'GET') {
          // 获取指定Schema
          try {
            const schema = await env.DB.prepare(
              'SELECT id, name, schema, created_at, updated_at FROM schema_registry WHERE tenant_id = ? AND name = ?'
            ).bind(tenantId, schemaName).first();
            
            if (!schema) {
              return new Response(JSON.stringify({ error: 'Schema not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
            }
            
            return new Response(JSON.stringify(schema), { status: 200, headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            return new Response(JSON.stringify({ error: 'Failed to get schema' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
      
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    
    // 动态API - 需要认证
    if (path.startsWith('/api/')) {
      // 验证JWT
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      
      const token = authHeader.replace('Bearer ', '');
      const payload = verifyJWT(token, env.JWT_SECRET);
      if (!payload) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      
      const tenantId = payload.sub;
      const pathParts = path.split('/');
      const schemaName = pathParts[2];
      const id = pathParts[3];
      const action = pathParts[3] === 'export' ? 'export' : null;
      
      // 获取Schema
      try {
        const schemaResult = await env.DB.prepare(
          'SELECT schema FROM schema_registry WHERE tenant_id = ? AND name = ?'
        ).bind(tenantId, schemaName).first();
        
        if (!schemaResult) {
          return new Response(JSON.stringify({ error: 'Schema not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        
        const schema = JSON.parse(schemaResult.schema);
        const tableName = `${tenantId}_${schemaName}`;
        
        if (action === 'export' && method === 'GET') {
          // CSV导出
          try {
            const data = await env.DB.prepare(`SELECT * FROM ${tableName}`).all();
            const csvContent = generateCSV(data.results, schema);
            
            return new Response(csvContent, {
              status: 200,
              headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${schemaName}_export.csv"`
              }
            });
          } catch (error) {
            return new Response(JSON.stringify({ error: 'Failed to export CSV' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
        
        if (!id && method === 'GET') {
          // 分页查询数据
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '10');
          const offset = (page - 1) * limit;
          
          try {
            const totalResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM ${tableName}`).first();
            const data = await env.DB.prepare(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`)
              .bind(limit, offset).all();
            
            return new Response(JSON.stringify({
              data: data.results,
              pagination: {
                page: page,
                limit: limit,
                total: totalResult.total,
                pages: Math.ceil(totalResult.total / limit)
              }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            return new Response(JSON.stringify({ error: 'Failed to get data' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
        
        if (!id && method === 'POST') {
          // 创建数据
          const body = await parseRequestBody(request);
          if (!body) {
            return new Response(JSON.stringify({ error: 'Missing request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          
          try {
            const columns = Object.keys(body);
            const values = Object.values(body);
            const placeholders = columns.map(() => '?').join(', ');
            
            const result = await env.DB.prepare(
              `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
            ).bind(...values).run();
            
            const newItem = await env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
              .bind(result.meta.last_row_id).first();
            
            return new Response(JSON.stringify(newItem), { status: 201, headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            return new Response(JSON.stringify({ error: 'Failed to create data' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
        
        if (id && !isNaN(parseInt(id))) {
          // 获取单条数据
          if (method === 'GET') {
            try {
              const item = await env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
                .bind(parseInt(id)).first();
              
              if (!item) {
                return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
              }
              
              return new Response(JSON.stringify(item), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch (error) {
              return new Response(JSON.stringify({ error: 'Failed to get item' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
          }
          
          // 更新数据
          if (method === 'PUT') {
            const body = await parseRequestBody(request);
            if (!body) {
              return new Response(JSON.stringify({ error: 'Missing request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            
            try {
              const updates = Object.entries(body).map(([key, value]) => `${key} = ?`).join(', ');
              const values = [...Object.values(body), parseInt(id)];
              
              await env.DB.prepare(
                `UPDATE ${tableName} SET ${updates} WHERE id = ?`
              ).bind(...values).run();
              
              const updatedItem = await env.DB.prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
                .bind(parseInt(id)).first();
              
              return new Response(JSON.stringify(updatedItem), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch (error) {
              return new Response(JSON.stringify({ error: 'Failed to update item' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
          }
          
          // 删除数据
          if (method === 'DELETE') {
            try {
              await env.DB.prepare(`DELETE FROM ${tableName} WHERE id = ?`)
                .bind(parseInt(id)).run();
              
              return new Response(JSON.stringify({ message: 'Item deleted successfully' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } catch (error) {
              return new Response(JSON.stringify({ error: 'Failed to delete item' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
          }
        }
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to process request' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
    
    // 静态文件服务
    if (path === '/') {
      return new Response('Dynamic Schema API Server is running', { status: 200 });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
};
