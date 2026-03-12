import { useState, useEffect, useMemo } from 'react';
import { proxyAPI, bookshelfAPI } from '../api';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, MoreVertical, Star, ChevronRight, Headphones, Download } from 'lucide-react';

export default function NovelDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [novel, setNovel] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inBookshelf, setInBookshelf] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  // Deterministic mock data based on novel ID
  const mockData = useMemo(() => {
    if (!id) return {};
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = Math.abs(hash);
    
    return {
      wordCount: (hash % 300 + 50).toFixed(1) + '万字',
      score: (8.0 + (hash % 18) / 10).toFixed(1),
      reviews: (hash % 500 + 10) / 10 + '万人点评',
      readers: (hash % 200 + 5) / 10 + '万人',
      comments: hash % 9000 + 1000
    };
  }, [id]);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const [novelRes, chapRes, recRes] = await Promise.all([
          proxyAPI.getNovelDetails(id),
          proxyAPI.getChapters(id),
          proxyAPI.getRecommendations() // For related books
        ]);
        setNovel(novelRes.data);
        setChapters(chapRes.data.chapters || []);
        
        // Extract a flat list of recommendations for the "Related Books" section
        let recs = [];
        if (recRes.data.sections) {
          Object.values(recRes.data.sections).forEach(list => { recs = recs.concat(list); });
        }
        setRecommendations(recs.slice(0, 10)); // Take top 10
        
        if (isAuthenticated) {
          try {
            const shelfRes = await bookshelfAPI.getBookshelf();
            const inShelf = (shelfRes.data.books || []).some(b => b.novel_id === id);
            setInBookshelf(inShelf);
          } catch (e) { console.warn(e); }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id, isAuthenticated]);

  const toggleBookshelf = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      if (inBookshelf) {
        await bookshelfAPI.removeBook(id);
        setInBookshelf(false);
      } else {
        await bookshelfAPI.addBook(id, novel.title, novel.cover, novel.author);
        setInBookshelf(true);
      }
    } catch (e) { console.error(e); }
  };

  const handleDownloadTxt = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const resp = await fetch(`/api/download/${id}`);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${novel?.title || id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download error:', e);
      alert('下载失败，请稍后再试');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div>;
  if (!novel) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>未找到小说</div>;

  return (
    <div style={{ backgroundColor: '#111', minHeight: '100vh', color: '#fff', paddingBottom: '80px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Immersive Header Background */}
      <div style={{
        background: 'linear-gradient(180deg, #1f2b24 0%, #111 100%)',
        padding: '1rem 1rem 0',
      }}>
        
        {/* Top Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', height: '44px' }}>
          <button onClick={() => navigate(-1)} style={{ color: '#fff', padding: '0.5rem', marginLeft: '-0.5rem' }}>
            <ArrowLeft size={24} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>{inBookshelf ? '已加书架' : ''}</span>
            <MoreVertical size={20} color="#fff" />
          </div>
        </div>

        {/* Novel Meta Card */}
        <div style={{ display: 'flex', gap: '1.2rem', marginBottom: '2rem' }}>
          {/* Cover */}
          <div style={{ flexShrink: 0, width: '105px', position: 'relative' }}>
            <img src={novel.cover} alt={novel.title} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }} />
          </div>
          
          {/* Info */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', fontWeight: 600, lineHeight: 1.3 }}>{novel.title}</h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              <span>{novel.category || '小说'}</span>
              <span>·</span>
              <span>{novel.status || '连载中'}</span>
              <span>·</span>
              <span>{novel.word_count || mockData.wordCount}</span>
            </p>
            <div style={{ marginTop: '0.8rem' }}>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>番茄原创</span>
            </div>
          </div>
        </div>

        {/* Author Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <span style={{ fontSize: '1.2rem' }}>🧑‍💻</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{novel.author}</span>
                <span style={{ backgroundColor: '#d48806', color: '#fff', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px' }}>作家Lv.5</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>关注我，掌握书箱最新动态</div>
            </div>
          </div>
          <button style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '16px', fontSize: '0.85rem' }}>
            + 关注
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Score */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{mockData.score}</span>
              <div style={{ display: 'flex' }}>
                {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={i < Math.floor(mockData.score/2) ? "#ff9500" : "transparent"} color={i < Math.floor(mockData.score/2) ? "#ff9500" : "rgba(255,255,255,0.2)"} />)}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{mockData.reviews} {'>'}</div>
          </div>
          
          {/* Readers */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem' }}>{mockData.readers}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>正在阅读</div>
          </div>
          
          {/* Fans */}
          <div style={{ flex: 1, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', marginBottom: '0.5rem' }}>
              {/* Overlapping avatars */}
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#444', border: '1px solid #111', zIndex: 3 }}>🧔</div>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#555', border: '1px solid #111', marginLeft: '-8px', zIndex: 2 }}>👱‍♀️</div>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#666', border: '1px solid #111', marginLeft: '-8px', zIndex: 1 }}>👦</div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>粉丝榜 {'>'}</div>
          </div>
        </div>

      </div>{/* End of Immersive Header */}

        {/* Related Books */}
        {recommendations.length > 0 && (
          <div style={{ backgroundColor: '#1a1a1a', padding: '1.5rem 0', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: '#fff' }}>读这本书的人还在读</h3>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>换一换 ⟳</span>
            </div>
            
            {/* Horizontal Scroll List */}
            <div style={{ display: 'flex', overflowX: 'auto', gap: '0.8rem', padding: '0 1rem', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {recommendations.map((rec) => (
                <Link key={rec.novel_id} to={`/novel/${rec.novel_id}`} onClick={() => window.scrollTo(0,0)} style={{ flexShrink: 0, width: '84px', textDecoration: 'none' }}>
                  <img src={rec.cover_url} alt={rec.title} style={{ width: '84px', height: '112px', objectFit: 'cover', borderRadius: '4px', marginBottom: '0.5rem', backgroundColor: '#333' }} />
                  <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.title}</div>
                </Link>
              ))}
            </div>
            
            <div style={{ padding: '1.5rem 1rem 0', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
              版权信息：本书的数字版权由番茄小说提供并授权发行，如有任何疑问，请通过“我的-反馈与帮助”告知我们
            </div>
          </div>
        )}

      {/* Sticky Bottom Action Bar */}
      <div style={{ 
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        backgroundColor: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
          <Headphones size={22} style={{ marginBottom: '4px' }}/>
          <span style={{ fontSize: '0.7rem' }}>听书</span>
        </div>
        
        <div onClick={handleDownloadTxt} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', color: downloading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)' }}>
          <Download size={22} style={{ marginBottom: '4px' }}/>
          <span style={{ fontSize: '0.7rem' }}>{downloading ? '下载中' : '下载'}</span>
        </div>

        <Link 
          to={chapters.length > 0 ? `/read/${id}/${chapters[0].chapter_id}` : '#'}
          style={{ 
            flex: 1, 
            background: 'linear-gradient(90deg, #ff7e5f, #feb47b)', 
            color: '#fff', 
            textAlign: 'center', 
            padding: '0.8rem 0', 
            borderRadius: '24px', 
            fontSize: '1rem', 
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(255,126,95,0.3)'
          }}
        >
          免费阅读
        </Link>
      </div>
    </div>
  );
}
