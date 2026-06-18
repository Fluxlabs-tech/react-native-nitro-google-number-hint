import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  isPhoneNumberHintAvailable,
  requestPhoneNumberHint,
  parsePhoneNumber,
  type PhoneNumberHintResult,
} from '@fluxlabs/react-native-nitro-google-number-hint';

function App(): React.JSX.Element {
  const [available] = React.useState(isPhoneNumberHintAvailable);
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<PhoneNumberHintResult | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  const onPress = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await requestPhoneNumberHint());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Google Phone Number Hint</Text>
      <Text style={styles.subtitle}>
        Available on this device: {available ? 'yes' : 'no'}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          (!available || loading) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        disabled={!available || loading}
        onPress={onPress}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Pick a phone number</Text>
        )}
      </Pressable>

      {result != null && (
        <View style={styles.resultBox}>
          <Text style={styles.resultStatus}>Status: {result.status}</Text>
          {result.phoneNumber != null &&
            (() => {
              const parts = parsePhoneNumber(result.phoneNumber);
              return (
                <>
                  <Text style={styles.resultNumber}>{parts.e164}</Text>
                  <Text style={styles.resultParts}>
                    country code: +{parts.countryCallingCode} · national:{' '}
                    {parts.nationalNumber}
                  </Text>
                </>
              );
            })()}
        </View>
      )}

      {error != null && <Text style={styles.error}>Error: {error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666' },
  button: {
    backgroundColor: '#1a73e8',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    minWidth: 220,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { backgroundColor: '#9bb8e6' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultBox: {
    alignItems: 'center',
    gap: 4,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f1f3f4',
    minWidth: 220,
  },
  resultStatus: { fontSize: 14, color: '#444' },
  resultNumber: { fontSize: 22, fontWeight: '700', color: '#1a73e8' },
  resultParts: { fontSize: 13, color: '#666', textAlign: 'center' },
  error: { color: '#d93025', textAlign: 'center' },
});

export default App;
