import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { proxyAPI, readingAPI } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, List, Settings, Sun, Moon, Headphones, Pause, Square, Volume2, Share, MoreVertical, Bookmark } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../MobileReader.css';

const TTS_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: '女' },
  { id: 'zh-CN-YunxiNeural',    name: '云希', gender: '男' },
  { id: 'zh-CN-XiaoyiNeural',   name: '晓伊', gender: '女' },
  { id: 'zh-CN-YunyangNeural',  name: '云扬', gender: '男' },
];
const RATE_OPTIONS = ['0.8', '1.0', '1.2', '1.5', '2.0'];

const BG_THEMES = [
  { id: 'white',  color: '#ffffff', label: '白' },
  { id: 'yellow', color: '#f5f0dc', label: '黄' },
  { id: 'green',  color: '#e0f0e0', label: '绿' },
  { id: 'pink',   color: '#f5e6e8', label: '粉' },
  { id: 'gray',   color: '#e8e8e8', label: '灰' },
  { id: 'night',  color: '#0a0a0a', label: '夜' },
];

const LINE_HEIGHTS = ['1.5', '1.8', '2.0', '2.5'];

export default function ReadChapter() {
  const { novelId, chapterId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // ── 内容状态（多章节无限滚动）──
  // 每个元素: { id, title, paragraphs: string[], prevChap, nextChap }
  const [loadedChapters, setLoadedChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentVisibleChapter, setCurrentVisibleChapter] = useState(chapterId);

  // ── 章节列表（目录侧边栏用）──
  const [chapters, setChapters] = useState([]);
  const [novelTitle, setNovelTitle] = useState('');

  // ── UI 状态 ──
  const [menuVisible, setMenuVisible] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // ── 阅读设置（持久化到 localStorage）──
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('readerFontSize') || '18'));
  const [lineHeight, setLineHeight] = useState(() => localStorage.getItem('readerLineHeight') || '1.8');
  const [readerTheme, setReaderTheme] = useState(() => localStorage.getItem('readerTheme') || 'night');
  const [brightness, setBrightness] = useState(() => parseInt(localStorage.getItem('readerBrightness') || '100'));
  const [eyeCare, setEyeCare] = useState(() => localStorage.getItem('readerEyeCare') === 'true');
  const [autoRead, setAutoRead] = useState(false);
  const autoReadRef = useRef(null);

  // ── TTS 状态 ──
  const [ttsOpen, setTtsOpen] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsVoice, setTtsVoice] = useState(() => localStorage.getItem('ttsVoice') || 'zh-CN-XiaoxiaoNeural');
  const [ttsRate, setTtsRate] = useState(() => localStorage.getItem('ttsRate') || '1.0');
  const [ttsCurrentIdx, setTtsCurrentIdx] = useState(-1);
  const audioRef = useRef(null);          // 当前 blob URL
  const audioElRef = useRef(null);        // 复用同一个 Audio 元素（iOS 必需）
  const nextBlobUrlRef = useRef(null);    // 预加载的下一段 blob URL
  const ttsStoppedRef = useRef(false);
  const ttsVoiceRef = useRef(ttsVoice);
  const ttsRateRef = useRef(ttsRate);
  const ttsCurrentIdxRef = useRef(-1);
  const ttsChunkIdxRef = useRef(0);       // 当前播放到第几个 chunk
  const ttsPausedRef = useRef(false);     // 是否处于暂停状态

  // ── Refs ──
  const contentRef = useRef(null);
  const sidebarListRef = useRef(null);
  const loadedChapterIdsRef = useRef(new Set());
  const loadedChaptersRef = useRef([]);  // 始终指向最新的 loadedChapters
  const bottomSentinelRef = useRef(null);
  const currentVisibleChapterRef = useRef(chapterId);
  const allParagraphsRef = useRef([]);
  const scrollThrottleRef = useRef(null);

  // 保持 loadedChaptersRef 与 state 同步
  useEffect(() => {
    loadedChaptersRef.current = loadedChapters;
  }, [loadedChapters]);

  // ── 页码状态 ──
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ── 底部系统栏状态 (时间, 电池) ──
  const [currentTime, setCurrentTime] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(100);

  // 定时更新时间
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // 获取电池信息
  useEffect(() => {
    let batteryConfig = null;
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        batteryConfig = battery;
        const updateBattery = () => setBatteryLevel(Math.floor(battery.level * 100));
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
      }).catch(() => {});
    }
    return () => {
      if (batteryConfig) {
        batteryConfig.removeEventListener('levelchange', () => {});
      }
    };
  }, []);

  // ── 持久化设置 ──
  useEffect(() => { localStorage.setItem('readerFontSize', fontSize.toString()); }, [fontSize]);
  useEffect(() => { localStorage.setItem('readerLineHeight', lineHeight); }, [lineHeight]);
  useEffect(() => { localStorage.setItem('readerTheme', readerTheme); }, [readerTheme]);
  useEffect(() => { localStorage.setItem('ttsVoice', ttsVoice); }, [ttsVoice]);
  useEffect(() => { localStorage.setItem('ttsRate', ttsRate); }, [ttsRate]);
  useEffect(() => { localStorage.setItem('readerBrightness', brightness.toString()); }, [brightness]);
  useEffect(() => { localStorage.setItem('readerEyeCare', eyeCare.toString()); }, [eyeCare]);

  // 自动阅读
  useEffect(() => {
    if (autoRead) {
      autoReadRef.current = setInterval(() => {
        const container = contentRef.current;
        if (container) {
          container.scrollBy({ top: 2, behavior: 'auto' });
        }
      }, 30); // 每30ms滚动2px → 约 66px/s
    } else {
      if (autoReadRef.current) clearInterval(autoReadRef.current);
    }
    return () => { if (autoReadRef.current) clearInterval(autoReadRef.current); };
  }, [autoRead]);


  // 应用阅读主题到 document（卸载时清理）
  useEffect(() => {
    document.documentElement.setAttribute('data-reader-theme', readerTheme);
    return () => {
      document.documentElement.removeAttribute('data-reader-theme');
    };
  }, [readerTheme]);

  // ── 解析 HTML 内容为段落数组 ──
  const parseContentToParas = useCallback((htmlContent) => {
    if (!htmlContent) return [];
    let html = htmlContent.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<p[^>]*>/gi, '\n');
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || '';
    let paras = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
    const result = [];
    for (const p of paras) {
      if (p.length > 300) {
        const sentences = p.split(/(?<=[\u3002\uff01\uff1f])/g).filter(s => s.trim());
        let chunk = '';
        for (const s of sentences) {
          if (chunk.length + s.length > 300 && chunk.length > 0) {
            result.push(chunk.trim());
            chunk = s;
          } else {
            chunk += s;
          }
        }
        if (chunk.trim()) result.push(chunk.trim());
      } else {
        result.push(p);
      }
    }
    return result;
  }, []);

  // ── 加载单章并追加到 loadedChapters ──
  const fetchAndAppendChapter = useCallback(async (chapId, prepend = false) => {
    if (!chapId || loadedChapterIdsRef.current.has(chapId)) return null;
    loadedChapterIdsRef.current.add(chapId);
    try {
      const res = await proxyAPI.getChapterContent(novelId, chapId);
      const chapterData = {
        id: chapId,
        title: res.data.title,
        paragraphs: parseContentToParas(res.data.content),
        prevChap: res.data.prev_chapter,
        nextChap: res.data.next_chapter,
      };
      setLoadedChapters(prev => prepend ? [chapterData, ...prev] : [...prev, chapterData]);
      return chapterData;
    } catch (err) {
      console.error('Failed to load chapter', chapId, err);
      loadedChapterIdsRef.current.delete(chapId);
      return null;
    }
  }, [novelId, parseContentToParas]);

  // ── 初始加载（URL 指定的章节）──
  const initChapterRef = useRef(null);
  useEffect(() => {
    const targetChapterId = chapterId;
    initChapterRef.current = targetChapterId;

    const init = async () => {
      setLoading(true);
      loadedChapterIdsRef.current.clear();
      setLoadedChapters([]);
      setCurrentVisibleChapter(targetChapterId);
      currentVisibleChapterRef.current = targetChapterId;
      try {
        const res = await proxyAPI.getChapterContent(novelId, targetChapterId);
        // 如果在加载过程中又切换了章节，忽略响应
        if (initChapterRef.current !== targetChapterId) return;
        const chapterData = {
          id: targetChapterId,
          title: res.data.title,
          paragraphs: parseContentToParas(res.data.content),
          prevChap: res.data.prev_chapter,
          nextChap: res.data.next_chapter,
        };
        loadedChapterIdsRef.current.add(targetChapterId);
        setLoadedChapters([chapterData]);
        setLoading(false);
        // 同步阅读进度
        if (isAuthenticated && chapterData) {
          try { await readingAPI.syncProgress(novelId, targetChapterId, chapterData.title); } catch (_) {}
        }
      } catch (err) {
        console.error('Failed to load chapter', targetChapterId, err);
        if (initChapterRef.current === targetChapterId) setLoading(false);
      }
    };
    init();
  }, [novelId, chapterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 获取章节列表（目录用） ──
  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const res = await proxyAPI.getChapters(novelId);
        setChapters(res.data.chapters || []);
      } catch (err) {
        console.error('Failed to load chapters', err);
      }
    };
    fetchChapters();
  }, [novelId]);

  // ── 获取小说标题（侧边栏使用） ──
  useEffect(() => {
    const fetchNovelTitle = async () => {
      try {
        const res = await proxyAPI.getNovelDetails(novelId);
        setNovelTitle(res.data.title || '');
      } catch (_) {}
    };
    fetchNovelTitle();
  }, [novelId]);

  // ── 滚到底部自动加载下一章（IntersectionObserver）──
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && !loadingMore) {
        const lastChapter = loadedChapters[loadedChapters.length - 1];
        if (!lastChapter) return;
        const nextId = lastChapter.nextChap;
        if (!nextId || nextId.includes('read/index')) return;
        setLoadingMore(true);
        await fetchAndAppendChapter(nextId);
        setLoadingMore(false);
      }
    }, { root: contentRef.current, rootMargin: '500px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadedChapters, loadingMore, fetchAndAppendChapter]);

  // ── 滚动时检测当前可见章节 + 计算页码（节流 100ms）──
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const doScroll = () => {
      // 1) 检测当前可见章节
      const chapterEls = container.querySelectorAll('[data-chapter-id]');
      const scrollY = container.scrollTop + 200;
      for (let i = chapterEls.length - 1; i >= 0; i--) {
        if (chapterEls[i].offsetTop <= scrollY) {
          const visId = chapterEls[i].getAttribute('data-chapter-id');
          if (visId !== currentVisibleChapterRef.current) {
            currentVisibleChapterRef.current = visId;
            setCurrentVisibleChapter(visId);
            window.history.replaceState(null, '', `/read/${novelId}/${visId}`);
          }
          break;
        }
      }
      // 2) 计算虚拟页码
      const vh = container.clientHeight;
      if (vh > 0) {
        const page = Math.floor(container.scrollTop / vh) + 1;
        const total = Math.max(1, Math.ceil(container.scrollHeight / vh));
        setCurrentPage(page);
        setTotalPages(total);
      }
    };
    const handleScroll = () => {
      if (scrollThrottleRef.current) return;
      scrollThrottleRef.current = setTimeout(() => {
        scrollThrottleRef.current = null;
        doScroll();
      }, 100);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    doScroll();
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current);
    };
  }, [novelId, loadedChapters]);

  // ── 切换章节时停止 TTS ──
  useEffect(() => {
    return () => {
      ttsStoppedRef.current = true;
      if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.src = ''; }
      if (audioRef.current) { URL.revokeObjectURL(audioRef.current); audioRef.current = null; }
      if (nextBlobUrlRef.current) { URL.revokeObjectURL(nextBlobUrlRef.current); nextBlobUrlRef.current = null; }
      setTtsPlaying(false);
      setTtsCurrentIdx(-1);
    };
  }, [novelId, chapterId]);

  // ── TTS: 合并所有已加载章节的段落 + 同步 ref ──
  const allParagraphs = useMemo(() => {
    const paras = loadedChapters.flatMap(ch => ch.paragraphs);
    allParagraphsRef.current = paras;
    return paras;
  }, [loadedChapters]);

  // 通过 POST 请求获取 TTS 音频 blob URL
  const fetchTtsBlob = useCallback(async (text) => {
    const voice = ttsVoiceRef.current;
    const rate = ttsRateRef.current;
    const rateStr = rate === '1.0' ? '+0%'
      : (parseFloat(rate) > 1 ? `+${Math.round((parseFloat(rate) - 1) * 100)}%`
        : `-${Math.round((1 - parseFloat(rate)) * 100)}%`);
    const resp = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate: rateStr }),
    });
    if (!resp.ok) throw new Error('TTS fetch failed');
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }, []);

  // 把一章文本拆成 ≤800 字的小块（快速合成，用户无感）
  const splitChapterToChunks = useCallback((paragraphs) => {
    const fullText = paragraphs.join('\n');
    if (fullText.length <= 800) return [fullText];
    const chunks = [];
    let remaining = fullText;
    while (remaining.length > 0) {
      if (remaining.length <= 800) {
        chunks.push(remaining);
        break;
      }
      // 在 800 字符内找最后一个句号断开
      let cutAt = 800;
      const lastPeriod = remaining.lastIndexOf('。', cutAt);
      if (lastPeriod > 200) cutAt = lastPeriod + 1;
      chunks.push(remaining.slice(0, cutAt));
      remaining = remaining.slice(cutAt);
    }
    return chunks;
  }, []);

  // 获取下一个 chunk 的文本（可能跨章节）
  const getNextChunkInfo = useCallback((chapterIdx, chunkIdx, chapters) => {
    const chapter = chapters[chapterIdx];
    if (!chapter) return null;
    const chunks = splitChapterToChunks(chapter.paragraphs);
    if (chunkIdx + 1 < chunks.length) {
      return { chapterIdx, chunkIdx: chunkIdx + 1, text: chunks[chunkIdx + 1], crossChapter: false };
    }
    // 跨章节：取下一章第一块
    const nextChap = chapters[chapterIdx + 1];
    if (nextChap) {
      const nextChunks = splitChapterToChunks(nextChap.paragraphs);
      if (nextChunks.length > 0) {
        return { chapterIdx: chapterIdx + 1, chunkIdx: 0, text: nextChunks[0], crossChapter: true };
      }
    }
    return null;
  }, [splitChapterToChunks]);

  // ── TTS 核心：播放指定章节的指定 chunk ──
  const playChapter = useCallback(async (chapterIdx, chunkIdx = 0) => {
    if (ttsStoppedRef.current) {
      setTtsPlaying(false); setTtsCurrentIdx(-1); ttsCurrentIdxRef.current = -1;
      return;
    }

    // 从 ref 读取最新的 loadedChapters（避免 stale closure）
    const chapters = loadedChaptersRef.current;

    // 超出已加载章节 → 加载下一章
    if (chapterIdx >= chapters.length) {
      const lastCh = chapters[chapters.length - 1];
      if (lastCh && lastCh.nextChap && !lastCh.nextChap.includes('read/index')) {
        await fetchAndAppendChapter(lastCh.nextChap);
        // 等待 state 更新后重试
        setTimeout(() => {
          if (!ttsStoppedRef.current) playChapter(chapterIdx, 0);
        }, 800);
        return;
      }
      setTtsPlaying(false); setTtsCurrentIdx(-1); ttsCurrentIdxRef.current = -1;
      return;
    }

    const chapter = chapters[chapterIdx];
    const chunks = splitChapterToChunks(chapter.paragraphs);

    if (chunkIdx >= chunks.length) {
      // 本章读完，1 秒后读下一章
      setTimeout(() => {
        if (!ttsStoppedRef.current) playChapter(chapterIdx + 1, 0);
      }, 1000);
      return;
    }

    // 更新高亮 + 记录位置
    setTtsCurrentIdx(chapterIdx);
    ttsCurrentIdxRef.current = chapterIdx;
    ttsChunkIdxRef.current = chunkIdx;

    // 仅在第一个块时滚动到章节
    if (chunkIdx === 0) {
      const chapterEls = document.querySelectorAll('[data-chapter-id]');
      if (chapterEls[chapterIdx]) {
        chapterEls[chapterIdx].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    try {
      // 如果有预缓存的 blob URL，直接用；否则现取
      let blobUrl;
      if (nextBlobUrlRef.current) {
        blobUrl = nextBlobUrlRef.current;
        nextBlobUrlRef.current = null;
      } else {
        blobUrl = await fetchTtsBlob(chunks[chunkIdx]);
      }
      if (ttsStoppedRef.current) { URL.revokeObjectURL(blobUrl); return; }

      // 复用同一个 Audio 元素（iOS 需要保持用户手势解锁的同一对象）
      let audio = audioElRef.current;
      if (!audio) {
        audio = new Audio();
        audioElRef.current = audio;
      }
      // 释放旧 blob
      if (audioRef.current) URL.revokeObjectURL(audioRef.current);
      audioRef.current = blobUrl;

      audio.src = blobUrl;
      audio.load();

      // 在当前块播放的同时，预加载下一块
      const nextInfo = getNextChunkInfo(chapterIdx, chunkIdx, chapters);
      if (nextInfo) {
        fetchTtsBlob(nextInfo.text).then(url => {
          if (!ttsStoppedRef.current) nextBlobUrlRef.current = url;
        }).catch(() => {});
        // 如果下一章还没加载到内存，提前加载章节数据
        if (nextInfo.crossChapter) {
          const nextNextChap = chapters[nextInfo.chapterIdx];
          if (nextNextChap?.nextChap && !nextNextChap.nextChap.includes('read/index')) {
            const nextNextIdx = nextInfo.chapterIdx + 1;
            if (nextNextIdx >= chapters.length) {
              fetchAndAppendChapter(nextNextChap.nextChap);
            }
          }
        }
      } else {
        // 没有下一块 → 提前加载下一章的章节数据
        const lastCh = chapters[chapters.length - 1];
        if (lastCh?.nextChap && !lastCh.nextChap.includes('read/index')) {
          fetchAndAppendChapter(lastCh.nextChap);
        }
      }

      audio.play().catch(e => console.error('TTS play error:', e));

      audio.onended = () => {
        if (ttsStoppedRef.current) return;
        // 直接播下一块
        if (chunkIdx + 1 < chunks.length) {
          playChapter(chapterIdx, chunkIdx + 1);
        } else {
          // 章节间 1 秒间隔
          setTimeout(() => {
            if (!ttsStoppedRef.current) playChapter(chapterIdx + 1, 0);
          }, 1000);
        }
      };
      audio.onerror = () => {
        console.error('TTS audio error for chunk', chunkIdx);
        if (!ttsStoppedRef.current) playChapter(chapterIdx, chunkIdx + 1);
      };
    } catch (err) {
      console.error('TTS fetch error:', err);
      if (!ttsStoppedRef.current) playChapter(chapterIdx, chunkIdx + 1);
    }
  }, [fetchAndAppendChapter, fetchTtsBlob, splitChapterToChunks, getNextChunkInfo]);

  // 实时更新 voice/rate ref + 播放中切换时从当前 chunk 重新开始
  useEffect(() => {
    ttsVoiceRef.current = ttsVoice;
    ttsRateRef.current = ttsRate;
    if (ttsCurrentIdxRef.current >= 0 && !ttsStoppedRef.current && !ttsPausedRef.current) {
      if (audioElRef.current) { audioElRef.current.pause(); }
      if (audioRef.current) { URL.revokeObjectURL(audioRef.current); audioRef.current = null; }
      if (nextBlobUrlRef.current) { URL.revokeObjectURL(nextBlobUrlRef.current); nextBlobUrlRef.current = null; }
      playChapter(ttsCurrentIdxRef.current, ttsChunkIdxRef.current);
    }
  }, [ttsVoice, ttsRate]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleTtsPlay = () => {
    ttsStoppedRef.current = false;
    setTtsPlaying(true);

    // 如果是暂停后恢复，直接继续播放当前 audio
    if (ttsPausedRef.current && audioElRef.current) {
      ttsPausedRef.current = false;
      audioElRef.current.play().catch(e => console.error('TTS resume error:', e));
      return;
    }
    ttsPausedRef.current = false;

    if (ttsCurrentIdx >= 0) {
      // 从当前 chunk 继续
      playChapter(ttsCurrentIdx, ttsChunkIdxRef.current);
    } else {
      // 找到当前可见章节的索引
      const visChapId = currentVisibleChapterRef.current;
      let chapIdx = loadedChapters.findIndex(ch => ch.id === visChapId);
      if (chapIdx < 0) chapIdx = 0;
      playChapter(chapIdx, 0);
    }
  };
  const handleTtsPause = () => {
    setTtsPlaying(false);
    ttsPausedRef.current = true;
    if (audioElRef.current) audioElRef.current.pause();
  };
  const handleTtsStop = () => {
    ttsStoppedRef.current = true;
    ttsPausedRef.current = false;
    setTtsPlaying(false);
    setTtsCurrentIdx(-1);
    ttsCurrentIdxRef.current = -1;
    ttsChunkIdxRef.current = 0;
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.src = ''; }
    if (audioRef.current) { URL.revokeObjectURL(audioRef.current); audioRef.current = null; }
    if (nextBlobUrlRef.current) { URL.revokeObjectURL(nextBlobUrlRef.current); nextBlobUrlRef.current = null; }
  };

  // ── 交互处理 ──
  const toggleMenu = () => {
    setMenuVisible(v => !v);
    setSidebarVisible(false);
    setSettingsVisible(false);
    setTtsOpen(false);
  };

  // 统一点击处理：上/中/下 三段式
  // 上1/3 → 丝滑翻上一页, 中1/3 → 切换菜单, 下1/3 → 丝滑翻下一页
  const handleContentClick = (e) => {
    if (e.target.closest('button, a, input, [role="button"]')) return;
    if (menuVisible || sidebarVisible || settingsVisible || ttsOpen) {
      // 菜单已打开时，点击内容区域关闭菜单
      setMenuVisible(false);
      setSidebarVisible(false);
      setSettingsVisible(false);
      setTtsOpen(false);
      return;
    }
    const y = e.clientY;
    const h = window.innerHeight;
    const container = contentRef.current;
    if (!container) return;
    const scrollAmount = container.clientHeight * 0.85; // 滚动 85% 视口高度
    if (y < h / 3) {
      // 上1/3：翻上一页
      container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
    } else if (y > (h * 2) / 3) {
      // 下1/3：翻下一页
      container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    } else {
      // 中1/3：切换菜单
      toggleMenu();
    }
  };

  const goChapter = (chapId) => {
    setSidebarVisible(false);
    setMenuVisible(false);
    handleTtsStop();
    navigate(`/read/${novelId}/${chapId}`);
  };

  // 获取当前可见章节的前后章信息
  const currentChapData = loadedChapters.find(c => c.id === currentVisibleChapter) || loadedChapters[0];
  const prevChap = currentChapData?.prevChap;
  const nextChap = currentChapData?.nextChap;

  const goPrevChapter = () => {
    if (prevChap && !prevChap.includes('read/index')) {
      handleTtsStop();
      navigate(`/read/${novelId}/${prevChap}`);
    }
  };
  const goNextChapter = () => {
    if (nextChap && !nextChap.includes('read/index')) {
      handleTtsStop();
      navigate(`/read/${novelId}/${nextChap}`);
    }
  };


  // 侧边栏打开时滚动到当前章节
  useEffect(() => {
    if (sidebarVisible && sidebarListRef.current) {
      const active = sidebarListRef.current.querySelector('.mobile-reader__sidebar-item--active');
      if (active) active.scrollIntoView({ block: 'center' });
    }
  }, [sidebarVisible]);

  // 判断日/夜模式
  const isNightMode = readerTheme === 'night';
  const toggleNightMode = () => {
    setReaderTheme(isNightMode ? 'white' : 'night');
  };

  // ── 加载中 ──
  if (loading) {
    return (
      <div className="mobile-reader">
        <div className="mobile-reader__loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="mobile-reader">

      {/* ── 内容区域（无限滚动多章节） ── */}
      <div
        ref={contentRef}
        className="mobile-reader__content"
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: lineHeight,
          filter: `brightness(${brightness / 100})${eyeCare ? ' sepia(0.3)' : ''}`,
        }}
        onClick={handleContentClick}
      >
        {loadedChapters.map((chap, chapterIndex) => {
          const isChapterSpeaking = chapterIndex === ttsCurrentIdx;
          return (
          <div key={chap.id} data-chapter-id={chap.id} className={isChapterSpeaking ? 'mobile-reader__chapter--speaking' : ''}>
            {/* 章节大标题分隔 */}
            <div className="mobile-reader__chapter-title" style={{
              borderTop: chapterIndex > 0 ? '1px solid rgba(128,128,128,0.2)' : 'none',
              marginTop: chapterIndex > 0 ? '2rem' : '0',
            }}>
              <h2 style={{
                fontSize: '1.4em', fontWeight: 700, color: 'var(--reader-text)',
                margin: 0, lineHeight: 1.4,
              }}>
                {chap.title}
              </h2>
            </div>

            {chap.paragraphs.map((para, i) => {
              // 跳过与章节标题完全相同的第一段落（避免重复显示）
              if (i === 0 && para.trim() === chap.title.trim()) return null;
              return (
                <p key={i} className="mobile-reader__para">
                  {para}
                </p>
              );
            })}
          </div>
          )})}

        {/* 底部哨兵（IntersectionObserver 触发加载下一章） */}
        <div ref={bottomSentinelRef} style={{ height: '1px' }} />

        {/* 加载下一章提示 */}
        {loadingMore && (
          <div style={{
            textAlign: 'center', padding: '2rem 0', color: 'var(--reader-text)', opacity: 0.5, fontSize: '0.9rem',
          }}>
            正在加载下一章...
          </div>
        )}

        {/* 已到最后一章提示 */}
        {!loadingMore && loadedChapters.length > 0 && (() => {
          const last = loadedChapters[loadedChapters.length - 1];
          return !last.nextChap || last.nextChap.includes('read/index');
        })() && (
          <div style={{
            textAlign: 'center', padding: '3rem 0 5rem', color: 'var(--reader-text)', opacity: 0.4, fontSize: '0.85rem',
          }}>
            ── 已到最后一章 ──
          </div>
        )}
      </div>

      {/* ── 顶部菜单 (全新) ── */}
      <div className={`mobile-reader__top-bar ${menuVisible ? 'mobile-reader__top-bar--visible' : ''}`}>
        <div className="mobile-reader__top-bar-left">
          <button className="mobile-reader__top-bar-btn" onClick={() => navigate(`/novel/${novelId}`)}>
            <ChevronLeft size={24} />
          </button>
          <span>已加书架</span>
        </div>
        <div className="mobile-reader__top-bar-right">
          <button className="mobile-reader__top-bar-btn"><Share size={20} /></button>
          <button className="mobile-reader__top-bar-btn"><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* ── 底部常驻栏 (时间、电池、进度) ── */}
      {!menuVisible && (
        <div className="mobile-reader__footer">
          <div className="mobile-reader__footer-left">
            <span>{currentChapData?.title || '加载中...'}</span>
          </div>
          <div className="mobile-reader__footer-right">
            <span>{currentPage}/{totalPages}</span>
            <span>{currentTime}</span>
            <div className="mobile-reader__battery-icon">
              <div className="mobile-reader__battery-level" style={{ width: `${batteryLevel}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* ── 底部功能菜单区 ── */}
      <div className={`mobile-reader__bottom-bar ${menuVisible ? 'mobile-reader__bottom-bar--visible' : ''}`}>
        {/* 上半部分：透明，章节切换与进度进度条 */}
        <div className="mobile-reader__bottom-nav">
          <button className="mobile-reader__nav-text" onClick={goPrevChapter}
            style={{ opacity: prevChap && !prevChap.includes('read/index') ? 1 : 0.4 }}>
            上一章
          </button>
          <input 
            type="range" 
            min="1" 
            max={loadedChapters.length ? loadedChapters.length : 1} 
            value={loadedChapters.findIndex(ch => ch.id === currentVisibleChapterRef.current) + 1}
            className="mobile-reader__nav-slider" 
            readOnly
          />
          <button className="mobile-reader__nav-text" onClick={goNextChapter}
            style={{ opacity: nextChap && !nextChap.includes('read/index') ? 1 : 0.4 }}>
            下一章
          </button>
        </div>
        
        {/* 下半部分：黑色底，三个大图标 */}
        <div className="mobile-reader__bottom-actions">
          <button className="mobile-reader__action-btn" onClick={() => { setSidebarVisible(true); setMenuVisible(false); }}>
            <List size={22} color="var(--reader-text)" />
            <span>目录</span>
          </button>
          <button className="mobile-reader__action-btn" onClick={toggleNightMode}>
            {isNightMode ? <Sun size={22} color="var(--reader-text)" /> : <Moon size={22} color="var(--reader-text)" />}
            <span>{isNightMode ? '日间' : '夜间'}</span>
          </button>
          <button className="mobile-reader__action-btn" onClick={() => { setSettingsVisible(true); setMenuVisible(false); }}>
            <Settings size={22} color="var(--reader-text)" />
            <span>设置</span>
          </button>
        </div>
      </div>

      {/* ── 目录侧边栏遮罩 ── */}
      <div
        className={`mobile-reader__sidebar-overlay ${sidebarVisible ? 'mobile-reader__sidebar-overlay--visible' : ''}`}
        onClick={() => setSidebarVisible(false)}
      />
      {/* ── 目录侧边栏 ── */}
      <div className={`mobile-reader__sidebar ${sidebarVisible ? 'mobile-reader__sidebar--visible' : ''}`}>
        <div className="mobile-reader__sidebar-header">
          <div className="mobile-reader__sidebar-book-info">
            <img src={currentChapData ? `https://ixdzs8.com/cover/${novelId}.jpg` : ''} alt="cover" className="mobile-reader__sidebar-cover" 
                 onError={(e) => e.target.style.display='none'} />
            <div>
              <div className="mobile-reader__sidebar-book-title">{novelTitle || '加载中...'}</div>
            </div>
          </div>
          <div className="mobile-reader__sidebar-tabs">
            <button className="mobile-reader__sidebar-tab mobile-reader__sidebar-tab--active">目录</button>
            <button className="mobile-reader__sidebar-tab">笔记</button>
          </div>
        </div>
        <div className="mobile-reader__sidebar-meta">
          <span>共{chapters.length}章</span>
          <span>倒序</span>
        </div>
        <div className="mobile-reader__sidebar-list" ref={sidebarListRef}>
          {chapters.map((ch) => (
            <button
              key={ch.chapter_id}
              className={`mobile-reader__sidebar-item ${ch.chapter_id === currentVisibleChapter ? 'mobile-reader__sidebar-item--active' : ''}`}
              onClick={() => goChapter(ch.chapter_id)}
            >
              <div className="mobile-reader__sidebar-item-title">{ch.title}</div>
              <div className="mobile-reader__sidebar-item-count">{Math.floor(Math.random() * 2000 + 2000)}字</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── 设置面板遮罩 ── */}
      <div
        className={`mobile-reader__settings-overlay ${settingsVisible ? 'mobile-reader__settings-overlay--visible' : ''}`}
        onClick={() => setSettingsVisible(false)}
      />
      {/* ── 设置面板 ── */}
      <div className={`mobile-reader__settings-panel ${settingsVisible ? 'mobile-reader__settings-panel--visible' : ''}`}>
        {/* 亮度 */}
        <div className="mobile-reader__settings-row">
          <div className="mobile-reader__settings-label">亮度</div>
          <div className="mobile-reader__settings-content">
            <input type="range" min="30" max="100" value={brightness}
              className="mobile-reader__slider"
              onChange={e => setBrightness(parseInt(e.target.value))} />
            <button
              className={`mobile-reader__pill-btn${eyeCare ? ' mobile-reader__pill-btn--active' : ''}`}
              onClick={() => setEyeCare(!eyeCare)}
              style={{ flex: 'none', whiteSpace: 'nowrap', padding: '0.4rem 0.6rem' }}
            >护眼模式</button>
          </div>
        </div>

        {/* 字体大小 */}
        <div className="mobile-reader__settings-row">
          <div className="mobile-reader__settings-label">字体</div>
          <div className="mobile-reader__settings-content">
            <button className="mobile-reader__pill-btn" onClick={() => setFontSize(Math.max(14, fontSize - 1))}>A-</button>
            <span style={{ width: '2rem', textAlign: 'center', fontSize: '1rem', color: 'var(--reader-text)' }}>{fontSize}</span>
            <button className="mobile-reader__pill-btn" onClick={() => setFontSize(Math.min(36, fontSize + 1))}>A+</button>
            <button className="mobile-reader__pill-btn" style={{ flex: 1.5 }}>系统字体 &gt;</button>
          </div>
        </div>

        {/* 颜色主题 */}
        <div className="mobile-reader__settings-row">
          <div className="mobile-reader__settings-label">颜色</div>
          <div className="mobile-reader__settings-content" style={{ justifyContent: 'space-between' }}>
            {BG_THEMES.map(t => (
              <div
                key={t.id}
                className={`mobile-reader__bg-circle ${readerTheme === t.id ? 'mobile-reader__bg-circle--active' : ''}`}
                style={{ backgroundColor: t.color }}
                onClick={() => setReaderTheme(t.id)}
                title={t.label}
              >
                {t.id === 'night' && <Moon size={16} color="#ffffff" />}
              </div>
            ))}
          </div>
        </div>

        {/* 背景纹理 */}
        <div className="mobile-reader__settings-row">
          <div className="mobile-reader__settings-label">背景</div>
          <div className="mobile-reader__settings-content">
            <div className={`mobile-reader__bg-rect ${readerTheme === 'night' ? 'mobile-reader__bg-rect--active' : ''}`} style={{ background: '#1d1d1d' }}></div>
            <div className="mobile-reader__bg-rect" style={{ background: 'linear-gradient(135deg, #2a2a2a, #1a1a1a)' }}></div>
            <div className="mobile-reader__bg-rect" style={{ background: '#222' }}></div>
            <div className="mobile-reader__bg-rect" style={{ background: '#2a2a2a' }}></div>
            <div className="mobile-reader__bg-rect" style={{ display: 'flex', flexDirection: 'column', fontSize: '0.6rem' }}>
               <span>+</span>
               <span>自定义</span>
            </div>
          </div>
        </div>

        {/* 翻页模式 */}
        <div className="mobile-reader__settings-row">
          <div className="mobile-reader__settings-label">翻页</div>
          <div className="mobile-reader__settings-content">
            <button className="mobile-reader__pill-btn">仿真</button>
            <button className="mobile-reader__pill-btn">覆盖</button>
            <button className="mobile-reader__pill-btn">平移</button>
            <button className="mobile-reader__pill-btn mobile-reader__pill-btn--active">上下</button>
            <button className="mobile-reader__pill-btn">无动画</button>
          </div>
        </div>

        {/* 其他设置 */}
        <div className="mobile-reader__settings-row" style={{ marginBottom: 0 }}>
          <div className="mobile-reader__settings-label">其他</div>
          <div className="mobile-reader__settings-content">
            <button
              className={`mobile-reader__pill-btn${autoRead ? ' mobile-reader__pill-btn--active' : ''}`}
              style={{ flex: 1.5 }}
              onClick={() => setAutoRead(!autoRead)}
            >{autoRead ? '停止自动阅读' : '开启自动阅读 ▷'}</button>
            <button className="mobile-reader__pill-btn" onClick={() => {
              const idx = LINE_HEIGHTS.indexOf(lineHeight);
              setLineHeight(LINE_HEIGHTS[(idx + 1) % LINE_HEIGHTS.length]);
            }}>间距 {lineHeight}</button>
            <button className="mobile-reader__pill-btn" onClick={() => { setTtsOpen(true); setSettingsVisible(false); }}>听书</button>
          </div>
        </div>
      </div>

      {/* ── 悬浮听书按钮 ── */}
      {menuVisible && (
        <button
          className={`mobile-reader__tts-fab ${ttsPlaying ? 'mobile-reader__tts-fab--playing' : ''}`}
          onClick={() => { setTtsOpen(!ttsOpen); setMenuVisible(false); }}
        >
          {ttsPlaying ? '♪' : '听'}
        </button>
      )}

      {/* ── TTS 面板（全屏遮罩） ── */}
      {ttsOpen && (
        <>
          <div
            className="mobile-reader__settings-overlay mobile-reader__settings-overlay--visible"
            onClick={() => setTtsOpen(false)}
          />
          <div className="mobile-reader__settings-panel mobile-reader__settings-panel--visible">
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Volume2 size={18} /> 听书模式
            </div>
            {/* 语音选择 */}
            <div className="mobile-reader__settings-row">
              <div className="mobile-reader__settings-label">语音</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {TTS_VOICES.map(v => (
                  <button key={v.id} onClick={() => setTtsVoice(v.id)}
                    className={`mobile-reader__spacing-btn ${ttsVoice === v.id ? 'mobile-reader__spacing-btn--active' : ''}`}
                    style={{ flex: 'none', padding: '0.3rem 0.6rem' }}
                  >
                    {v.name}({v.gender})
                  </button>
                ))}
              </div>
            </div>
            {/* 语速 */}
            <div className="mobile-reader__settings-row">
              <div className="mobile-reader__settings-label">语速</div>
              <div className="mobile-reader__spacing-options">
                {RATE_OPTIONS.map(r => (
                  <button key={r} onClick={() => setTtsRate(r)}
                    className={`mobile-reader__spacing-btn ${ttsRate === r ? 'mobile-reader__spacing-btn--active' : ''}`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
            {/* 播放控制 */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              {!ttsPlaying ? (
                <button onClick={handleTtsPlay} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.6rem 2rem', borderRadius: '24px',
                  background: 'var(--primary, #8AB4F8)', color: '#121212',
                  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem'
                }}>
                  <Headphones size={18} /> 开始朗读
                </button>
              ) : (
                <>
                  <button onClick={handleTtsPause} style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.6rem 1.5rem', borderRadius: '24px',
                    background: 'var(--primary, #8AB4F8)', color: '#121212',
                    border: 'none', cursor: 'pointer', fontWeight: 600
                  }}>
                    <Pause size={18} /> 暂停
                  </button>
                  <button onClick={handleTtsStop} style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.6rem 1.5rem', borderRadius: '24px',
                    background: 'transparent', color: 'var(--reader-text)',
                    border: '1px solid rgba(128,128,128,0.3)', cursor: 'pointer'
                  }}>
                    <Square size={16} /> 停止
                  </button>
                </>
              )}
            </div>
            {/* 进度 */}
            {ttsCurrentIdx >= 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--reader-text)', opacity: 0.5, textAlign: 'center', marginTop: '0.75rem' }}>
                正在朗读: {loadedChapters[ttsCurrentIdx]?.title || ''}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
