import { useState, useEffect } from 'react';
import { bookshelfAPI, readingAPI } from '../api';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Gamepad2, MoreHorizontal, ArrowDownAZ, Filter, Settings2 } from 'lucide-react';

export default function Bookshelf() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [books, setBooks] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);

  // 签到 state
  const [signed, setSigned] = useState(() => {
    const today = new Date().toDateString();
    return localStorage.getItem('signDate') === today;
  });

  // 管理 mode
  const [manageMode, setManageMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState(new Set());

  // 排序 mode
  const [sortMode, setSortMode] = useState('default');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/login'); return; }

    const fetchBookshelf = async () => {
      setLoading(true);
      try {
        const [shelfRes, progRes] = await Promise.all([
          bookshelfAPI.getBookshelf(),
          readingAPI.getAllProgress()
        ]);
        setBooks(shelfRes.data.books || []);
        const progMap = {};
        (progRes.data.progress || []).forEach(p => { progMap[p.novel_id] = p; });
        setProgress(progMap);
      } catch (err) {
        console.error("Failed to load bookshelf", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookshelf();
  }, [isAuthenticated, authLoading, navigate]);

  const handleRemove = async (e, novelId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('确定要从书架移除这本书吗？')) {
      try {
        await bookshelfAPI.removeBook(novelId);
        setBooks(books.filter(b => b.novel_id !== novelId));
      } catch (err) { console.error(err); }
    }
  };

  const handleSign = () => {
    const today = new Date().toDateString();
    localStorage.setItem('signDate', today);
    setSigned(true);
  };

  const toggleSelect = (novelId) => {
    setSelectedBooks(prev => {
      const next = new Set(prev);
      if (next.has(novelId)) next.delete(novelId); else next.add(novelId);
      return next;
    });
  };

  const handleBatchRemove = async () => {
    if (selectedBooks.size === 0) return;
    if (!window.confirm(`确定移除选中的 ${selectedBooks.size} 本书吗？`)) return;
    try {
      await Promise.all([...selectedBooks].map(id => bookshelfAPI.removeBook(id)));
      setBooks(books.filter(b => !selectedBooks.has(b.novel_id)));
      setSelectedBooks(new Set());
      setManageMode(false);
    } catch (e) { console.error(e); }
  };

  const sortedBooks = [...books].sort((a, b) => {
    if (sortMode === 'title') return (a.novel_title || '').localeCompare(b.novel_title || '');
    return 0;
  });

  if (authLoading || loading) {
    return (
      <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
        <div className="skeleton" style={{ width: '80%', height: '100px', borderRadius: '12px' }} />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh' }}>
      
      {/* Red Gradient Top Banner */}
      <div style={{ 
        background: 'linear-gradient(180deg, #8b0000 0%, #111111 100%)',
        padding: '3rem 1rem 1rem',
        borderRadius: '0 0 24px 24px'
      }}>
        {/* Top Header Icons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: '500', color: 'rgba(255,255,255,0.9)' }}>今日暂无阅读时长</span>
          <div style={{ display: 'flex', gap: '1.2rem', color: '#fff' }}>
            <Search size={22} onClick={() => navigate('/search')} style={{ cursor: 'pointer' }} />
            <Gamepad2 size={22} onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
            <MoreHorizontal size={22} onClick={() => alert('更多功能开发中')} style={{ cursor: 'pointer' }} />
          </div>
        </div>

        {/* Floating Read Card */}
        <div className="glass" style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1rem', borderRadius: '16px', marginBottom: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            <div style={{ width: '40px', height: '56px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #ff4d4f, #ff7875)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#fff', fontWeight: 700 }}>读</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>每日导读推荐</h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>为你精选的必读神作</p>
            </div>
          </div>
          <button onClick={handleSign} disabled={signed} style={{ 
            background: signed ? '#555' : 'linear-gradient(90deg, #ff4d4f, #ff7875)', 
            border: 'none', borderRadius: '20px', padding: '0.4rem 1rem', 
            color: '#fff', fontWeight: 600, fontSize: '0.85rem',
            cursor: signed ? 'default' : 'pointer', opacity: signed ? 0.7 : 1
          }}>
            {signed ? '已签到' : '签到'}
          </button>
        </div>
      </div>

      <div className="container" style={{ padding: '0 1rem' }}>
        
        {/* Bookshelf Navigation & Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)' }}>书架</h2>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>浏览记录</span>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <span onClick={() => setSortMode(sortMode === 'title' ? 'default' : 'title')} style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', color: sortMode === 'title' ? 'var(--primary)' : 'var(--text-secondary)' }}><ArrowDownAZ size={14} /> 综合排序</span>
            <span onClick={() => alert('筛选功能开发中')} style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}><Filter size={14} /> 筛选</span>
            <span onClick={() => { setManageMode(!manageMode); setSelectedBooks(new Set()); }} style={{ display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer', color: manageMode ? 'var(--danger)' : 'var(--text-secondary)' }}><Settings2 size={14} /> {manageMode ? '取消' : '管理'}</span>
          </div>
        </div>

        {/* Vertical Book List */}
        {books.length === 0 ? (
          <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
             <h3 className="text-secondary" style={{ marginBottom: '1rem' }}>书架空空如也</h3>
             <Link to="/" className="btn-primary" style={{ display: 'inline-block' }}>去书城发现好书</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>
            {sortedBooks.map(book => {
               const prog = progress[book.novel_id];
               return (
                 <div key={book.novel_id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                   {manageMode && (
                     <div onClick={() => toggleSelect(book.novel_id)} style={{
                       width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                       border: selectedBooks.has(book.novel_id) ? '2px solid var(--danger)' : '2px solid var(--text-muted)',
                       backgroundColor: selectedBooks.has(book.novel_id) ? 'var(--danger)' : 'transparent',
                       cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                     }}>
                       {selectedBooks.has(book.novel_id) && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>✓</span>}
                     </div>
                   )}
                   <Link 
                     to={prog ? `/read/${book.novel_id}/${prog.chapter_id}` : `/novel/${book.novel_id}`} 
                     style={{ display: 'flex', gap: '1rem', textDecoration: 'none', color: 'inherit', position: 'relative', flex: 1, minWidth: 0 }}
                   >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img 
                        src={book.novel_cover || '/placeholder.png'} 
                        alt={book.novel_title} 
                        style={{ width: '64px', height: '88px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} 
                      />
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.4rem', paddingRight: '2rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {book.novel_title}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {book.novel_author}
                        <span style={{ margin: '0 4px', fontSize: '0.8rem', opacity: 0.5 }}>·</span>
                        {prog ? '继续阅读' : '未读过'}
                      </p>
                      {prog ? (
                         <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           进度: {prog.chapter_title}
                         </p>
                      ) : (
                         <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           连载中 · 刚刚更新
                         </p>
                      )}
                    </div>

                    {!manageMode && (
                      <div 
                        onClick={(e) => handleRemove(e, book.novel_id)}
                        style={{ position: 'absolute', top: '50%', right: '0', transform: 'translateY(-50%)', color: 'var(--text-secondary)', padding: '0.5rem' }}
                      >
                        <MoreHorizontal size={20} />
                      </div>
                    )}
                   </Link>
                 </div>
               );
            })}
          </div>
        )}

        {/* Batch Remove Bar */}
        {manageMode && selectedBooks.size > 0 && (
          <div style={{
            position: 'fixed', bottom: '70px', left: 0, right: 0, padding: '0.8rem 1rem',
            backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50
          }}>
            <span style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>已选择 {selectedBooks.size} 本</span>
            <button onClick={handleBatchRemove} style={{
              background: 'var(--danger)', border: 'none', borderRadius: '20px',
              padding: '0.5rem 1.5rem', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
            }}>批量移除</button>
          </div>
        )}
      </div>
    </div>
  );
}
