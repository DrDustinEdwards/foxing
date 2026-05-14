import { useColorScheme } from 'react-native'

export type ColorScheme = 'light' | 'dark'

interface ColorTokens {
  // Brand
  brandUi: string
  brandText: string
  brandHover: string
  brandSecondary: string
  brandSubtle: string
  brandSubtleText: string

  // Backgrounds
  bgBase: string
  bgSurface: string
  bgElevated: string
  bgSunken: string
  bgHover: string
  bgSelected: string
  bgDisabled: string
  bgReading: string
  bgReadingSepia: string
  bgReadingOled: string

  // Text
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textDisabled: string
  textOnBrand: string
  textOnAmber: string
  textOnDark: string
  textOnSepia: string

  // Status
  success: string
  successBg: string
  successBorder: string
  successBorderInteractive: string
  warning: string
  warningBg: string
  warningBorder: string
  warningBorderInteractive: string
  error: string
  errorBg: string
  errorBorder: string
  errorBorderInteractive: string
  info: string
  infoBg: string
  infoBorder: string
  infoBorderInteractive: string

  // Borders
  borderSubtle: string
  borderDefault: string
  borderInteractive: string
  borderStrong: string
  borderBrand: string
  borderFocus: string

  // Annotation highlight backgrounds
  hlAmber: string
  hlAuburn: string
  hlYellow: string
  hlSage: string
  hlCobalt: string
  hlCrimson: string
  hlPurple: string

  // Annotation highlight text
  hlAmberT: string
  hlAuburnT: string
  hlYellowT: string
  hlSageT: string
  hlCobaltT: string
  hlCrimsonT: string
  hlPurpleT: string

  // UI states
  skeletonBase: string
  skeletonShimmer: string
  tooltipBg: string
  tooltipText: string
  commentBg: string
  commentBorder: string
  spoilerBg: string
  spoilerText: string
  dragTarget: string
  dragBorder: string
  lookupGlow: string
  presenceOnline: string
  presenceAway: string
  overlay: string

  // Shadows
  shadowSm: string
  shadowMd: string
  shadowLg: string
}

