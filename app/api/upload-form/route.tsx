import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // 返回一个HTML表单页面用于测试上传
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>文件上传测试</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #333;
          }
          .form-group {
            margin-bottom: 15px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
          }
          button {
            background: #4285f4;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
          }
          .result {
            margin-top: 20px;
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 4px;
            background: #f8f8f8;
            white-space: pre-wrap;
            font-family: monospace;
          }
          .success {
            color: green;
            font-weight: bold;
          }
          .error {
            color: red;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <h1>文件上传测试</h1>
        
        <div class="form-group">
          <label for="file">选择文件：</label>
          <input type="file" id="file" accept="*/*">
        </div>
        
        <button id="uploadButton">上传文件</button>
        <button id="testUploadButton">测试上传API</button>
        <button id="testR2Button">测试R2连接</button>
        
        <div id="result" class="result" style="display: none;"></div>
        
        <script>
          // 上传文件到代理API
          document.getElementById('uploadButton').addEventListener('click', async () => {
            const fileInput = document.getElementById('file');
            const resultDiv = document.getElementById('result');
            resultDiv.style.display = 'block';
            
            if (!fileInput.files || fileInput.files.length === 0) {
              resultDiv.innerHTML = '<span class="error">请先选择文件</span>';
              return;
            }
            
            const file = fileInput.files[0];
            resultDiv.innerHTML = \`开始上传文件: \${file.name} (\${file.size} 字节, \${file.type})\`;
            
            try {
              // 创建FormData对象
              const formData = new FormData();
              formData.append('file', file);
              
              // 显示上传进度
              const startTime = Date.now();
              
              // 发送上传请求
              const response = await fetch('/api/proxy-upload-to-r2', {
                method: 'POST',
                body: formData
              });
              
              const duration = Date.now() - startTime;
              
              // 处理响应
              if (response.ok) {
                const data = await response.json();
                resultDiv.innerHTML = \`
                  <span class="success">上传成功!</span>
                  <br>耗时: \${duration}ms
                  <br>文件URL: \${data.fileUrl || '未返回URL'}
                  <br>
                  <pre>\${JSON.stringify(data, null, 2)}</pre>
                \`;
              } else {
                const errorText = await response.text();
                resultDiv.innerHTML = \`
                  <span class="error">上传失败! 状态码: \${response.status}</span>
                  <br>耗时: \${duration}ms
                  <br>错误: \${errorText}
                \`;
              }
            } catch (error) {
              resultDiv.innerHTML = \`
                <span class="error">上传过程中出错:</span>
                <br>\${error.message || String(error)}
              \`;
            }
          });
          
          // 测试上传API
          document.getElementById('testUploadButton').addEventListener('click', async () => {
            const resultDiv = document.getElementById('result');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '正在测试上传API...';
            
            try {
              const response = await fetch('/api/upload-test');
              
              if (response.ok) {
                const data = await response.json();
                resultDiv.innerHTML = \`
                  <span class="success">API测试完成!</span>
                  <br>
                  <pre>\${JSON.stringify(data, null, 2)}</pre>
                \`;
              } else {
                const errorText = await response.text();
                resultDiv.innerHTML = \`
                  <span class="error">API测试失败! 状态码: \${response.status}</span>
                  <br>错误: \${errorText}
                \`;
              }
            } catch (error) {
              resultDiv.innerHTML = \`
                <span class="error">API测试过程中出错:</span>
                <br>\${error.message || String(error)}
              \`;
            }
          });
          
          // 测试R2连接
          document.getElementById('testR2Button').addEventListener('click', async () => {
            const resultDiv = document.getElementById('result');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '正在测试R2连接...';
            
            try {
              const response = await fetch('/api/r2-debug');
              
              if (response.ok) {
                const data = await response.json();
                resultDiv.innerHTML = \`
                  <span class="success">R2连接测试完成!</span>
                  <br>
                  <pre>\${JSON.stringify(data, null, 2)}</pre>
                \`;
              } else {
                const errorText = await response.text();
                resultDiv.innerHTML = \`
                  <span class="error">R2连接测试失败! 状态码: \${response.status}</span>
                  <br>错误: \${errorText}
                \`;
              }
            } catch (error) {
              resultDiv.innerHTML = \`
                <span class="error">R2连接测试过程中出错:</span>
                <br>\${error.message || String(error)}
              \`;
            }
          });
        </script>
      </body>
    </html>
  `;
  
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
} 