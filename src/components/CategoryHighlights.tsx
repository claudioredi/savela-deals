'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal } from '@/types';
import SmartImage from './SmartImage';

// Mapeo correcto basado en las categorías reales del sistema
const CATEGORY_CONFIG = {
  'electrónicos': {
    title: 'Lo mejor en Electrónicos',
    description: 'Smartphones, laptops y más',
    gradient: 'from-blue-500 to-purple-600',
    icon: '📱'
  },
  'moda': {
    title: 'Ofertas en Moda',
    description: 'Ropa, calzado y accesorios',
    gradient: 'from-pink-500 to-rose-600',
    icon: '👕'
  },
  'hogar': {
    title: 'Todo para el Hogar',
    description: 'Muebles, decoración y más',
    gradient: 'from-green-500 to-emerald-600',
    icon: '🏠'
  },
  'deportes': {
    title: 'Deportes y Fitness',
    description: 'Equipos y ropa deportiva',
    gradient: 'from-orange-500 to-red-600',
    icon: '⚽'
  },
  'belleza': {
    title: 'Belleza y Cuidado',
    description: 'Cosméticos y cuidado personal',
    gradient: 'from-purple-500 to-pink-600',
    icon: '💄'
  },
  'libros': {
    title: 'Libros y Educación',
    description: 'Conocimiento y entretenimiento',
    gradient: 'from-yellow-500 to-orange-600',
    icon: '📚'
  },
  'otros': {
    title: 'Otras Categorías',
    description: 'Ofertas variadas',
    gradient: 'from-violet-500 to-purple-600',
    icon: '🎯'
  }
};

export default function CategoryHighlights() {
  const [featuredCategories, setFeaturedCategories] = useState<Array<{
    category: string;
    config: any;
    deals: Deal[];
    avgScore: number;
    totalDeals: number;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategoryDeals = async () => {
      try {
        // Fetch all deals to analyze categories
        const allDealsQuery = query(
          collection(db, 'deals'),
          limit(500) // Increase limit to include more deals
        );

        const querySnapshot = await getDocs(allDealsQuery);
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
            unavailableReports: data.unavailableReports || 0
          });
        });

        // Log unique categories found for debugging
        const uniqueCategories = Array.from(new Set(allDeals.map(deal => deal.category)));
        console.log('Categorías encontradas en la base de datos:', uniqueCategories);

        // Normalize category names to fix inconsistencies
        const normalizeCategory = (category: string): string => {
          const normalizedMap: Record<string, string> = {
            'Tecnología': 'electrónicos',
            'Hogar': 'hogar',
            'Moda': 'moda',
            'Deportes': 'deportes',
            'Salud': 'otros', // Map to others since 'salud' is not in our official categories
            'Automóviles': 'otros',
            'Libros': 'libros',
            'Juguetes': 'otros',
            'Electrodomésticos': 'electrónicos',
            'Oficina': 'otros',
            'Belleza': 'belleza',
            'Otros': 'otros'
          };
          
          return normalizedMap[category] || category;
        };

        // Normalize all deal categories
        allDeals.forEach(deal => {
          deal.category = normalizeCategory(deal.category);
        });

        // Group deals by category
        const categoryMap = new Map<string, Deal[]>();
        allDeals.forEach(deal => {
          if (!categoryMap.has(deal.category)) {
            categoryMap.set(deal.category, []);
          }
          categoryMap.get(deal.category)!.push(deal);
        });

        // Log deals per category
        console.log('Deals por categoría:');
        categoryMap.forEach((deals, category) => {
          console.log(`${category}: ${deals.length} deals`);
          deals.forEach(deal => {
            console.log(`  - "${deal.title}": ${deal.upvotes} upvotes, ${deal.downvotes} downvotes, ${deal.discountPercentage || 0}% descuento`);
          });
        });

        // Calculate category stats and select top 3
        const categoryStats = Array.from(categoryMap.entries())
          .map(([category, deals]) => {
            // Calculate average score (only upvotes - downvotes)
            const totalScore = deals.reduce((sum, deal) => {
              const voteScore = (deal.upvotes || 0) - (deal.downvotes || 0);
              return sum + voteScore;
            }, 0);
            
            const avgScore = deals.length > 0 ? totalScore / deals.length : 0;
            
            // Sort deals by score for this category
            const sortedDeals = deals
              .map(deal => ({
                ...deal,
                score: (deal.upvotes || 0) - (deal.downvotes || 0)
              }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 3); // Top 3 deals

            const finalScore = avgScore * 2 + deals.length;
            
            return {
              category,
              config: CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG['otros'],
              deals: sortedDeals,
              avgScore,
              totalDeals: deals.length,
              finalScore
            };
          })
          .filter(cat => cat.totalDeals >= 1) // Only categories with at least 1 deal
          .sort((a, b) => {
            // Primary sort: by final score (descending)
            if (b.finalScore !== a.finalScore) {
              return b.finalScore - a.finalScore;
            }
            // Secondary sort: by category name (ascending) for consistency
            return a.category.localeCompare(b.category);
          });

        console.log('Puntuaciones de categorías:');
        categoryStats.forEach(cat => {
          console.log(`${cat.category}: ${cat.totalDeals} deals, avg score: ${cat.avgScore.toFixed(2)}, final score: ${cat.finalScore.toFixed(2)}`);
        });

        const topCategories = categoryStats.slice(0, 3); // Top 3 categories
        console.log('Top 3 categorías seleccionadas:', topCategories.map(c => c.category));
        
        setFeaturedCategories(topCategories);
      } catch (error) {
        console.error('Error fetching category deals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryDeals();
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleCategoryClick = (categoryName: string) => {
    // Navigate to search with category filter
    const searchParams = new URLSearchParams();
    searchParams.set('search', categoryName);
    window.location.href = `/?${searchParams.toString()}`;
  };

  const handleDealClick = (dealId: string) => {
    window.location.href = `/deal/${dealId}`;
  };

  if (loading) {
    return (
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-32 bg-gray-200 rounded-xl mb-4"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (featuredCategories.length === 0) {
    return null; // Don't show if no categories have enough deals
  }

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {featuredCategories.map((categoryData) => {
          const { category, config, deals } = categoryData;
          
          return (
            <div
              key={category}
              className="group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
              onClick={() => handleCategoryClick(category)}
            >
              {/* Header with gradient */}
              <div className={`bg-gradient-to-r ${config.gradient} p-6 text-white`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{config.icon}</span>
                  <div>
                    <h3 className="text-lg font-bold">{config.title}</h3>
                    <p className="text-white/90 text-sm">{config.description}</p>
                  </div>
                </div>
              </div>

              {/* Deals preview */}
              <div className="p-4">
                {deals.length > 0 ? (
                  <div className="space-y-3">
                    {deals.slice(0, 2).map((deal) => (
                      <div
                        key={deal.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDealClick(deal.id);
                        }}
                      >
                        {/* Deal Image */}
                        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                          {deal.imageUrl ? (
                            <SmartImage
                              src={deal.imageUrl}
                              alt={deal.title}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Deal Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {deal.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg font-bold text-blue-600">
                              {formatPrice(deal.currentPrice)}
                            </span>
                            {deal.discountPercentage && (
                              <span className="text-xs font-medium text-red-600">
                                -{deal.discountPercentage}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* View more button */}
                    <div className="pt-2 border-t border-gray-100">
                      <button
                        className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoryClick(category);
                        }}
                      >
                        Ver todas las ofertas →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">No hay ofertas disponibles</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 