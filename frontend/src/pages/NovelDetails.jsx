import { useState, useEffect } from 'react';
import { proxyAPI, bookshelfAPI, readingAPI } from '../api';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookmarkPlus, BookmarkCheck, BookOpen, Download, ArrowLeft } from 'lucide-react';

export default function NovelDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [novel, setNovel] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inBookshelf, setInBookshelf] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const [novelRes, chapRes] = await Promise.all([
          proxyAPI.getNovelDetails(id),
          proxyAPI.getChapters(id)
        ]);
        setNovel(novelRes.data);
        setChapters(chapRes.data.chapters || []);
        
        // If auth, check bookshelf — API returns { books: [...] }
        if (isAuthenticated) {
          try {
            const shelfRes = await bookshelfAPI.getBookshelf();
            const books = shelfRes.data.books || [];
            const inShelf = books.some(b => b.novel_id === id);
            setInBookshelf(inShelf);
          } catch (shelfErr) {
            console.warn("Could not check bookshelf status:", shelfErr);
          }
        }
      } catch (err) {
        console.error("Failed to fetch novel details", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id, isAuthenticated]);

  const handleBookshelfToggle = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      if (inBookshelf) {
        await bookshelfAPI.removeBook(id);
        setInBookshelf(false);
      } else {
        // Pass title, cover, AND author to addBook
        await bookshelfAPI.addBook(id, novel.title, novel.cover, novel.author);
        setInBookshelf(true);
      }
    } catch (err) {
      console.error("Failed to update bookshelf", err);
    }
  };

  const handleDownloadTxt = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      window.open(`/api/download/${id}`, "_blank");
    } catch (err) {
      console.error("Failed to initiate download", err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>加载中...</div>;
  if (!novel) return <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>未找到小说</div>;

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh' }}>
      {/* Top header with back button */}
      <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--text-main)' }}>
          <ArrowLeft size={24} />
        </button>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>小说详情</h3>
      </div>

      <div className="container" style={{ padding: '0 1rem' }}>
        {/* Novel Info Card */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flexShrink: 0, width: '120px' }}>
            {novel.cover ? (
              <img src={novel.cover} alt={novel.title} style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)' }} />
            )}
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>{novel.title}</h1>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{novel.author}</p>
            {novel.category && <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--primary)' }}>{novel.category}</p>}
          </div>
        </div>

        {/* Description */}
        {novel.description && (
          <p style={{ lineHeight: '1.8', marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {novel.description}
          </p>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3" style={{ flexWrap: 'wrap', marginBottom: '2rem' }}>
          {chapters.length > 0 && (
            <Link to={`/read/${id}/${chapters[0].chapter_id}`} className="btn-primary flex justify-center items-center gap-2" style={{ flex: 1, padding: '0.8rem', textDecoration: 'none', minWidth: '120px' }}>
              <BookOpen size={20} />
              开始阅读
            </Link>
          )}
          <button 
            onClick={handleBookshelfToggle} 
            className="flex justify-center items-center gap-2" 
            style={{ flex: 1, padding: '0.8rem', borderRadius: '20px', border: '1px solid var(--border-color)', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', minWidth: '120px' }}
          >
            {inBookshelf ? <><BookmarkCheck size={20} color="var(--primary)" /> 已加入书架</> : <><BookmarkPlus size={20} /> 加入书架</>}
          </button>
          <button 
            onClick={handleDownloadTxt} 
            className="flex justify-center items-center gap-2" 
            style={{ padding: '0.8rem', borderRadius: '20px', border: '1px solid var(--border-color)', fontWeight: 600, backgroundColor: 'var(--bg-secondary)' }}
            disabled={downloading}
          >
            <Download size={20} />
            {downloading ? '准备中...' : 'TXT'}
          </button>
        </div>

        {/* Chapter List */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
            目录（共 {chapters.length} 章）
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {chapters.map((ch) => (
              <Link 
                key={ch.chapter_id} 
                to={`/read/${id}/${ch.chapter_id}`}
                style={{ display: 'block', padding: '0.6rem 0.8rem', borderRadius: '6px', color: 'var(--text-main)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', backgroundColor: 'var(--bg-secondary)', fontSize: '0.9rem' }}
              >
                {ch.title}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
