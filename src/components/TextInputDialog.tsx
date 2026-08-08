import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';

interface TextInputDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export function TextInputDialog({
  visible,
  title,
  message,
  initialValue = '',
  placeholder,
  confirmLabel = 'Kaydet',
  cancelLabel = 'Vazgeç',
  onCancel,
  onConfirm,
}: TextInputDialogProps) {
  const [value, setValue] = useState(initialValue);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onShow={() => setValue(initialValue)}
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor="#7A7A80"
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={submit}
              selectionColor="#0A84FF"
              style={styles.input}
            />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, !value.trim() && styles.buttonDisabled]}
                onPress={submit}
                disabled={!value.trim()}
              >
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(0,0,0,0.66)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      ios: {
        borderCurve: 'continuous' as any,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.34,
        shadowRadius: 34,
      },
      android: { elevation: 18 },
      web: { boxShadow: '0 24px 80px rgba(0,0,0,0.42)' } as any,
    }),
  },
  content: {
    padding: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    color: '#C7C7CC',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  input: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.08)',
    fontSize: 16,
    fontWeight: '600',
    ...(Platform.OS === 'web' && { outlineStyle: 'none' } as any),
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  button: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#0A84FF',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
