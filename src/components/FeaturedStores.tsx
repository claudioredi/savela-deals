'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal } from '@/types';
import StoreIcon from './StoreIcon';

interface StoreStats {
  storeId: string;
  storeName: string;
  storeIcon: string;
  dealCount: number;
  totalVotes: number;
  averageDiscount: number;
  latestDeals: Deal[];
}

export default function FeaturedStores() {
  const [featuredStores, setFeaturedStores] = useState<StoreStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedStores = async () => {
      try {
        // Fetch all deals to analyze store statistics
        const dealsQuery = query(
          collection(db, 'deals'),
          orderBy('createdAt', 'desc'),
          limit(200) // Limit to recent deals for performance
        );

        const querySnapshot = await getDocs(dealsQuery);
        const allDeals: Deal[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.store && data.store.id !== 'unknown') {
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
              store: data.store,
              upvotes: data.upvotes || 0,
              downvotes: data.downvotes || 0,
              unavailableReports: data.unavailableReports || 0,
            });
          }
        });

        // Group deals by store and calculate statistics
        const storeMap = new Map<string, StoreStats>();

        allDeals.forEach((deal) => {
          const storeId = deal.store.id;
          const existing = storeMap.get(storeId);

          if (existing) {
            existing.dealCount += 1;
            existing.totalVotes += (deal.upvotes || 0) - (deal.downvotes || 0);
            if (deal.discountPercentage) {
              existing.averageDiscount = 
                (existing.averageDiscount * (existing.dealCount - 1) + deal.discountPercentage) / existing.dealCount;
            }
            existing.latestDeals.push(deal);
          } else {
            storeMap.set(storeId, {
              storeId,
              storeName: deal.store.name,
              storeIcon: deal.store.icon,
              dealCount: 1,
              totalVotes: (deal.upvotes || 0) - (deal.downvotes || 0),
              averageDiscount: deal.discountPercentage || 0,
              latestDeals: [deal],
            });
          }
        });

        // Log store statistics for debugging
        console.log('Stores encontrados:');
        storeMap.forEach((stats, storeId) => {
          console.log(`${stats.storeName} (${storeId}): ${stats.dealCount} deals, ${stats.totalVotes} votos`);
        });

        // Sort stores using same criteria as featured categories, take top 3
        const sortedStores = Array.from(storeMap.values())
          .filter(store => store.dealCount >= 1) // Only stores with at least 1 deal
          .sort((a, b) => {
            // Use same algorithm as featured categories: avgScore * 2 + totalDeals
            const avgScoreA = a.dealCount > 0 ? a.totalVotes / a.dealCount : 0;
            const avgScoreB = b.dealCount > 0 ? b.totalVotes / b.dealCount : 0;
            const finalScoreA = avgScoreA * 2 + a.dealCount;
            const finalScoreB = avgScoreB * 2 + b.dealCount;
            return finalScoreB - finalScoreA;
          })
          .slice(0, 3)
          .map(store => ({
            ...store,
            latestDeals: store.latestDeals
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, 3) // Keep only latest 3 deals
          }));

        setFeaturedStores(sortedStores);
      } catch (error) {
        console.error('Error fetching featured stores:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedStores();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleStoreClick = (storeName: string) => {
    // Navigate to search with store name
    const searchParams = new URLSearchParams();
    searchParams.set('search', storeName);
    window.location.href = `/?${searchParams.toString()}`;
  };

  const handleDealClick = (dealId: string) => {
    window.location.href = `/deal/${dealId}`;
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Stores Destacados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (featuredStores.length === 0 && !loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Stores Destacados</h2>
          <p className="text-sm text-gray-600">No hay stores destacados disponibles</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay stores destacados
          </h3>
          <p className="text-gray-600">
            Los stores aparecerán aquí cuando haya suficientes ofertas disponibles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Stores Destacados</h2>
        <p className="text-sm text-gray-600">Los stores con más ofertas populares</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {featuredStores.map((store) => (
          <div
            key={store.storeId}
            className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all duration-300 cursor-pointer overflow-hidden"
            onClick={() => handleStoreClick(store.storeName)}
          >
            {/* Store Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <StoreIcon 
                    icon={store.storeIcon} 
                    name={store.storeName} 
                    size="md" 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {store.storeName}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>{store.dealCount} ofertas</span>
                    {store.averageDiscount > 0 && (
                      <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                        ~{Math.round(store.averageDiscount)}% OFF
                      </span>
                    )}
                    {store.totalVotes > 0 && (
                      <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
                        +{store.totalVotes} votos
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Deals Preview */}
            <div className="p-4">
              <div className="space-y-2">
                {store.latestDeals.slice(0, 2).map((deal, index) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between text-sm hover:bg-gray-50 p-2 rounded-lg transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDealClick(deal.id);
                    }}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-medium text-gray-900 truncate">
                        {deal.title}
                      </p>
                      <p className="text-gray-500 text-xs truncate">
                        {deal.category}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="font-bold text-blue-600">
                        {formatPrice(deal.currentPrice)}
                      </div>
                      {deal.discountPercentage && (
                        <div className="text-xs text-red-600 font-medium">
                          -{deal.discountPercentage}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {store.latestDeals.length > 2 && (
                  <div className="text-center pt-2">
                    <span className="text-xs text-gray-500">
                      +{store.latestDeals.length - 2} ofertas más
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats Footer */}
            <div className="bg-gray-50 px-4 py-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Ver todas las ofertas</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 