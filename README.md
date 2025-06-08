# Savela - Comparte y Descubre Ofertas Increíbles

Savela es una aplicación web donde los usuarios pueden compartir y descubrir ofertas de productos durante todo el año. Construida con Next.js, Firebase y Tailwind CSS.

## Características

- Navega ofertas publicadas por la comunidad
- Comparte tus propias ofertas (requiere autenticación)
- Integración con Google Sign-in
- Diseño responsivo para todos los dispositivos
- Actualizaciones en tiempo real

## Tech Stack

- Next.js 14 with App Router
- TypeScript
- Firebase Authentication
- Firebase Firestore
- Tailwind CSS
- Heroicons
- date-fns

## Getting Started

1. Clona el repositorio:
```bash
git clone https://github.com/yourusername/savela.git
cd savela
```

2. Instala las dependencias:
```bash
npm install
```

3. Crea un proyecto de Firebase:
   - Ve a [Firebase Console](https://console.firebase.google.com)
   - Crea un nuevo proyecto
   - Habilita Authentication (Google Sign-in)
   - Crea una base de datos Firestore
   - Obtén tu configuración de Firebase

4. Crea un archivo `.env.local` en el directorio raíz con tu configuración de Firebase:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

5. Ejecuta el servidor de desarrollo:
```bash
npm run dev
```

6. Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Estructura del Proyecto

```
src/
├── app/                 # Páginas de Next.js App Router
├── components/          # Componentes React reutilizables
├── lib/                 # Funciones útiles y configuración de Firebase
└── types/              # Definiciones de tipos TypeScript
```

## Contribuir

1. Haz fork del repositorio
2. Crea tu rama de funcionalidad (`git checkout -b feature/nueva-funcionalidad`)
3. Confirma tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Sube la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
