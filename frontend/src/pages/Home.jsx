import { useState, useEffect } from 'react';
import { proxyAPI } from '../api';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Grid, RefreshCcw } from 'lucide-react';

export default function Home() {
  const [recommendations, setRecommendations] = useState([]);
  const [rankingNovels, setRankingNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [activeRankingTab, setActiveRankingTab] = useState('hot');
  const navigate = useNavigate();
  const [recPage, setRecPage] = useState(0);

  const rankingTabs = [
    { key: 'hot', label: '推荐榜' },
    { key: 'end', label: '完本榜' },
    { key: 'new', label: '巅峰榜' },
  ];

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const [recRes, rankRes] = await Promise.all([
          proxyAPI.getRecommendations(),
          proxyAPI.getRanking('hot')
        ]);
        
        const sections = recRes.data.sections || {};
        const allRecs = Object.values(sections).flat();
        setRecommendations(allRecs);
        setRankingNovels((rankRes.data.novels || []).slice(0, 8));
      } catch (err) {
        console.error("Failed to fetch home data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHomeData();
  }, []);

  const handleRankingTabSwitch = async (tabKey) => {
    if (tabKey === activeRankingTab) return;
    setActiveRankingTab(tabKey);
    setRankingLoading(true);
    try {
      const res = await proxyAPI.getRanking(tabKey);
      setRankingNovels((res.data.novels || []).slice(0, 8));
    } catch (err) {
      console.error("Failed to fetch ranking:", err);
    } finally {
      setRankingLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', paddingBottom: '2rem' }}>
      
      {/* Top Sticky Header */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-color)', zIndex: 40, padding: '1rem 1rem 0' }}>
        {/* Search Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
          <div 
            onClick={() => navigate('/search')}
            style={{ 
              flex: 1, 
              backgroundColor: 'var(--bg-secondary)', 
              borderRadius: '20px', 
              padding: '0.6rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-secondary)'
            }}
          >
            <Search size={18} />
            <span style={{ fontSize: '0.9rem' }}>高分之作！！！  ⭐⭐⭐⭐⭐</span>
          </div>
          <div onClick={() => navigate('/category')} style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <Grid size={22} />
            <span style={{ fontSize: '0.6rem' }}>分类</span>
          </div>
        </div>

        {/* Top Navigation Tabs */}
        <div className="scroll-row" style={{ paddingBottom: '0.5rem', gap: '1.25rem' }}>
          {['推荐', '小说', '漫剧', '广场', '听书', '看剧', '经典', '短篇'].map((tab, idx) => (
            <div 
              key={idx} 
              style={{ 
                fontSize: idx === 0 ? '1.1rem' : '1rem', 
                fontWeight: idx === 0 ? 600 : 400, 
                color: idx === 0 ? 'var(--text-main)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap'
              }}
            >
              {tab}
            </div>
          ))}
        </div>
      </div>

      <div className="container" style={{ padding: '0 1rem' }}>
        
        {/* ═══ Ranking Section ═══ */}
        <section className="card" style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
          {/* Tab headers — these are now functional */}
          <div className="scroll-row" style={{ gap: '1rem', marginBottom: '1rem', paddingBottom: '0' }}>
            {rankingTabs.map((tab) => (
              <div 
                key={tab.key}
                onClick={() => handleRankingTabSwitch(tab.key)}
                style={{ 
                  fontSize: '0.9rem', 
                  fontWeight: activeRankingTab === tab.key ? 600 : 400, 
                  color: activeRankingTab === tab.key ? 'var(--text-main)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                  cursor: 'pointer',
                  paddingBottom: '4px'
                }}
              >
                {tab.label}
                {activeRankingTab === tab.key && (
                  <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '16px', height: '2px', backgroundColor: 'var(--primary)', borderRadius: '1px' }} />
                )}
              </div>
            ))}
          </div>

          {/* 2-Column Grid for Rankings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem 0.5rem', opacity: rankingLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="skeleton" style={{ width: '48px', height: '64px', borderRadius: '4px' }} />
                  <div className="flex flex-col gap-1" style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: '1rem', width: '80%' }} />
                    <div className="skeleton" style={{ height: '0.8rem', width: '60%' }} />
                  </div>
                </div>
              ))
            ) : (
              rankingNovels.map((book, idx) => (
                <Link key={book.novel_id || idx} to={`/novel/${book.novel_id}`} className="flex gap-3 items-center" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ position: 'relative' }}>
                    {book.cover_url ? (
                      <img 
                        src={book.cover_url} 
                        alt={book.title} 
                        style={{ width: '52px', height: '70px', objectFit: 'cover', borderRadius: '6px' }} 
                        loading="lazy" 
                      />
                    ) : (
                      <div style={{ width: '52px', height: '70px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>封面</span>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div className="flex gap-2 items-center">
                      <span style={{ 
                        color: idx === 0 ? '#ffcc00' : idx === 1 ? '#ff9500' : idx === 2 ? '#ff3b30' : 'var(--text-secondary)', 
                        fontWeight: 700,
                        fontSize: '1rem',
                        fontStyle: 'italic',
                        minWidth: '16px'
                      }}>
                        {idx + 1}
                      </span>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {book.title}
                      </h4>
                    </div>
                    
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {book.author || '未知作者'}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* ═══ Promoted Cards (主编精选) ═══ */}
        <section style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>主编精选</h3>
            <div 
              onClick={() => setRecPage(p => (p + 1) * 4 >= recommendations.length ? 0 : p + 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <RefreshCcw size={14} />
              换一批
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {loading ? (
              <>
                <div className="skeleton" style={{ width: '100%', aspectRatio: '3/4', borderRadius: '12px' }} />
                <div className="skeleton" style={{ width: '100%', aspectRatio: '3/4', borderRadius: '12px' }} />
              </>
            ) : recommendations.slice(recPage * 4, recPage * 4 + 4).map((book, idx) => (
              <Link 
                key={book.novel_id || idx} 
                to={`/novel/${book.novel_id}`} 
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  aspectRatio: '3/4.5', 
                  borderRadius: '12px', 
                  overflow: 'hidden',
                  textDecoration: 'none'
                }}
              >
                {book.cover_url ? (
                  <img 
                    src={book.cover_url} 
                    alt={book.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{book.title}</span>
                  </div>
                )}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  right: 0, 
                  padding: '2rem 0.75rem 0.5rem', 
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                    {book.title}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>{book.author}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
