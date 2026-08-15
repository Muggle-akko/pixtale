import { toast } from "sonner";

// 这个模块封装前端 HTTP 请求。

interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T | null;
}

type RequestParams = object | FormData | null;

const MOCK_REQUEST_DELAY = 0;
const LOADING_TOAST_ID = 'http-request-loading';
const LOADING_TOAST_DELAY = 300;
const pendingRequestIds = new Set<number>();
let loadingToastTimer: ReturnType<typeof setTimeout> | null = null;
let loadingToastVisible = false;
let requestSequence = 0;

// 等待指定毫秒数，用于模拟线上接口耗时。
function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// 拼接接口基础地址。
function buildUrl(url: string) {
  return url.startsWith('/api') ? url : `/api${url.startsWith('/') ? url : `/${url}`}`;
}

// 按当前页面语言返回统一的请求加载提示。
function getLoadingMessage() {
  return document.documentElement.lang.startsWith('zh') ? '加载中…' : 'Loading…';
}

// 注册一个请求，并在请求超过短暂阈值时显示合并后的全局加载提示。
function beginRequestLoading() {
  const requestId = ++requestSequence;
  pendingRequestIds.add(requestId);

  if (!loadingToastTimer && !loadingToastVisible) {
    loadingToastTimer = setTimeout(() => {
      loadingToastTimer = null;

      if (pendingRequestIds.size) {
        toast.loading(getLoadingMessage(), { id: LOADING_TOAST_ID });
        loadingToastVisible = true;
      }
    }, LOADING_TOAST_DELAY);
  }

  return requestId;
}

// 完成一个请求；最后一个请求结束后关闭统一的全局加载提示。
function endRequestLoading(requestId: number) {
  pendingRequestIds.delete(requestId);

  if (pendingRequestIds.size) {
    return;
  }

  if (loadingToastTimer) {
    clearTimeout(loadingToastTimer);
    loadingToastTimer = null;
  }

  if (loadingToastVisible) {
    toast.dismiss(LOADING_TOAST_ID);
    loadingToastVisible = false;
  }
}

// 处理身份失效并跳转登录页。
function handleUnauthorized() {
  if (window.location.pathname !== '/auth') {
    window.location.replace('/auth');
  }
}

// 发送 POST 请求并返回接口 data。
async function post<T = unknown>(url: string, params: RequestParams = null) {
  const headers = new Headers();
  let body: BodyInit | null = null;

  if (params instanceof FormData) {
    body = params;
  } else if (params) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(params);
  }

  const requestId = beginRequestLoading();

  try {
    await sleep(MOCK_REQUEST_DELAY);

    const res = await fetch(buildUrl(url), {
      method: 'POST',
      headers,
      body,
      credentials: 'include'
    });
    const json = await res.json() as ApiResponse<T>;

    if (!res.ok || json.code !== 200) {
      const message = json.message || '请求失败';
      toast.error(message);

      if (res.status === 401 || json.code === 401) {
        handleUnauthorized();
      }

      throw new Error(message);
    }

    return json.data as T;
  } finally {
    endRequestLoading(requestId);
  }
}

const http = {
  // 发送 POST 请求。
  post<T = unknown>(url: string, params: RequestParams = null) {
    return post<T>(url, params);
  }
};

export { http };
export type { ApiResponse, RequestParams };
