'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal, DEAL_CATEGORIES } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import SmartImage from '@/components/SmartImage';
import StoreIcon from '@/components/StoreIcon';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { normalizeStoreSync } from '@/services/storeService';

export default function MyDealsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    currentPrice: 0,
    previousPrice: 0,
    category: '',
    imageUrl: '',
    purchaseLink: ''
  });
  const [saving, setSaving] = useState(false);

  // Handle search functionality
  const handleSearch = (term: string) => {
    if (term.trim()) {
      router.push(`/?search=${encodeURIComponent(term)}`);
    } else {
      router.push('/');
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    const fetchMyDeals = async () => {
      try {
        setLoading(true);
        const dealsRef = collection(db, 'deals');
        const q = query(
          dealsRef, 
          where('createdBy', '==', user.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const dealsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
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
          } as Deal;
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setDeals(dealsData);
      } catch (error) {
        console.error('Error fetching my deals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyDeals();
  }, [user, router]);

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setEditForm({
      title: deal.title,
      description: deal.description,
      currentPrice: deal.currentPrice,
      previousPrice: deal.previousPrice || 0,
      category: deal.category,
      imageUrl: deal.imageUrl || '',
      purchaseLink: deal.purchaseLink
    });
  };

  const handleSave = async () => {
    if (!editingDeal) return;

    try {
      setSaving(true);
      
      // Calculate discount percentage
      const discountPercentage = editForm.previousPrice > editForm.currentPrice 
        ? Math.round(((editForm.previousPrice - editForm.currentPrice) / editForm.previousPrice) * 100)
        : undefined;

      const updateData = {
        title: editForm.title,
        description: editForm.description,
        currentPrice: editForm.currentPrice,
        previousPrice: editForm.previousPrice > 0 ? editForm.previousPrice : null,
        discountPercentage,
        category: editForm.category,
        imageUrl: editForm.imageUrl || null,
        purchaseLink: editForm.purchaseLink,
        store: normalizeStoreSync(editForm.purchaseLink),
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'deals', editingDeal.id), updateData);

      // Update local state - convert null to undefined for Deal type compatibility
      setDeals(deals.map(deal => 
        deal.id === editingDeal.id 
          ? { 
              ...deal, 
              title: editForm.title,
              description: editForm.description,
              currentPrice: editForm.currentPrice,
              previousPrice: editForm.previousPrice > 0 ? editForm.previousPrice : undefined,
              discountPercentage,
              category: editForm.category,
              imageUrl: editForm.imageUrl || undefined,
              purchaseLink: editForm.purchaseLink,
              store: normalizeStoreSync(editForm.purchaseLink)
            }
          : deal
      ));

      setEditingDeal(null);
    } catch (error) {
      console.error('Error updating deal:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dealId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta oferta?')) return;

    try {
      await deleteDoc(doc(db, 'deals', dealId));
      setDeals(deals.filter(deal => deal.id !== dealId));
    } catch (error) {
      console.error('Error deleting deal:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onSearch={handleSearch} searchValue="" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-6">
                  <div className="aspect-video bg-gray-200 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onSearch={handleSearch} searchValue="" />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mis Ofertas</h1>
          <p className="text-gray-600 mt-2">
            Gestiona las ofertas que has publicado ({deals.length} oferta{deals.length !== 1 ? 's' : ''})
          </p>
        </div>

        {deals.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1H7a1 1 0 00-1 1v1m7 4v2m0 0v2m0-2h2m-2 0H9m3 5l-3 3 3 3" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                No has publicado ofertas aún
              </h3>
              <p className="text-gray-500 mb-6">
                Cuando publiques ofertas, aparecerán aquí para que puedas editarlas.
              </p>
              <button
                onClick={() => router.push('/')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Explorar Ofertas
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deals.map((deal) => (
              <div key={deal.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Image */}
                <div className="relative aspect-[3/2] bg-gray-100 overflow-hidden">
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
                  
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {deal.discountPercentage && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-500 text-white">
                        -{deal.discountPercentage}%
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {deal.category}
                    </span>
                  </div>

                  {/* Store */}
                  {deal.store && (
                    <div className="absolute bottom-3 left-3">
                      <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-sm">
                        <StoreIcon icon={deal.store.icon} name={deal.store.name} size="sm" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
                    {deal.title}
                  </h3>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {deal.description}
                  </p>

                  {/* Price */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-xl font-bold text-gray-900">
                      {formatPrice(deal.currentPrice)}
                    </div>
                    {deal.previousPrice && (
                      <div className="text-sm text-gray-500 line-through">
                        {formatPrice(deal.previousPrice)}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3v11z"/>
                      </svg>
                      <span>{deal.upvotes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13v4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3V2h3z"/>
                      </svg>
                      <span>{deal.downvotes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatDistanceToNow(deal.createdAt, { addSuffix: true, locale: es })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(deal)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => router.push(`/deal/${deal.id}`)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      Ver
                    </button>
                    <button
                      onClick={() => handleDelete(deal.id)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 font-medium py-2 px-3 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Editar Oferta</h2>
                <button
                  onClick={() => setEditingDeal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Título de la oferta"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Describe la oferta"
                  />
                </div>

                {/* Prices */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio Actual *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={editForm.currentPrice}
                      onChange={(e) => setEditForm({ ...editForm, currentPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio Anterior
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.previousPrice}
                      onChange={(e) => setEditForm({ ...editForm, previousPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoría *
                  </label>
                  <select
                    required
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecciona una categoría</option>
                    {Object.entries(DEAL_CATEGORIES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL de Imagen
                  </label>
                  <input
                    type="url"
                    value={editForm.imageUrl}
                    onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>

                {/* Purchase Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enlace de Compra *
                  </label>
                  <input
                    type="url"
                    required
                    value={editForm.purchaseLink}
                    onChange={(e) => setEditForm({ ...editForm, purchaseLink: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://tienda.com/producto"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingDeal(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 