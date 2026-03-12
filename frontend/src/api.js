import axios from 'axios';

const API_BASE_URL = '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Token auto-refresh mechanism (#5)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    
    // Treat both 401 (Unauthorized) and 422 from auth endpoints as auth failures
    const isAuthError = status === 401 || 
      (status === 422 && error.response?.data?.detail?.[0]?.loc?.includes('authorization'));
    
    if (isAuthError && !originalRequest._retry) {
      const path = window.location.pathname;
      if (path === '/login' || path === '/register') {
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('access_token');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        const newAccessToken = res.data.access_token;
        const newRefreshToken = res.data.refresh_token;
        localStorage.setItem('access_token', newAccessToken);
        if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);
        
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (username, password) => {
    return apiClient.post('/auth/login', { username, password });
  },
  register: (username, password) => apiClient.post('/auth/register', { username, password }),
  getMe: () => apiClient.get('/auth/me')
};

export const proxyAPI = {
  getRecommendations: () => apiClient.get('/proxy/recommendations'),
  getCategories: () => apiClient.get('/proxy/categories'),
  getCategoryNovels: (id, page = 1) => apiClient.get(`/proxy/category/${id}?page=${page}`),
  getRanking: (type, page = 1) => apiClient.get(`/proxy/ranking/${type}?page=${page}`),
  search: (query) => apiClient.get(`/proxy/search?q=${encodeURIComponent(query)}`),
  getNovelDetails: (id) => apiClient.get(`/proxy/novel/${id}`),
  getChapters: (id) => apiClient.get(`/proxy/novel/${id}/chapters`),
  getChapterContent: (novelId, chapterId) => apiClient.get(`/proxy/novel/${novelId}/chapter/${chapterId}`)
};

export const bookshelfAPI = {
  getBookshelf: () => apiClient.get('/bookshelf/list'),
  addBook: (novelId, title, coverUrl, author) => apiClient.post('/bookshelf/add', {
    novel_id: novelId,
    novel_title: title || '',
    novel_cover: coverUrl || '',
    novel_author: author || ''
  }),
  removeBook: (novelId) => apiClient.post('/bookshelf/remove', { novel_id: novelId })
};

export const readingAPI = {
  syncProgress: (novelId, currentChapterId, currentChapterTitle, progressPercent = 0.0) => 
    apiClient.post('/reading/sync', {
      novel_id: novelId,
      chapter_id: currentChapterId,
      chapter_title: currentChapterTitle,
      progress_percent: progressPercent
    }),
  getProgress: (novelId) => apiClient.get(`/reading/${novelId}`),
  getAllProgress: () => apiClient.get('/reading/all')
};

export default apiClient;