export const Colors: { light: ColorTokens; dark: ColorTokens } = {
  light: {
    brandUi: '#D4622E',
    brandText: '#B04A1C',
    brandHover: '#8A3610',
    brandSecondary: '#F5A623',
    brandSubtle: '#FAE0D6',
    brandSubtleText: '#632507',

    bgBase: '#FAF6EE',
    bgSurface: '#FFFFFF',
    bgElevated: '#FFFFFF',
    bgSunken: '#F2EAD8',
    bgHover: '#E5D8BF',
    bgSelected: '#FAE0D6',
    bgDisabled: '#EDE6DC',
    bgReading: '#FEFCF8',
    bgReadingSepia: '#F5EDDA',
    bgReadingOled: '#000000',

    textPrimary: '#16100B',
    textSecondary: '#3E3028',
    textTertiary: '#815E41',
    textDisabled: '#CFC7BC',
    textOnBrand: '#FFFFFF',
    textOnAmber: '#16100B',
    textOnDark: '#F5EDDE',
    textOnSepia: '#2A1E12',

    success: '#2B6443',
    successBg: '#EEF5EF',
    successBorder: '#D2E9D8',
    successBorderInteractive: '#196639',
    warning: '#605206',
    warningBg: '#FCF5CF',
    warningBorder: '#E8DC80',
    warningBorderInteractive: '#665B19',
    error: '#8D253F',
    errorBg: '#FAF0F3',
    errorBorder: '#F5D5DF',
    errorBorderInteractive: '#66192D',
    info: '#2B6391',
    infoBg: '#EEF3F8',
    infoBorder: '#D5E4F2',
    infoBorderInteractive: '#194466',

    borderSubtle: '#E5D8BF',
    borderDefault: '#CFC7BC',
    borderInteractive: '#7A4329',
    borderStrong: '#815E41',
    borderBrand: '#E58D6D',
    borderFocus: '#B04A1C',

    hlAmber: '#FEF0C0',
    hlAuburn: '#FAD8C8',
    hlYellow: '#FAF3C6',
    hlSage: '#C8EDD5',
    hlCobalt: '#C8DFEF',
    hlCrimson: '#F5D0DC',
    hlPurple: '#DFD3EE',

    hlAmberT: '#5C3A00',
    hlAuburnT: '#5A1E08',
    hlYellowT: '#554B07',
    hlSageT: '#133520',
    hlCobaltT: '#133656',
    hlCrimsonT: '#4F1223',
    hlPurpleT: '#361C54',

    skeletonBase: '#EDE6DC',
    skeletonShimmer: '#F5EFE6',
    tooltipBg: '#261E17',
    tooltipText: '#F5EDDE',
    commentBg: '#EEF3F8',
    commentBorder: '#D5E4F2',
    spoilerBg: '#3E3028',
    spoilerText: '#3E3028',
    dragTarget: '#FAE0D6',
    dragBorder: '#D4622E',
    lookupGlow: '#FAC455',
    presenceOnline: '#1F7A4A',
    presenceAway: '#8A5B0F',
    overlay: 'rgba(22,16,11,0.5)',

    shadowSm: 'rgba(22,16,11,0.07)',
    shadowMd: 'rgba(22,16,11,0.09)',
    shadowLg: 'rgba(22,16,11,0.11)',
  },
  dark: {
    brandUi: '#E07840',
    brandText: '#E07840',
    brandHover: '#E88F58',
    brandSecondary: '#F79C40',
    brandSubtle: '#2E1C0E',
    brandSubtleText: '#F0A070',

    bgBase: '#16100B',
    bgSurface: '#1F1710',
    bgElevated: '#2A1F16',
    bgSunken: '#100D08',
    bgHover: '#261C13',
    bgSelected: '#3A2418',
    bgDisabled: '#1E1810',
    bgReading: '#1A1410',
    bgReadingSepia: '#1E190E',
    bgReadingOled: '#000000',

    textPrimary: '#F5EDDE',
    textSecondary: '#C4AE96',
    textTertiary: '#A28269',
    textDisabled: '#4A3628',
    textOnBrand: '#FFFFFF',
    textOnAmber: '#16100B',
    textOnDark: '#F5EDDE',
    textOnSepia: '#2A1E12',

    success: '#72CA9A',
    successBg: '#0D2018',
    successBorder: '#72CA9A',
    successBorderInteractive: '#72CA9A',
    warning: '#F3DA49',
    warningBg: '#221C00',
    warningBorder: '#F3DA49',
    warningBorderInteractive: '#F3DA49',
    error: '#E46872',
    errorBg: '#220A0E',
    errorBorder: '#E46872',
    errorBorderInteractive: '#E46872',
    info: '#70A6DB',
    infoBg: '#091220',
    infoBorder: '#70A6DB',
    infoBorderInteractive: '#70A6DB',

    borderSubtle: '#261C13',
    borderDefault: '#3A2C22',
    borderInteractive: '#BE7A37',
    borderStrong: '#6A5040',
    borderBrand: '#E07840',
    borderFocus: '#F5B840',

    hlAmber: '#2E2008',
    hlAuburn: '#2E1808',
    hlYellow: '#3D360B',
    hlSage: '#0A1E12',
    hlCobalt: '#081018',
    hlCrimson: '#20080E',
    hlPurple: '#231532',

    hlAmberT: '#F5C060',
    hlAuburnT: '#F0A070',
    hlYellowT: '#F4E47B',
    hlSageT: '#72CA9A',
    hlCobaltT: '#70A6DB',
    hlCrimsonT: '#E46872',
    hlPurpleT: '#B58DE2',

    skeletonBase: '#261C13',
    skeletonShimmer: '#3A2C22',
    tooltipBg: '#F5EDDE',
    tooltipText: '#16100B',
    commentBg: '#0C1420',
    commentBorder: '#1A3050',
    spoilerBg: '#C4AE96',
    spoilerText: '#C4AE96',
    dragTarget: '#3A2418',
    dragBorder: '#E07840',
    lookupGlow: '#3A2C00',
    presenceOnline: '#4CAF7D',
    presenceAway: '#F5B840',
    overlay: 'rgba(0,0,0,0.7)',

    shadowSm: 'rgba(0,0,0,0.4)',
    shadowMd: 'rgba(0,0,0,0.5)',
    shadowLg: 'rgba(0,0,0,0.6)',
  },
}

export function useColors(): ColorTokens {
  const scheme = useColorScheme()
  return scheme === 'dark' ? Colors.dark : Colors.light
}

export function useColorSchemeName(): ColorScheme {
  const scheme = useColorScheme()
  return scheme === 'dark' ? 'dark' : 'light'
}
