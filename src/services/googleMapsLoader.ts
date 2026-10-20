/* ============================================
   GOOGLE MAPS JAVASCRIPT API SINGLETON LOADER
   Loads the official Google Maps SDK dynamically with places & geometry
   ============================================ */

declare global {
  interface Window {
    google: typeof google;
  }
}

let loadPromise: Promise<typeof google> | null = null;

export interface GoogleMapsLoadOptions {
  apiKey?: string;
  libraries?: string[];
}

export function loadGoogleMaps(options: GoogleMapsLoadOptions = {}): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is undefined'));
  }

  // Already loaded globally
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google);
  }

  // Reuse ongoing loader promise
  if (loadPromise) {
    return loadPromise;
  }

  const apiKey = options.apiKey || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  if (!apiKey) {
    return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY in environment variables.'));
  }

  const libraries = options.libraries || ['places', 'geometry'];

  loadPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists
    const existingScript = document.getElementById('google-maps-sdk-script') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google));
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-sdk-script';
    script.type = 'text/javascript';
    script.async = true;
    script.defer = true;
    
    // Global callback for clean resolution
    const callbackName = `__initGoogleMaps_${Date.now()}`;
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      delete (window as unknown as Record<string, () => void>)[callbackName];
      resolve(window.google);
    };

    const libString = libraries.join(',');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=${libString}&callback=${callbackName}`;

    script.onerror = (err) => {
      delete (window as unknown as Record<string, () => void>)[callbackName];
      loadPromise = null;
      reject(new Error(`Failed to load Google Maps script: ${err}`));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function isGoogleMapsLoaded(): boolean {
  return typeof window !== 'undefined' && !!(window.google && window.google.maps);
}
