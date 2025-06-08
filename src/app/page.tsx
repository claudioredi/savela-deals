'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal } from '@/types';
import { normalizeStore, normalizeStoreSync } from '@/services/storeService';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import OfferCard from '@/components/OfferCard';
import FeaturedCarousel from '@/components/FeaturedCarousel';
import CategoryHighlights from '@/components/CategoryHighlights';
import FeaturedStores from '@/components/FeaturedStores';

const DEALS_PER_PAGE = 12;

function HomeContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalDeals, setTotalDeals] = useState(0);
  const [migrationsRun, setMigrationsRun] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Initialize search term from URL params
  useEffect(() => {
    const searchFromUrl = searchParams.get('search');
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
    }
  }, [searchParams]);

  // Function to migrate stores asynchronously to database (only for authenticated users)
  const migrateStoresAsync = async (dealsToMigrate: Deal[]) => {
    if (!user) return; // Only migrate if user is authenticated
    
    for (const deal of dealsToMigrate) {
      if (deal.store && deal.store.id !== 'unknown') {
        try {
          // This will create the store in database if it doesn't exist
          await normalizeStore(deal.purchaseLink);
        } catch (error) {
          console.error(`Error migrating store for deal ${deal.id}:`, error);
        }
      }
    }
  };

  // Function to migrate old deals that don't have voting fields or store info (only for authenticated users)
  const migrateDeals = async (dealsToMigrate: Deal[]) => {
    if (!user) return; // Only migrate if user is authenticated
    
    const batch = writeBatch(db);
    let needsMigration = false;

    dealsToMigrate.forEach((deal) => {
      const needsUpdate = (
        deal.upvotes === undefined || 
        deal.downvotes === undefined || 
        deal.unavailableReports === undefined ||
        !deal.store
      );

      if (needsUpdate) {
        needsMigration = true;
        const dealRef = doc(db, 'deals', deal.id);
        const updateData: any = {
          upvotes: deal.upvotes || 0,
          downvotes: deal.downvotes || 0,
          unavailableReports: deal.unavailableReports || 0,
        };

        // Add store info if missing
        if (!deal.store) {
          updateData.store = normalizeStoreSync(deal.purchaseLink);
        }

        batch.update(dealRef, updateData);
      }
    });

    if (needsMigration) {
      try {
        await batch.commit();
        console.log('Deals migrated successfully');
      } catch (error) {
        console.error('Error migrating deals:', error);
      }
    }
  };

  const fetchDeals = async (pageToFetch = 1, isNewSearch = false) => {
    try {
      setLoading(true);
      
      let dealsQuery;
      if (pageToFetch === 1 || isNewSearch) {
        dealsQuery = query(
          collection(db, 'deals'),
          orderBy('createdAt', 'desc'),
          limit(DEALS_PER_PAGE)
        );
      } else {
        if (!lastDoc) return;
        dealsQuery = query(
          collection(db, 'deals'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(DEALS_PER_PAGE)
        );
      }

      const querySnapshot = await getDocs(dealsQuery);
      const newDeals: Deal[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        newDeals.push({
          id: doc.id,
          title: data.title,
          description: data.description,
          previousPrice: data.previousPrice,
          currentPrice: data.currentPrice,
          discountPercentage: data.discountPercentage,
          category: data.category,
          purchaseLink: data.purchaseLink,
          imageUrl: data.imageUrl,
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          store: data.store || normalizeStoreSync(data.purchaseLink || ''),
          upvotes: data.upvotes || 0,
          downvotes: data.downvotes || 0,
          unavailableReports: data.unavailableReports || 0,
        });
      });

      // Note: Migrations will be handled by useEffect when user is authenticated

      if (pageToFetch === 1 || isNewSearch) {
        setDeals(newDeals);
      } else {
        setDeals(prev => [...prev, ...newDeals]);
      }

      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMore(querySnapshot.docs.length === DEALS_PER_PAGE);

      // Update total count for pagination info
      if (pageToFetch === 1 || isNewSearch) {
        const totalQuery = query(collection(db, 'deals'));
        const totalSnapshot = await getDocs(totalQuery);
        setTotalDeals(totalSnapshot.size);
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
      if (!hasLoadedOnce) {
        setHasLoadedOnce(true);
      }
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  // Run migrations when user authenticates and we have deals (only once)
  useEffect(() => {
    if (user && deals.length > 0 && !migrationsRun) {
      const runMigrations = async () => {
        try {
          await migrateDeals(deals);
          await migrateStoresAsync(deals);
          setMigrationsRun(true);
        } catch (error) {
          console.error('Migration error:', error);
        }
      };
      runMigrations();
    }
  }, [user?.uid, deals.length, migrationsRun]); // Only trigger when user ID changes or we first get deals

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredDeals(deals);
    } else {
      const filtered = deals.filter(deal =>
        deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.createdByName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDeals(filtered);
    }
  }, [deals, searchTerm]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (searchTerm.trim() === '') {
      // For regular pagination, load more data if needed
      const totalPagesLoaded = Math.ceil(deals.length / DEALS_PER_PAGE);
      if (page > totalPagesLoaded && hasMore) {
        fetchDeals(page);
      }
    }
  };

  // Calculate pagination for search results or regular results
  const itemsToShow = searchTerm.trim() !== '' ? filteredDeals : deals;
  const totalPages = Math.ceil(
    searchTerm.trim() !== '' 
      ? filteredDeals.length / DEALS_PER_PAGE
      : Math.max(totalDeals / DEALS_PER_PAGE, Math.ceil(deals.length / DEALS_PER_PAGE))
  );
  
  const startIndex = (currentPage - 1) * DEALS_PER_PAGE;
  const endIndex = startIndex + DEALS_PER_PAGE;
  const currentPageItems = itemsToShow.slice(startIndex, endIndex);

  const Pagination = () => {
    if (totalPages <= 1) return null;

    const renderPageNumbers = () => {
      const pages = [];
      const maxPagesToShow = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

      if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }

      if (startPage > 1) {
        pages.push(
          <button
            key={1}
            onClick={() => handlePageChange(1)}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            1
          </button>
        );
        if (startPage > 2) {
          pages.push(<span key="ellipsis1" className="px-2 text-gray-400">...</span>);
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => handlePageChange(i)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              i === currentPage
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {i}
          </button>
        );
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push(<span key="ellipsis2" className="px-2 text-gray-400">...</span>);
        }
        pages.push(
          <button
            key={totalPages}
            onClick={() => handlePageChange(totalPages)}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            {totalPages}
          </button>
        );
      }

      return pages;
    };

    return (
      <div className="flex flex-col items-center space-y-4 mt-12">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              currentPage === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            Anterior
          </button>

          <div className="flex space-x-1">
            {renderPageNumbers()}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              currentPage === totalPages
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            Siguiente
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Página {currentPage} de {totalPages} • Mostrando {currentPageItems.length} ofertas
          {searchTerm.trim() !== '' && (
            <>
              {' de '}
              <button
                onClick={() => setSearchTerm('')}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {filteredDeals.length} resultados
              </button>
            </>
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onSearch={handleSearch} searchValue={searchTerm} />
      
      {/* Featured Carousel - Full width, only show on homepage without search */}
      {searchTerm.trim() === '' && <FeaturedCarousel />}
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Highlights - Only show on homepage without search */}
        {searchTerm.trim() === '' && <CategoryHighlights />}
        
        {/* Featured Stores - Only show on homepage without search */}
        {searchTerm.trim() === '' && <FeaturedStores />}
        
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900 mb-4">
            {searchTerm.trim() !== '' ? `Resultados para "${searchTerm}"` : 'Todas las Ofertas'}
          </h1>
          {searchTerm.trim() !== '' && (
            <p className="text-lg text-gray-600">
              {filteredDeals.length} ofertas encontradas
            </p>
          )}
        </div>

        {loading && (!hasLoadedOnce || deals.length === 0) ? (
          // Show skeleton loading
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-200"></div>
                <div className="p-6 space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : currentPageItems.length > 0 ? (
          // Show deals
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentPageItems.map((deal) => (
                <OfferCard key={deal.id} deal={deal} />
              ))}
            </div>
            <Pagination />
          </>
        ) : hasLoadedOnce && !loading && deals.length === 0 ? (
          // Show empty state only when we're sure there are no deals
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {searchTerm.trim() !== '' ? 'No se encontraron ofertas' : 'No hay ofertas disponibles'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchTerm.trim() !== '' 
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Sé el primero en compartir una oferta increíble'
                }
              </p>
              {searchTerm.trim() !== '' && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Ver todas las ofertas
                </button>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse">
          <div className="h-16 bg-gray-200 mb-8"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="aspect-video bg-gray-200"></div>
                  <div className="p-6 space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
