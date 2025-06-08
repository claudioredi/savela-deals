import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Firebase config (you should use your actual config)
const firebaseConfig = {
  // Add your Firebase config here when running the script
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Popular stores to seed the database
const SEED_STORES = [
  {
    id: 'mercadolibre.com',
    name: 'Mercado Libre',
    icon: '🛒',
    domain: 'mercadolibre.com',
    color: '#FFE600'
  },
  {
    id: 'amazon.com',
    name: 'Amazon',
    icon: '📦',
    domain: 'amazon.com',
    color: '#FF9900'
  },
  {
    id: 'tiendamia.com',
    name: 'Tiendamia',
    icon: '🛍️',
    domain: 'tiendamia.com',
    color: '#E91E63'
  },
  {
    id: 'linio.com',
    name: 'Linio',
    icon: '🏪',
    domain: 'linio.com',
    color: '#FF6B35'
  },
  {
    id: 'falabella.com',
    name: 'Falabella',
    icon: '🏬',
    domain: 'falabella.com',
    color: '#008C45'
  },
  {
    id: 'ripley.com',
    name: 'Ripley',
    icon: '🏢',
    domain: 'ripley.com',
    color: '#D32F2F'
  },
  {
    id: 'paris.cl',
    name: 'Paris',
    icon: '🎀',
    domain: 'paris.cl',
    color: '#E91E63'
  },
  {
    id: 'sodimac.com',
    name: 'Sodimac',
    icon: '🔨',
    domain: 'sodimac.com',
    color: '#FF5722'
  },
  {
    id: 'easy.com',
    name: 'Easy',
    icon: '🏠',
    domain: 'easy.com',
    color: '#4CAF50'
  },
  {
    id: 'pcfactory.cl',
    name: 'PC Factory',
    icon: '💻',
    domain: 'pcfactory.cl',
    color: '#2196F3'
  }
];

async function seedStores() {
  console.log('Starting to seed stores...');
  
  for (const store of SEED_STORES) {
    try {
      await setDoc(doc(db, 'stores', store.id), {
        ...store,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Created store: ${store.name}`);
    } catch (error) {
      console.error(`❌ Error creating store ${store.name}:`, error);
    }
  }
  
  console.log('Finished seeding stores!');
}

// Run the seeding function
seedStores().catch(console.error); 