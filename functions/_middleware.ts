// 自定义Context接口，避免依赖@cloudflare/workers-types
interface Context {
  data: Record<string, any>;
  env: Record<string, any>;
  next: () => Promise<Response>;
  request: Request;
  waitUntil: (promise: Promise<any>) => void;
}

export const onRequest = async (context: Context) => {
  try {
    const response = await context.next();
    return response;
  } catch (err) {
    console.error('中间件捕获到错误:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}; 