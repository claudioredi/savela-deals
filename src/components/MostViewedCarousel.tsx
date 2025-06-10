'use client';

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal } from '@/types';
import SmartImage from './SmartImage';

export default function MostViewedCarousel() {
  const [mostViewedDeals, setMostViewedDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerSlide, setItemsPerSlide] = useState(3);

  const getItemsPerSlide = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 1; // Mobile: 1 item
      if (window.innerWidth < 768) return 2; // Small tablets: 2 items
      if (window.innerWidth < 1024) return 3; // Medium tablets: 3 items
      if (window.innerWidth < 1280) return 4; // Small desktop: 4 items
      if (window.innerWidth < 1536) return 5; // Large desktop: 5 items
      return 6; // Extra large desktop: 6 items
    }
    return 6;
  };

  useEffect(() => {
    setItemsPerSlide(getItemsPerSlide());
  }, []);

  useEffect(() => {
    const fetchMostViewedDeals = async () => {
      try {
        // Fetch deals with most views from the last 2 months
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

        const dealsQuery = query(
          collection(db, 'deals'),
          where('createdAt', '>=', twoMonthsAgo),
          limit(200) // Get more deals to filter and sort properly
        );

        const querySnapshot = await getDocs(dealsQuery);
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
            store: data.store,
            upvotes: data.upvotes || 0,
            downvotes: data.downvotes || 0,
            unavailableReports: data.unavailableReports || 0,
            views: data.views || 0,
          });
        });

        // Sort by views (descending) and take top 6
        const sortedByViews = allDeals
          .filter(deal => (deal.views || 0) > 0) // Only include deals with views
          .sort((a, b) => (b.views || 0) - (a.views || 0))
          .slice(0, 6); // Take top 6

        setMostViewedDeals(sortedByViews);
      } catch (error) {
        console.error('Error fetching most viewed deals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMostViewedDeals();
  }, []);

  // Handle responsive resize
  useEffect(() => {
    const handleResize = () => {
      const newItemsPerSlide = getItemsPerSlide();
      if (newItemsPerSlide !== itemsPerSlide) {
        setItemsPerSlide(newItemsPerSlide);
        setCurrentIndex(0); // Reset to first slide when changing layout
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [itemsPerSlide]);

  const totalSlides = Math.floor(mostViewedDeals.length / itemsPerSlide);

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === totalSlides - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? totalSlides - 1 : prevIndex - 1
    );
  };

  const handleDealClick = (dealId: string) => {
    window.location.href = `/deal/${dealId}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };



  if (loading) {
    return (
      <div className="relative overflow-hidden bg-gradient-to-b from-purple-700/90 via-purple-600/70 via-purple-500/40 via-purple-300/20 to-gray-50 px-4 sm:px-6 lg:px-8 pt-12 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Más Visitadas</h2>
          </div>
          <div className="overflow-hidden px-8">
            <div className="flex gap-6">
              {[...Array(itemsPerSlide)].map((_, i) => (
                <div key={i} className="flex-1 min-w-0 bg-white/20 rounded-xl p-4 animate-pulse">
                  <div className="aspect-[3/2] bg-white/30 rounded-lg mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-white/30 rounded w-full"></div>
                    <div className="h-4 bg-white/30 rounded w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mostViewedDeals.length === 0) {
    return null; // Don't show carousel if no viewed deals
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-purple-700/90 via-purple-600/70 via-purple-500/40 via-purple-300/20 to-gray-50 px-4 sm:px-6 lg:px-8 pt-12 pb-16 mb-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Más Visitadas</h2>
          <p className="text-white/90 text-sm mt-1">Las ofertas que más llaman la atención</p>
        </div>

        <div className="relative">
          {/* Navigation arrows */}
          {totalSlides > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                aria-label="Anterior"
              >
                <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110"
                aria-label="Siguiente"
              >
                <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          
          {/* Contenedor con overflow hidden para ocultar slides no activos */}
          <div className="overflow-hidden">
            <div 
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {Array.from({ length: totalSlides }).map((_, slideIndex) => (
                <div
                  key={slideIndex}
                  className="w-full flex-shrink-0 min-w-0"
                >
                  <div className="flex gap-6 px-8">
                    {mostViewedDeals.slice(
                      slideIndex * itemsPerSlide, 
                      slideIndex * itemsPerSlide + itemsPerSlide
                    ).map((deal) => (
                      <div
                        key={deal.id}
                        onClick={() => handleDealClick(deal.id)}
                        className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 flex-1 min-w-0"
                      >
                        {/* Image */}
                        <div className="relative aspect-[3/2] bg-gray-100">
                          {deal.imageUrl ? (
                            <SmartImage
                              src={deal.imageUrl}
                              alt={deal.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                              <div className="text-center text-gray-400">
                                <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p className="text-sm font-medium">Sin imagen</p>
                              </div>
                            </div>
                          )}



                          {/* Discount badge */}
                          {deal.discountPercentage && (
                            <div className="absolute top-3 right-3">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-500 text-white shadow-lg">
                                -{deal.discountPercentage}%
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Title and Price */}
                        <div className="p-4">
                          <h3 className="text-base font-bold text-gray-900 line-clamp-2 leading-tight mb-2">
                            {deal.title}
                          </h3>
                          <div className="flex items-center">
                            <span className="text-xl font-bold text-purple-600">
                              {formatPrice(deal.currentPrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 