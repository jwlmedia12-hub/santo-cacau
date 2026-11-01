import { StyleSheet, View } from 'react-native';

import { COLORS } from '../config';

// Versão web: a WebView não existe no navegador, então o site é exibido
// em um iframe de tela cheia.
export default function SiteView({ uri }) {
  return (
    <View style={styles.container}>
      <iframe src={uri} title="Santo Cacau" style={iframeStyle} />
    </View>
  );
}

const iframeStyle = {
  border: 0,
  width: '100%',
  height: '100%',
  backgroundColor: COLORS.surface,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
});
