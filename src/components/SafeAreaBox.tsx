import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SafeEdge = 'top' | 'right' | 'bottom' | 'left';

interface SafeAreaBoxProps {
  children: ReactNode;
  edges?: SafeEdge[];
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_EDGES: SafeEdge[] = ['top', 'right', 'bottom', 'left'];

export function SafeAreaBox({ children, edges = DEFAULT_EDGES, style }: SafeAreaBoxProps) {
  const insets = useSafeAreaInsets();
  const activeEdges = new Set(edges);

  return (
    <View
      style={[
        style,
        {
          paddingTop: activeEdges.has('top') ? insets.top : 0,
          paddingRight: activeEdges.has('right') ? insets.right : 0,
          paddingBottom: activeEdges.has('bottom') ? insets.bottom : 0,
          paddingLeft: activeEdges.has('left') ? insets.left : 0,
        },
      ]}
    >
      {children}
    </View>
  );
}
