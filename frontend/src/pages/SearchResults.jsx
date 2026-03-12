import { useState, useEffect } from 'react';
import { proxyAPI } from '../api';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, X, Trash2, Filter } from 'lucide-react';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  
  const [searchInput, setSearchInput] = useState(query);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Empty state data
  const [searchHistory, setSearchHistory] = useState([]);
  const [hotRanking, setHotRanking] = useState([]);
  const [hotLoading, setHotLoading] = useState(true);

  // Result state tabs
  const filterTabs = ['综合', '听书', '短剧', '漫剧', '漫画', '书单'];
  const [activeTab, setActiveTab] = useState('综合');

  // Load history on mount
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('search_history') || '[]');
    setSearchHistory(history);
  }, []);

  // Fetch hot ranking for empty state
  useEffect(() => {
    if (query) return; // Only fetch hot if empty
    const fetchHot = async () => {
      try {
        const res = await proxyAPI.getRanking('hot');
        setHotRanking((res.data.novels || []).slice(0, 10));
      } catch (err) {
        console.error("Failed to fetch hot ranking:", err);
      } finally {
        setHotLoading(false);
      }
    };
    fetchHot();
  }, [query]);

  // Perform search
  useEffect(() => {
    setSearchInput(query);
    if (!query) {
      setResults([]);
      return;
    }

    // Save to history
    const history = JSON.parse(localStorage.getItem('search_history') || '[]');
    const newHistory = [query, ...history.filter(q => q !== query)].slice(0, 10);
    localStorage.setItem('search_history', JSON.stringify(newHistory));
    setSearchHistory(newHistory);

    const fetchResults = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await proxyAPI.search(query);
        setResults(res.data.results || []);
      } catch (err) {
        console.error("Search failed:", err);
        setError("搜索出错，请稍后再试");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem('search_history');
    setSearchHistory([]);
  };

  const handleClearInput = () => {
    setSearchInput('');
    navigate('/search');
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* ═══ Top Search Navigation ═══ */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-color)', zIndex: 40, padding: '0.8rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Back Button */}
          <button onClick={() => navigate(-1)} style={{ color: 'var(--text-main)', padding: '0.2rem' }}>
            <ChevronLeft size={28} style={{ strokeWidth: 1.5 }} />
          </button>

          {/* Search Input Bar */}
          <form 
            onSubmit={handleSearchSubmit} 
            style={{ 
              flex: 1, 
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)', 
              borderRadius: '20px', 
              padding: '0.4rem 0.8rem',
              gap: '0.4rem'
            }}
          >
            <Search size={18} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="高分之作！！！ ⭐⭐⭐" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ 
                flex: 1, 
                backgroundColor: 'transparent', 
                border: 'none', 
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                outline: 'none',
                padding: '0.2rem 0'
              }}
              autoFocus
            />
            {searchInput && (
              <button 
                type="button" 
                onClick={handleClearInput}
                style={{ 
                  backgroundColor: 'var(--bg-tertiary)', 
                  borderRadius: '50%', 
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                <X size={14} />
              </button>
            )}
          </form>

          {/* Search Button / Ai Icon */}
          <button 
            onClick={handleSearchSubmit}
            style={{ 
              color: 'var(--primary)', 
              fontWeight: 600, 
              fontSize: '1rem',
              padding: '0.4rem 0.2rem',
              whiteSpace: 'nowrap'
            }}
          >
            搜索
          </button>
        </div>
      </div>

      {/* ═══ EMPTY STATE: History & Hot Rankings ═══ */}
      {!query && (
        <div style={{ padding: '1rem', flex: 1, overflowY: 'auto' }}>
          
          {/* Search History */}
          {searchHistory.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>搜索历史</h3>
                <button onClick={handleClearHistory} style={{ color: 'var(--text-secondary)' }}>
                  <Trash2 size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.8rem 1rem' }}>
                {searchHistory.map((term, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => navigate(`/search?q=${encodeURIComponent(term)}`)}
                    style={{ 
                      fontSize: '0.9rem', 
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer'
                    }}
                  >
                    {term}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hot Rankings */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffcc00' }}>番茄热搜榜</h3>
            </div>
            
            {hotLoading ? (
               Array.from({ length: 10 }).map((_, i) => (
                 <div key={i} className="skeleton" style={{ height: '40px', marginBottom: '1rem', borderRadius: '4px' }} />
               ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {hotRanking.map((book, idx) => (
                  <div 
                    key={book.novel_id || idx} 
                    onClick={() => navigate(`/search?q=${encodeURIComponent(book.title)}`)}
                    style={{ display: 'flex', gap: '1rem', cursor: 'pointer' }}
                  >
                    <span style={{ 
                      color: idx === 0 ? '#ffcc00' : idx === 1 ? '#ff9500' : idx === 2 ? '#ff3b30' : 'var(--text-secondary)', 
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      fontStyle: 'italic',
                      width: '20px',
                      textAlign: 'center'
                    }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {book.title}
                      </span>
                      {/* Fake heat value since backend doesn't provide it */}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {Math.floor(Math.random() * 500000 + 100000)}热搜值
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ RESULTS STATE: Filter Tabs & List ═══ */}
      {query && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          
          {/* Filter Tabs Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', borderBottom: '1px solid var(--bg-secondary)' }}>
            <div className="scroll-row" style={{ flex: 1, padding: '0.8rem 0', gap: '1.25rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {filterTabs.map((tab) => (
                <div 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{ 
                    fontSize: '0.95rem', 
                    fontWeight: activeTab === tab ? 600 : 400, 
                    color: activeTab === tab ? 'var(--text-main)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  {tab}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem', paddingLeft: '1rem', borderLeft: '1px solid var(--bg-tertiary)' }}>
              <Filter size={14} /> 筛选
            </div>
          </div>

          {/* Results List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                    <div className="skeleton" style={{ width: '80px', height: '106px', borderRadius: '6px' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div className="skeleton" style={{ width: '70%', height: '1.2rem' }} />
                      <div className="skeleton" style={{ width: '40%', height: '0.9rem' }} />
                      <div className="skeleton" style={{ width: '100%', height: '0.9rem' }} />
                      <div className="skeleton" style={{ width: '90%', height: '0.9rem' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--danger)' }}>{error}</div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-secondary)' }}>
                <span style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'block' }}>没有找到相关书籍</span>
                <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>换个搜索词试试吧</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
                {results.map((book, idx) => (
                  <Link 
                    key={book.novel_id || idx} 
                    to={`/novel/${book.novel_id}`} 
                    style={{ display: 'flex', gap: '1rem', textDecoration: 'none', color: 'inherit' }}
                  >
                    {/* Cover Image */}
                    <div style={{ flexShrink: 0, width: '80px', height: '106px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)', position: 'relative' }}>
                      {book.cover_url ? (
                        <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '0.7rem', color: 'var(--text-muted)' }}>封面</div>
                      )}
                      {/* Optional simulated score overlay */}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.6)', padding: '2px 4px', fontSize: '0.7rem', color: '#ff9500', fontWeight: 600 }}>
                        {book.score || '9.0'}分
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                      <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {/* Highlight the matched query in the title */}
                        {book.title.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) => 
                          part.toLowerCase() === query.toLowerCase() ? 
                          <span key={i} style={{ color: 'var(--primary)' }}>{part}</span> : 
                          part
                        )}
                      </h3>
                      
                      <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>作者：{book.author}</span>
                        {/* Simulated quick description text from screenshot */}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          | {book.description ? book.description.substring(0, 15) + '...' : ''}
                        </span>
                      </p>

                      <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', opacity: 0.8 }}>
                        {book.description || '暂无简介...'}
                      </p>

                      {/* Tags row */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                        {['长篇', '完本'].map(tag => (
                           <span key={tag} style={{ padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                             {tag}
                           </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
