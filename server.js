const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Config endpoint for client
  if (req.url === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hasGroqKey: !!process.env.GROQ_API_KEY
    }));
    return;
  }

  // Groq API Proxy
  if (req.url.startsWith('/api/groq')) {
    const groqPath = req.url.replace('/api/groq', '');
    let authHeader = req.headers.authorization;
    
    // If no header from client, or it's empty, try using server environment variable
    if ((!authHeader || authHeader === 'Bearer' || authHeader === 'Bearer null' || authHeader === 'Bearer undefined') && process.env.GROQ_API_KEY) {
      authHeader = `Bearer ${process.env.GROQ_API_KEY}`;
    }

    const options = {
      hostname: 'api.groq.com',
      path: groqPath,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
        'User-Agent': 'Mozilla/5.0'
      }
    };

    if (req.headers['content-length']) {
      options.headers['Content-Length'] = req.headers['content-length'];
    }

    const proxyReq = https.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      headers['access-control-allow-origin'] = '*';
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error("Groq Proxy Error:", e);
      res.writeHead(500);
      res.end('Groq Proxy Error');
    });

    req.pipe(proxyReq);
    return;
  }

  // API Proxy
  if (req.url.startsWith('/api/')) {
    const saavnPath = req.url.replace('/api', '');
    const options = {
      hostname: 'saavn-api.vercel.app',
      path: saavnPath,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      // Set permissive CORS on the proxied response too
      const headers = { ...proxyRes.headers };
      headers['access-control-allow-origin'] = '*';
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error(e);
      res.writeHead(500);
      res.end('Proxy Error');
    });

    proxyReq.end();
    return;
  }

  // Static files
  let filePath = '.' + req.url;
  if (filePath === './') filePath = './index.html';
  
  // Clean query string
  filePath = filePath.split('?')[0];

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
