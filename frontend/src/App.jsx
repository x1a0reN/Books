import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Book, Search, User, Compass, Library } from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import NovelDetails from './pages/NovelDetails';
import ReadChapter from './pages/ReadChapter';
import Bookshelf from './pages/Bookshelf';
import Category from './pages/Category';
import CategoryView from './pages/CategoryView';
import Profile from './pages/Profile';

function BottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const { isAuthenticated } = useAuth();

  // Don't show bottom nav on reading, novel details, login, register, or profile
  if (path.startsWith('/read/') || path.startsWith('/novel/') || path.startsWith('/category/') || path === '/login' || path === '/register' || path === '/profile') {
    return null;
  }

  const navItems = [
    { path: '/', label: '书城', icon: Book },
    { path: '/category', label: '发现', icon: Compass },
    { path: '/bookshelf', label: '书架', icon: Library },
    { path: isAuthenticated ? '/profile' : '/login', label: '我', icon: User }
  ];

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = path === item.path || (item.path === '/login' && path === '/register');
        return (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function App() {
  useEffect(() => {
    // Force dark theme as default for mobile app feel
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1 }} className="pb-nav">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/novel/:id" element={<NovelDetails />} />
          <Route path="/category" element={<Category />} />
          <Route path="/category/:id" element={<CategoryView />} />
          <Route path="/read/:novelId/:chapterId" element={<ReadChapter />} />
          <Route path="/bookshelf" element={<Bookshelf />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

export default App;
