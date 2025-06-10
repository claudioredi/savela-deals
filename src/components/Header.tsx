'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onSearch?: (searchTerm: string) => void;
  searchValue?: string;
}

export default function Header({ onSearch, searchValue = '' }: HeaderProps) {
  const { user, loading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(searchValue);
  const pathname = usePathname();

  useEffect(() => {
    setSearchTerm(searchValue);
  }, [searchValue]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch?.(value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchTerm);
  };

  const handleLogoClick = () => {
    // Clear search and return to home
    setSearchTerm('');
    onSearch?.('');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-3">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center" onClick={handleLogoClick}>
              <img
                src="/savela-logo.svg"
                alt="Savela"
                className="h-10 w-auto"
              />
            </Link>
          </div>

          {/* Search Bar - Always visible */}
          <div className="flex-1 max-w-2xl md:mx-8">
            <form onSubmit={handleSearchSubmit} className="w-full">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar ofertas..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                />
              </div>
            </form>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {user && (
                <Link
                  href="/post"
                  className={`group relative block px-6 py-3 text-base font-bold transition-all duration-300 transform ${
                    pathname === '/post' 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105'
                  } rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Publicar Oferta
                  </span>
                  {/* Shine effect */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-shine transition-opacity duration-500"></div>
                </Link>
              )}
            </div>
          </div>

          {/* User Menu */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              {loading ? (
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              ) : user ? (
                <div className="relative group">
                  <button
                    type="button"
                    className="flex items-center space-x-3 text-sm bg-white border border-gray-200 rounded-full p-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
                  >
                    <img
                      className="h-8 w-8 rounded-full"
                      src={user.photoURL || '/default-avatar.png'}
                      alt={user.displayName || 'Usuario'}
                    />
                    <span className="hidden sm:block text-gray-700 font-medium">
                      {user.displayName || user.email}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-lg border border-gray-200 py-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm text-gray-700 font-medium">{user.displayName}</p>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Link
                      href="/my-deals"
                      className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Mis Ofertas
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Iniciar Sesión
                </button>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex-shrink-0">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="bg-gray-50 p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50 rounded-lg mt-2">
              
              {user && (
                <Link
                  href="/post"
                  className={`group relative block px-6 py-3 text-base font-bold transition-all duration-300 transform ${
                    pathname === '/post' 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105'
                  } rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Publicar Oferta
                  </span>
                  {/* Shine effect */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 group-hover:animate-shine transition-opacity duration-500"></div>
                </Link>
              )}
              <div className="border-t border-gray-200 pt-4">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center px-3">
                      <img
                        className="h-10 w-10 rounded-full"
                        src={user.photoURL || '/default-avatar.png'}
                        alt={user.displayName || 'Usuario'}
                      />
                      <div className="ml-3">
                        <div className="text-base font-medium text-gray-800">{user.displayName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                    <Link
                      href="/my-deals"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Mis Ofertas
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar Sesión
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Iniciar Sesión
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
} 