import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, LogOut, BookOpen, Clock, Settings } from 'lucide-react';

export default function Profile() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { icon: BookOpen, label: '我的书架', desc: '查看收藏的小说', onClick: () => navigate('/bookshelf') },
    { icon: Clock, label: '阅读记录', desc: '查看最近阅读', onClick: () => navigate('/bookshelf') },
    { icon: Settings, label: '设置', desc: '账号与偏好设置', onClick: () => {} },
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', paddingBottom: '5rem' }}>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(180deg, #8b0000 0%, #111111 100%)',
        padding: '2rem 1.5rem 2.5rem',
        borderRadius: '0 0 32px 32px'
      }}>
        <div onClick={() => navigate(-1)} style={{ color: '#fff', cursor: 'pointer', marginBottom: '1rem' }}>
          <ArrowLeft size={24} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff4d4f, #ff7875)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 900, color: '#fff', flexShrink: 0
          }}>
            {user?.username?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff', fontWeight: 700 }}>
              {user?.username || '用户'}
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
              墨阅会员
            </p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div style={{ padding: '1.5rem' }}>
        <div style={{
          backgroundColor: 'var(--bg-secondary)', borderRadius: '16px',
          overflow: 'hidden'
        }}>
          {menuItems.map((item, idx) => (
            <div
              key={idx}
              onClick={item.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '1rem 1.25rem', cursor: 'pointer',
                borderBottom: idx < menuItems.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'
              }}
            >
              <item.icon size={20} style={{ color: '#ff7875', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc}</div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>›</span>
            </div>
          ))}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{
          width: '100%', marginTop: '2rem', padding: '0.9rem',
          backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(255,77,79,0.3)',
          borderRadius: '14px', color: '#ff6b6b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer'
        }}>
          <LogOut size={18} />
          退出登录
        </button>
      </div>
    </div>
  );
}
