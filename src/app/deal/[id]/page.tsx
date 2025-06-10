'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import SmartImage from '@/components/SmartImage';
import StoreIcon from '@/components/StoreIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useUserInteractions } from '@/hooks/useUserInteractions';
import Header from '@/components/Header';
import { useLoginPrompt } from '@/contexts/LoginPromptContext';
import { normalizeStoreSync } from '@/services/storeService';
import { trackDealView } from '@/services/viewsService';

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { showLoginPrompt } = useLoginPrompt();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { interaction, loading: interactionLoading, vote, reportUnavailable, unreportUnavailable } = useUserInteractions(
    user?.uid || null, 
    deal?.id || ''
  );

  const [isVoting, setIsVoting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  
  // Local state for optimistic updates
  const [localDeal, setLocalDeal] = useState<Deal | null>(null);
  const [localInteraction, setLocalInteraction] = useState(interaction);

  // Handle search functionality
  const handleSearch = (term: string) => {
    // Navigate to home page with search query
    if (term.trim()) {
      router.push(`/?search=${encodeURIComponent(term)}`);
    } else {
      router.push('/');
    }
  };

  useEffect(() => {
    const fetchDeal = async () => {
      if (!params.id) return;

      try {
        setLoading(true);
        const dealDoc = await getDoc(doc(db, 'deals', params.id as string));
        
        if (dealDoc.exists()) {
          const data = dealDoc.data();
          const dealData: Deal = {
            id: dealDoc.id,
            title: data.title,
            description: data.description,
            currentPrice: data.currentPrice,
            previousPrice: data.previousPrice,
            discountPercentage: data.discountPercentage,
            category: data.category,
            imageUrl: data.imageUrl,
            purchaseLink: data.purchaseLink,
            store: data.store || normalizeStoreSync(data.purchaseLink || ''),
            upvotes: data.upvotes || 0,
            downvotes: data.downvotes || 0,
            unavailableReports: data.unavailableReports || 0,
            views: data.views || 0,
            createdAt: data.createdAt?.toDate() || new Date(),
            createdBy: data.createdBy,
            createdByName: data.createdByName,
          };
          
          setDeal(dealData);
          setLocalDeal(dealData);
        } else {
          setError('Oferta no encontrada');
        }
      } catch (err) {
        console.error('Error fetching deal:', err);
        setError('Error al cargar la oferta');
      } finally {
        setLoading(false);
      }
    };

    fetchDeal();
  }, [params.id]);

  // Update local states when props change
  useEffect(() => {
    setLocalDeal(deal);
  }, [deal]);

  useEffect(() => {
    setLocalInteraction(interaction);
  }, [interaction]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!user) {
      showLoginPrompt('Para votar en las ofertas necesitas iniciar sesión');
      return;
    }
    
    if (isVoting || !localDeal) return;
    
    setIsVoting(true);
    
    // Calculate optimistic changes
    const currentVote = localInteraction?.vote;
    let upvoteChange = 0;
    let downvoteChange = 0;
    let newVote: 'up' | 'down' | undefined = voteType;

    if (currentVote === voteType) {
      // Removing vote
      if (voteType === 'up') upvoteChange = -1;
      else downvoteChange = -1;
      newVote = undefined;
    } else {
      // Adding or changing vote
      if (currentVote === 'up') upvoteChange = -1;
      if (currentVote === 'down') downvoteChange = -1;
      
      if (voteType === 'up') upvoteChange += 1;
      else downvoteChange += 1;
    }

    // Optimistic update - update UI immediately
    setLocalDeal(prev => prev ? {
      ...prev,
      upvotes: Math.max(0, (prev.upvotes || 0) + upvoteChange),
      downvotes: Math.max(0, (prev.downvotes || 0) + downvoteChange),
    } : null);

    setLocalInteraction(prev => ({
      id: `${user.uid}_${localDeal.id}`,
      userId: user.uid,
      dealId: localDeal.id,
      vote: newVote,
      reportedUnavailable: prev?.reportedUnavailable || false,
      createdAt: prev?.createdAt || new Date(),
      updatedAt: new Date(),
    }));

    try {
      await vote(voteType);
    } catch (error) {
      console.error('Error voting:', error);
      // Revert optimistic update on error
      setLocalDeal(deal);
      setLocalInteraction(interaction);
    } finally {
      setIsVoting(false);
    }
  };

  const handleReportUnavailable = async () => {
    if (!user) {
      showLoginPrompt('Para reportar ofertas como no disponibles necesitas iniciar sesión');
      return;
    }
    
    if (isReporting || !localDeal) return;

    // If already reported, unreport it
    if (localInteraction?.reportedUnavailable) {
      setIsReporting(true);
      
      // Optimistic update - update UI immediately
      setLocalDeal(prev => prev ? {
        ...prev,
        unavailableReports: Math.max(0, (prev.unavailableReports || 0) - 1),
      } : null);

      setLocalInteraction(prev => ({
        id: `${user!.uid}_${localDeal.id}`,
        userId: user!.uid,
        dealId: localDeal.id,
        vote: prev?.vote,
        reportedUnavailable: false,
        createdAt: prev?.createdAt || new Date(),
        updatedAt: new Date(),
      }));

      try {
        await unreportUnavailable();
      } catch (error) {
        console.error('Error unreporting:', error);
        // Revert optimistic update on error
        setLocalDeal(deal);
        setLocalInteraction(interaction);
      } finally {
        setIsReporting(false);
      }
    } else {
      // Show confirmation for reporting
      setShowReportConfirm(true);
    }
  };

  const confirmReport = async () => {
    if (!user || !localDeal) return;
    
    setShowReportConfirm(false);
    setIsReporting(true);
    
    // Optimistic update - update UI immediately
    setLocalDeal(prev => prev ? {
      ...prev,
      unavailableReports: (prev.unavailableReports || 0) + 1,
    } : null);

    setLocalInteraction(prev => ({
      id: `${user!.uid}_${localDeal.id}`,
      userId: user!.uid,
      dealId: localDeal.id,
      vote: prev?.vote,
      reportedUnavailable: true,
      createdAt: prev?.createdAt || new Date(),
      updatedAt: new Date(),
    }));

    try {
      await reportUnavailable();
    } catch (error) {
      console.error('Error reporting:', error);
      // Revert optimistic update on error
      setLocalDeal(deal);
      setLocalInteraction(interaction);
    } finally {
      setIsReporting(false);
    }
  };

  const handleViewOffer = async () => {
    if (!localDeal) return;
    
    // Track the view
    try {
      await trackDealView(localDeal.id);
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onSearch={handleSearch} searchValue="" />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="aspect-video bg-gray-200 rounded-lg mb-6"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !localDeal) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onSearch={handleSearch} searchValue="" />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {error || 'Oferta no encontrada'}
              </h3>
              <p className="text-gray-500 mb-6">
                La oferta que buscas no existe o ha sido eliminada.
              </p>
              <button
                onClick={() => router.push('/')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(localDeal.createdAt, { 
    addSuffix: true, 
    locale: es 
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onSearch={handleSearch} searchValue="" />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a ofertas
          </button>
        </nav>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with category and store */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {localDeal.category}
                </span>
                {localDeal.store && (
                  <div className="flex items-center gap-2">
                    <StoreIcon icon={localDeal.store.icon} name={localDeal.store.name} size="sm" />
                    <span className="text-sm font-medium text-gray-700">{localDeal.store.name}</span>
                  </div>
                )}
              </div>
              {localDeal.discountPercentage && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-500 text-white">
                  -{localDeal.discountPercentage}%
                </span>
              )}
            </div>
            
            {/* Title - Full without truncation */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {localDeal.title}
            </h1>

            {/* Price Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-gray-900">
                  {formatPrice(localDeal.currentPrice)}
                </div>
                {localDeal.previousPrice && (
                  <div className="text-lg text-gray-500 line-through">
                    {formatPrice(localDeal.previousPrice)}
                  </div>
                )}
              </div>
              <a
                href={localDeal.purchaseLink}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                onClick={handleViewOffer}
              >
                Ver Oferta
              </a>
            </div>
          </div>

          {/* Image */}
          <div className="relative aspect-video bg-white">
            {localDeal.imageUrl ? (
              <SmartImage
                src={localDeal.imageUrl}
                alt={localDeal.title}
                fill
                className="object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white">
                <div className="text-center text-gray-400">
                  <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg font-medium">Sin imagen</p>
                </div>
              </div>
            )}
          </div>

          {/* Description - Full without truncation */}
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Descripción</h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {localDeal.description || 'No hay descripción disponible.'}
            </div>
          </div>

          {/* Voting and Reporting Section */}
          <div className="p-6 border-t border-gray-100">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-6">
                {/* Upvote Button */}
                <button
                  onClick={() => handleVote('up')}
                  disabled={isVoting || interactionLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    localInteraction?.vote === 'up'
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-white text-gray-600 hover:bg-green-50 hover:text-green-600'
                  } ${(isVoting || interactionLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3v11z"/>
                  </svg>
                  <span>{localDeal.upvotes || 0}</span>
                </button>

                {/* Downvote Button */}
                <button
                  onClick={() => handleVote('down')}
                  disabled={isVoting || interactionLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    localInteraction?.vote === 'down'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-600'
                  } ${(isVoting || interactionLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13v4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3V2h3z"/>
                  </svg>
                  <span>{localDeal.downvotes || 0}</span>
                </button>
              </div>

              {/* Report Unavailable Button */}
              <button
                onClick={handleReportUnavailable}
                disabled={isReporting || interactionLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  localInteraction?.reportedUnavailable
                    ? 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'
                    : 'bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-600 border border-transparent'
                } ${(isReporting || interactionLoading) ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
                title={localInteraction?.reportedUnavailable ? 'Click para revertir el reporte' : 'Reportar que el enlace no funciona'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {localInteraction?.reportedUnavailable ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  )}
                </svg>
                <span>{localInteraction?.reportedUnavailable ? 'Reportado' : 'Enlace roto'}</span>
                {localDeal && localDeal.unavailableReports > 0 && (
                  <span className="text-sm">({localDeal.unavailableReports})</span>
                )}
              </button>
            </div>
          </div>

          {/* Footer with author and timestamp */}
          <div className="p-6 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-blue-600 font-medium">
                    {localDeal.createdByName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    Publicado por <span className="font-medium text-gray-900">{localDeal.createdByName}</span>
                  </p>
                  <p className="text-xs text-gray-500">{timeAgo}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Confirmation Modal */}
        {showReportConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowReportConfirm(false)}>
            <div className="bg-white rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center mb-4">
                <svg className="w-6 h-6 text-orange-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.866-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900">Reportar enlace roto</h3>
              </div>
              <p className="text-gray-600 mb-6">
                ¿Estás seguro de que quieres reportar que esta oferta no está disponible o el enlace no funciona?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowReportConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmReport}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
                >
                  Sí, reportar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 