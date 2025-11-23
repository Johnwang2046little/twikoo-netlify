// netlify/functions/twikoo.js
const originalHandler = require('twikoo-netlify').handler;

const CORS_ALLOW_ORIGIN = process.env.TWIKOO_CORS_ALLOW_ORIGIN || '*';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
};

function callOriginalHandler(event, context) {
  return new Promise((resolve, reject) => {
    try {
      // 支持 callback 风格：handler(event, context, callback)
      if (originalHandler.length >= 3) {
        originalHandler(event, context, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
        return;
      }

      // 也支持返回 Promise 的风格
      const maybePromise = originalHandler(event, context);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve).catch(reject);
      } else {
        // 如果既不是 callback 也不是 Promise，直接解析为返回值
        resolve(maybePromise);
      }
    } catch (e) {
      reject(e);
    }
  });
}

exports.handler = async (event, context) => {
  // 处理预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  try {
    const result = await callOriginalHandler(event, context);

    // 规范化返回对象（Netlify 函数规范）
    const res = result || {};
    const statusCode = res.statusCode || 200;
    const body = typeof res.body !== 'undefined' ? res.body : (res || '');

    // 合并 headers，优先保留原始 handler 的其它自定义 header，但覆盖或补充 CORS 头
    const headers = Object.assign({}, res.headers || {}, CORS_HEADERS);

    return {
      statusCode,
      headers,
      body,
      isBase64Encoded: res.isBase64Encoded || false,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: String(err || 'Internal Server Error'),
    };
  }
};
