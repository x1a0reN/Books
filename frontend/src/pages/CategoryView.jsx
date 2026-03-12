import { useState, useEffect } from 'react';
import { proxyAPI } from '../api';
import { Link, useParams } from 'react-router-dom';

export default function CategoryView() {
  const { id } = useParams();
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [categoryName, setCategoryName] = useState('');

  const categoryNames = {
    '1': '玄幻', '2': '奇幻', '3': '都市', '4': '历史',
    '5': '科幻', '6': '游戏', '7': '言情', '8': '武侠',
    '9': '古言', '10': '悬疑', '11': '同人', '12': '轻小说'
  };

  useEffect(() => {
    setCategoryName(categoryNames[id] || `分类 ${id}`);
    const fetchNovels = async () => {
      setLoading(true);
      try {
        const res = await proxyAPI.getCategoryNovels(id, page);
        setNovels(res.data.novels || []);
      } catch (err) {
        console.error("Failed to fetch category novels:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNovels();
  }, [id, page]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1) {
      setPage(newPage);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>{categoryName}</h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>加载中...</div>
      ) : novels.length === 0 ? (
        <div className="card glass" style={{ textAlign: 'center', padding: '3rem' }}>暂无小说</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1.5rem' }}>
            {novels.map((book, idx) => (
              <Link key={idx} to={`/novel/${book.novel_id}`} className="card glass flex flex-col gap-2" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ aspectRatio: '3/4', overflow: 'hidden', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)' }}>
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <div className="flex justify-center items-center" style={{ height: '100%', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>暂无封面</div>
                  )}
                </div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</h4>
                <p className="text-secondary" style={{ margin: 0, fontSize: '0.8rem' }}>{book.author}</p>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-4" style={{ marginTop: '2rem' }}>
            <button
              onClick={() => handlePageChange(page - 1)}
              className="glass"
              disabled={page <= 1}
              style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
            >
              上一页
            </button>
            <span style={{ fontWeight: 600 }}>第 {page} 页</span>
            <button
              onClick={() => handlePageChange(page + 1)}
              className="glass"
              disabled={novels.length < 10}
              style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', opacity: novels.length < 10 ? 0.4 : 1, cursor: novels.length < 10 ? 'not-allowed' : 'pointer' }}
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  );
}
