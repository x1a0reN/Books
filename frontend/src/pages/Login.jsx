import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, User, Lock } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh' }}>
      {/* Top gradient banner */}
      <div style={{
        background: 'linear-gradient(180deg, #8b0000 0%, #111111 100%)',
        padding: '2rem 1.5rem 3rem',
        borderRadius: '0 0 32px 32px',
        textAlign: 'center'
      }}>
        <div onClick={() => navigate('/')} style={{ position: 'absolute', top: '1rem', left: '1rem', color: '#fff', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </div>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, #ff4d4f, #ff7875)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', fontWeight: 900, color: '#fff'
          }}>墨</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#fff', fontWeight: 700 }}>欢迎回来</h1>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>登录你的墨阅账号</p>
        </div>
      </div>

      {/* Form area */}
      <div style={{ padding: '2rem 1.5rem' }}>
        {error && (
          <div style={{
            background: 'rgba(255,77,79,0.1)', border: '1px solid rgba(255,77,79,0.3)',
            borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '1.5rem',
            color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center'
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username input */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              backgroundColor: 'var(--bg-secondary)', borderRadius: '14px',
              padding: '0 1rem', border: '1px solid transparent',
              transition: 'border-color 0.2s'
            }}>
              <User size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="请输入用户名" required
                style={{
                  flex: 1, padding: '0.9rem 0', border: 'none', outline: 'none',
                  backgroundColor: 'transparent', color: 'var(--text-main)',
                  fontSize: '0.95rem'
                }}
              />
            </div>
          </div>

          {/* Password input */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              backgroundColor: 'var(--bg-secondary)', borderRadius: '14px',
              padding: '0 1rem', border: '1px solid transparent',
              transition: 'border-color 0.2s'
            }}>
              <Lock size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码" required
                style={{
                  flex: 1, padding: '0.9rem 0', border: 'none', outline: 'none',
                  backgroundColor: 'transparent', color: 'var(--text-main)',
                  fontSize: '0.95rem'
                }}
              />
            </div>
          </div>

          {/* Submit button */}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '0.95rem',
            background: loading ? '#666' : 'linear-gradient(90deg, #ff4d4f, #ff7875)',
            border: 'none', borderRadius: '14px',
            color: '#fff', fontSize: '1rem', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.2s',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(255,77,79,0.3)'
          }}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        {/* Footer links */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            还没有账号？
            <Link to="/register" style={{ color: '#ff7875', fontWeight: 600, marginLeft: '4px' }}>立即注册</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

