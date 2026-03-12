import { useState, useEffect, useRef } from 'react';
import { proxyAPI } from '../api';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Headphones, Filter, ChevronDown } from 'lucide-react';

export default function Category() {
  const navigate = useNavigate();
  
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [activeCatId, setActiveCatId] = useState(null);

  const [novels, setNovels] = useState([]);
  const [loadingNovels, setLoadingNovels] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Dynamic secondary pills based on active category
  const subCatMap = {
    '玄幻': ['东方玄幻', '异世大陆', '远古神话', '异术超能'],
    '奇幻': ['史诗奇幻', '黑暗幻想', '王朝争霸', '亡灵异族'],
    '都市': ['都市生活', '都市异能', '恩怨情仇', '青春校园'],
    '历史': ['架空历史', '秦汉三国', '上古先秦', '两晋隋唐'],
    '科幻': ['未来世界', '星际文明', '超级科技', '时空穿梭'],
    '游戏': ['虚拟网游', '游戏异界', '电子竞技', '游戏系统'],
    '言情': ['古代言情', '现代言情', '幻想言情', '浪漫青春'],
    '武侠': ['传统武侠', '国术无双', '古武未来', '武侠同人'],
    '古言': ['古典架空', '宫闱宅斗', '经商种田', '女尊王朝'],
    '悬疑': ['诡秘悬疑', '探险解谜', '恐怖惊悚', '推理侦探'],
    '同人': ['小说同人', '影视同人', '动漫同人', '游戏同人'],
    '轻小说': ['日系轻小说', '国产轻小说', '搞笑吐槽', '恋爱日常'],
  };
  const dynamicSubCats = subCatMap[categories.find(c => c.category_id === activeCatId)?.name] || ['全部', '精选', '热门', '新书'];

  // Initialize categories
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await proxyAPI.getCategories();
        const cats = res.data.categories || [];
        setCategories(cats);
        if (cats.length > 0) {
          setActiveCatId(cats[0].category_id);
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      } finally {
        setLoadingCats(false);
      }
    };
    fetchCats();
  }, []);

  // Fetch novels when category or page changes
  useEffect(() => {
    if (!activeCatId) return;
    
    const fetchNovels = async () => {
      if (page === 1) setLoadingNovels(true);
      try {
        const res = await proxyAPI.getCategoryNovels(activeCatId, page);
        const newNovels = res.data.novels || [];
        if (page === 1) {
          setNovels(newNovels);
        } else {
          setNovels(prev => [...prev, ...newNovels]);
        }
        setHasMore(newNovels.length >= 10); // Assume >=10 means has more
      } catch (err) {
        console.error("Failed to fetch category novels:", err);
      } finally {
        setLoadingNovels(false);
      }
    };
    fetchNovels();
  }, [activeCatId, page]);

  const handleCatChange = (id) => {
    if (activeCatId === id) return;
    setActiveCatId(id);
    setPage(1);
    setNovels([]);
  };

  const activeCatName = categories.find(c => c.category_id === activeCatId)?.name || '';

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* ═══ Header & Primary Tabs ═══ */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-color)', zIndex: 40 }}>
        
        {/* Top bar with back and primary tabs */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0.8rem 1rem 0', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ color: 'var(--text-main)', padding: '0.2rem' }}>
            <ChevronLeft size={28} style={{ strokeWidth: 1.5 }} />
          </button>
          
          <div className="scroll-row" style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: '1.5rem', WebkitOverflowScrolling: 'touch' }}>
            {loadingCats ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ width: '40px', height: '24px', borderRadius: '4px' }} />
              ))
            ) : (
              categories.map(cat => {
                const isActive = activeCatId === cat.category_id;
                return (
                  <div 
                    key={cat.category_id}
                    onClick={() => handleCatChange(cat.category_id)}
                    style={{ 
                      position: 'relative',
                      fontSize: isActive ? '1.15rem' : '1rem', 
                      fontWeight: isActive ? 700 : 400, 
                      color: isActive ? 'var(--text-main)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      paddingBottom: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {cat.name}
                    {isActive && (
                      <div style={{ 
                        position: 'absolute', 
                        bottom: '2px', 
                        left: '50%', 
                        transform: 'translateX(-50%)', 
                        width: '16px', 
                        height: '3px', 
                        backgroundColor: 'var(--danger)', 
                        borderRadius: '2px' 
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <button onClick={() => alert('听书功能开发中')} style={{ color: 'var(--text-main)', padding: '0.2rem', cursor: 'pointer' }}>
            <Headphones size={24} style={{ strokeWidth: 1.5 }} />
          </button>
        </div>

        {/* Secondary Pills Row */}
        {!loadingCats && activeCatName && (
          <div className="scroll-row" style={{ display: 'flex', gap: '0.8rem', padding: '0.8rem 1rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ 
              padding: '0.4rem 1rem', 
              borderRadius: '20px', 
              fontSize: '0.85rem', 
              fontWeight: 600,
              color: 'var(--danger)', 
              backgroundColor: 'rgba(255, 59, 48, 0.1)',
              whiteSpace: 'nowrap'
            }}>
              全部{activeCatName}
            </div>
            {dynamicSubCats.map(sub => (
              <div key={sub} onClick={() => alert(`"${sub}" 子分类筛选开发中`)} style={{ 
                padding: '0.4rem 1rem', 
                borderRadius: '20px', 
                fontSize: '0.85rem', 
                color: 'var(--text-secondary)', 
                backgroundColor: 'var(--bg-secondary)',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}>
                {sub}
              </div>
            ))}
          </div>
        )}

        {/* Sort & Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem 1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div onClick={() => alert('排序功能开发中')} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              人气最高 <ChevronDown size={14} />
            </div>
            <div onClick={() => alert('精品筛选开发中')} style={{ padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer' }}>
              精品
            </div>
          </div>
          <div onClick={() => alert('筛选功能开发中')} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <Filter size={14} /> 筛选
          </div>
        </div>
      </div>

      {/* ═══ Content List ═══ */}
      <div style={{ flex: 1, padding: '0 1rem 2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {loadingNovels && page === 1 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                <div className="skeleton" style={{ width: '80px', height: '106px', borderRadius: '6px' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="skeleton" style={{ width: '70%', height: '1.2rem' }} />
                  <div className="skeleton" style={{ width: '40%', height: '0.9rem' }} />
                  <div className="skeleton" style={{ width: '100%', height: '0.9rem' }} />
                  <div className="skeleton" style={{ width: '90%', height: '0.9rem' }} />
                </div>
              </div>
            ))
          ) : novels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-secondary)' }}>
              此分类下暂无书籍
            </div>
          ) : (
            novels.map((book, idx) => (
              <Link 
                key={book.novel_id || idx} 
                to={`/novel/${book.novel_id}`} 
                style={{ display: 'flex', gap: '1rem', textDecoration: 'none', color: 'inherit' }}
              >
                {/* Cover Image & Rating Badge */}
                <div style={{ flexShrink: 0, width: '80px', height: '106px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)', position: 'relative' }}>
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '0.7rem', color: 'var(--text-muted)' }}>封面</div>
                  )}
                  {/* Floating Rank Badge (simulate the numeric badges in the screenshot) */}
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '4px', 
                    right: '4px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: idx < 3 ? '#ffcc00' : 'rgba(0,0,0,0.5)', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem', 
                    color: '#fff', 
                    fontWeight: 700,
                    border: '1.5px solid #fff'
                  }}>
                    {idx + 1}
                  </div>
                  {/* Bottom overlay for simulated people reading count */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '60%', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', padding: '2px', fontSize: '0.65rem', color: '#fff' }}>
                    {((parseInt(book.novel_id || '0', 10) % 50) + 10)}万人在看
                  </div>
                </div>

                {/* Meta Info */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                  <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {book.title}
                  </h3>
                  
                  <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{book.author}</span>
                    <span style={{ color: 'var(--border-color)' }}>·</span>
                    <span>{activeCatName}</span>
                    <span style={{ color: 'var(--border-color)' }}>·</span>
                    <span>{book.status || '连载'}</span>
                    <span style={{ color: 'var(--border-color)' }}>·</span>
                    <span>{book.word_count || '未知'}</span>
                  </p>

                  <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', opacity: 0.8 }}>
                    {book.description || '暂无简介...'}
                  </p>

                  {/* Tags row */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                    {(book.tags && book.tags.length > 0 ? book.tags.slice(0, 3) : [activeCatName]).map((tag, ti) => (
                      <span key={ti} style={{ padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))
          )}

          {/* Load More Button */}
          {!loadingNovels && novels.length > 0 && hasMore && (
            <button 
              onClick={() => setPage(p => p + 1)}
              style={{
                marginTop: '1rem',
                padding: '0.8rem',
                backgroundColor: 'var(--bg-secondary)',
                border: 'none',
                borderRadius: '8px',
                color: 'var(--primary)',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
            >
              加载下一页
            </button>
          )}

        </div>
      </div>

    </div>
  );
}
