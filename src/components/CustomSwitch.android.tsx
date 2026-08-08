import { requireOptionalNativeModule } from 'expo-modules-core';
import CustomSwitchBase from './CustomSwitchBase';

type ExpoUIComponents = typeof import('@expo/ui/jetpack-compose');

const expoUI: ExpoUIComponents | null = requireOptionalNativeModule('ExpoUI')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('@expo/ui/jetpack-compose')
  : null;

interface CustomSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function CustomSwitch({
  value,
  onValueChange,
  disabled = false,
}: CustomSwitchProps) {
  if (!expoUI) {
    return (
      <CustomSwitchBase
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    );
  }

  const { Host, Switch } = expoUI;

  return (
    <Host matchContents style={{ opacity: disabled ? 0.4 : 1 }}>
      <Switch
        value={value}
        enabled={!disabled}
        onCheckedChange={onValueChange}
        colors={{
          checkedThumbColor: '#FFFFFF',
          checkedTrackColor: '#0A84FF',
          uncheckedThumbColor: '#F2F2F7',
          uncheckedTrackColor: '#3A3A3C',
          uncheckedBorderColor: '#636366',
        }}
      />
    </Host>
  );
}
