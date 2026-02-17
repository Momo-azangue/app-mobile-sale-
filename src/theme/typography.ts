import type { TextStyle } from 'react-native';

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.bold,
    fontSize: 32,
    lineHeight: 40,
  } satisfies TextStyle,
  h1: {
    fontFamily: fontFamilies.bold,
    fontSize: 24,
    lineHeight: 32,
  } satisfies TextStyle,
  h2: {
    fontFamily: fontFamilies.semibold,
    fontSize: 20,
    lineHeight: 28,
  } satisfies TextStyle,
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    lineHeight: 24,
  } satisfies TextStyle,
  bodyMedium: {
    fontFamily: fontFamilies.medium,
    fontSize: 16,
    lineHeight: 24,
  } satisfies TextStyle,
  label: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 16,
  } satisfies TextStyle,
  captionMedium: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    lineHeight: 16,
  } satisfies TextStyle,
} as const;
