import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Endereço do site publicado (ex.: 'https://santocacau.com.br/').
// Enquanto for null, o app usa o servidor local (npm run server, porta 3000).
export const PRODUCTION_SITE_URL = null;

export const SITE_PORT = 3000;

export const COLORS = {
  surface: '#fdf9f3',
  primary: '#26140d',
  secondary: '#735c00',
  onSurfaceVariant: '#4f4441',
};

// Resolve a URL do site para cada plataforma em desenvolvimento:
// - web: mesmo host do navegador;
// - celular (Expo Go): IP do computador que roda o Metro (hostUri);
// - emulador Android sem hostUri: 10.0.2.2 aponta para o computador.
export function getSiteUrl() {
  if (PRODUCTION_SITE_URL) return PRODUCTION_SITE_URL;

  if (Platform.OS === 'web') {
    return `${window.location.protocol}//${window.location.hostname}:${SITE_PORT}/`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  const host = hostUri ? hostUri.split(':')[0] : fallbackHost;
  return `http://${host}:${SITE_PORT}/`;
}
