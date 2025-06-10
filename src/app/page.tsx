'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getDocs, QueryDocumentSnapshot, DocumentData, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal } from '@/types';
import { normalizeStore, normalizeStoreSync } from '@/services/storeService';
import { useAuth } from '@/contexts/AuthContext';
import { createPaginatedRecentDealsQuery, createRecentDealsCountQuery, createSearchQuery, filterDealsClientSide } from '@/utils/dealQueries';
import Header from '@/components/Header';
import OfferCard from '@/components/OfferCard';
import FeaturedCarousel from '@/components/FeaturedCarousel';
import MostViewedCarousel from '@/components/MostViewedCarousel';
import CategoryHighlights from '@/components/CategoryHighlights';
import FeaturedStores from '@/components/FeaturedStores';

const DEALS_PER_PAGE = 12;

function HomeContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Deal[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [searchLastDoc, setSearchLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [totalDeals, setTotalDeals] = useState(0);
  const [totalSearchResults, setTotalSearchResults] = useState(0);
  const [migrationsRun, setMigrationsRun] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

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

  // Migration function to add missing IDs and normalize data
  const migrateDeals = async (dealsToMigrate: Deal[]) => {
    if (!user) return; // Only migrate if user is authenticated
    
    const batch = writeBatch(db);
    let hasChanges = false;

    for (const deal of dealsToMigrate) {
      const docRef = doc(db, 'deals', deal.id);
      const updates: any = {};
      
      // Ensure store is normalized
      if (!deal.store || deal.store.id === 'unknown') {
        const normalizedStore = normalizeStoreSync(deal.purchaseLink || '');
        updates.store = normalizedStore;
        hasChanges = true;
      }

      // Add any other migrations here

      if (Object.keys(updates).length > 0) {
        batch.update(docRef, updates);
      }
    }

    if (hasChanges) {
      try {
        await batch.commit();
        console.log('Deals migration completed');
      } catch (error) {
        console.error('Error during deals migration:', error);
      }
    }
  };

  // Function to search deals in database
  const searchDeals = async (searchTerm: string, pageToFetch = 1, isNewSearch = true) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setTotalSearchResults(0);
      return;
    }

    try {
      setSearchLoading(true);
      
      let searchQuery;
      const lastDocToUse = isNewSearch ? null : searchLastDoc;
      
      // Use broader search by fetching more results and filtering client-side
      searchQuery = createSearchQuery(searchTerm, lastDocToUse, DEALS_PER_PAGE);

      const querySnapshot = await getDocs(searchQuery);
      const allDeals: Deal[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        allDeals.push({
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
          views: data.views || 0,
        });
      });

      // Filter results client-side for comprehensive search
      const filteredResults = filterDealsClientSide(allDeals, searchTerm);

      if (isNewSearch) {
        setSearchResults(filteredResults);
        setTotalSearchResults(filteredResults.length);
      } else {
        setSearchResults(prev => [...prev, ...filteredResults]);
      }

      setSearchLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setHasMoreSearch(querySnapshot.docs.length >= DEALS_PER_PAGE && filteredResults.length > 0);

    } catch (error) {
      console.error('Error searching deals:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchDeals = async (pageToFetch = 1, isNewSearch = false) => {
    try {
      setLoading(true);
      
      let dealsQuery;
      if (pageToFetch === 1 || isNewSearch) {
        dealsQuery = createPaginatedRecentDealsQuery(null, DEALS_PER_PAGE);
      } else {
        if (!lastDoc) return;
        dealsQuery = createPaginatedRecentDealsQuery(lastDoc, DEALS_PER_PAGE);
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
          views: data.views || 0,
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
        const totalQuery = createRecentDealsCountQuery();
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

  // Handle search when search term changes
  useEffect(() => {
    if (searchTerm.trim() !== '') {
      searchDeals(searchTerm, 1, true);
    } else {
      setSearchResults([]);
      setTotalSearchResults(0);
    }
  }, [searchTerm]);

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
    } else {
      // For search pagination, load more search results if needed
      const totalSearchPagesLoaded = Math.ceil(searchResults.length / DEALS_PER_PAGE);
      if (page > totalSearchPagesLoaded && hasMoreSearch) {
        searchDeals(searchTerm, page, false);
      }
    }
  };

  // Calculate pagination for search results or regular results
  const itemsToShow = searchTerm.trim() !== '' ? searchResults : deals;
  const totalItems = searchTerm.trim() !== '' ? totalSearchResults : totalDeals;
  const totalPages = Math.ceil(
    searchTerm.trim() !== '' 
      ? Math.max(totalSearchResults / DEALS_PER_PAGE, Math.ceil(searchResults.length / DEALS_PER_PAGE))
      : Math.max(totalDeals / DEALS_PER_PAGE, Math.ceil(deals.length / DEALS_PER_PAGE))
  );
  
  const startIndex = (currentPage - 1) * DEALS_PER_PAGE;
  const endIndex = startIndex + DEALS_PER_PAGE;
  const currentPageItems = itemsToShow.slice(startIndex, endIndex);

  // Show loading state for search or regular loading
  const isLoading = searchTerm.trim() !== '' ? searchLoading : loading;

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
                {totalItems} resultados
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
      {searchTerm.trim() === '' && (
        <div className="mb-12">
          <FeaturedCarousel />
        </div>
      )}
      
      {/* Most Viewed Carousel - Full width, only show on homepage without search */}
      {searchTerm.trim() === '' && (
        <div className="mb-16">
          <MostViewedCarousel />
        </div>
      )}
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Highlights - Only show on homepage without search */}
        {searchTerm.trim() === '' && (
          <div className="mb-16">
            <CategoryHighlights />
          </div>
        )}
        
        {/* Featured Stores - Only show on homepage without search */}
        {searchTerm.trim() === '' && (
          <div className="mb-16">
            <FeaturedStores />
          </div>
        )}
        
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900 mb-4">
            {searchTerm.trim() !== '' ? `Resultados para "${searchTerm}"` : 'Lo mas Reciente'}
          </h1>
          {searchTerm.trim() !== '' && (
            <p className="text-lg text-gray-600">
              {totalItems} ofertas encontradas
            </p>
          )}
        </div>

        {isLoading && (!hasLoadedOnce || itemsToShow.length === 0) ? (
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
        ) : hasLoadedOnce && !isLoading && itemsToShow.length === 0 ? (
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
