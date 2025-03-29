export interface Context {
  next: () => Promise<Response>;
  env: Record<string, any>;
}

export const onRequest = async (context: Context) => {
  // 增加头部，允许更大的请求体
  const response = await context.next();
  
  // 添加CORS头
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Request-ID");
  
  return response;
}; 