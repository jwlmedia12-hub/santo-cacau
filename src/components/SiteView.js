import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  Linking,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { COLORS } from '../config';

// Links que devem abrir fora do app (telefone, e-mail, WhatsApp, mapas...).
const EXTERNAL_SCHEMES = /^(tel|mailto|sms|whatsapp|geo|intent):/i;

function isExternal(url, siteUri) {
  if (EXTERNAL_SCHEMES.test(url)) return true;
  if (!/^https?:/i.test(url)) return false;
  try {
    return new URL(url).host !== new URL(siteUri).host;
  } catch {
    return false;
  }
}

// Versão nativa (Android/iOS): exibe o site dentro de uma WebView.
export default function SiteView({ uri }) {
  const webviewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState(null);

  // Informa ao site que ele roda no app. No iOS o site aplica o tamanho de
  // fonte do sistema; no Android isso é feito pelo textZoom da WebView.
  const fontScale = PixelRatio.getFontScale();
  const injected = `window.SantoCacauApp = ${JSON.stringify({
    platform: Platform.OS,
    fontScale: Platform.OS === 'ios' ? fontScale : 1,
    tts: true,
  })}; true;`;

  // Botão "voltar" do Android navega dentro do site antes de fechar o app.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webviewRef.current) {
        webviewRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  useEffect(() => () => Speech.stop(), []);

  const retry = useCallback(() => {
    setError(null);
    webviewRef.current?.reload();
  }, []);

  // Mensagens do site: leitura em voz alta (a WebView do Android não tem
  // síntese de voz própria) e avisos para o leitor de tela do sistema.
  const onMessage = useCallback((event) => {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'tts:speak' && typeof msg.text === 'string') {
      Speech.stop();
      Speech.speak(msg.text.slice(0, 20000), { language: 'pt-BR', rate: msg.rate || 1 });
    } else if (msg.type === 'tts:stop') {
      Speech.stop();
    } else if (msg.type === 'announce' && typeof msg.text === 'string') {
      AccessibilityInfo.announceForAccessibility(msg.text);
    }
  }, []);

  const onShouldStartLoadWithRequest = useCallback(
    (request) => {
      if (request.isTopFrame === false) return true;
      if (isExternal(request.url, uri)) {
        Linking.openURL(request.url).catch(() => {});
        return false;
      }
      return true;
    },
    [uri]
  );

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.title} accessibilityRole="header">
          Não foi possível abrir a Santo Cacau
        </Text>
        <Text style={styles.message} accessibilityLiveRegion="polite">
          {error}
        </Text>
        <Text style={styles.message}>Verifique sua conexão com a internet e tente de novo.</Text>
        {__DEV__ ? <Text style={styles.message}>Endereço: {uri}</Text> : null}
        <Pressable
          style={styles.button}
          onPress={retry}
          accessibilityRole="button"
          accessibilityHint="Recarrega o site da Santo Cacau"
        >
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <WebView
      ref={webviewRef}
      source={{ uri }}
      style={styles.webview}
      originWhitelist={['*']}
      startInLoadingState
      renderLoading={() => (
        <View style={styles.center} accessible accessibilityLabel="Carregando a Santo Cacau">
          <ActivityIndicator size="large" color={COLORS.secondary} />
        </View>
      )}
      injectedJavaScriptBeforeContentLoaded={injected}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
      onError={({ nativeEvent }) => setError(nativeEvent.description || 'Erro de conexão.')}
      // Respeita o tamanho de fonte escolhido no Android (acessibilidade).
      textZoom={Math.round(fontScale * 100)}
      domStorageEnabled
      javaScriptEnabled
      sharedCookiesEnabled
      allowsBackForwardNavigationGestures
      allowsInlineMediaPlayback
      pullToRefreshEnabled
      setSupportMultipleWindows={false}
      dataDetectorTypes="none"
      webviewDebuggingEnabled={__DEV__}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: COLORS.surface,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: COLORS.onSurfaceVariant,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
