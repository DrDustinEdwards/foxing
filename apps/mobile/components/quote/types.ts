export type CardType = 'quote' | 'finished' | 'reading' | 'club_invite'
export type TemplateId = 'minimal' | 'ornate' | 'dark' | 'sepia'

export interface TemplateDef {
  id: TemplateId
  label: string
  background: string
  bodyColor: string
  metaColor: string
  wordmarkColor: string
  borderColor?: string
}

// Sanctioned hardcoded palette: share-card templates are fixed artwork that
// must render identically in both color schemes. Do not tokenize.
export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  minimal: { id: 'minimal', label: 'Minimal', background: '#FAF6EE', bodyColor: '#16100B', metaColor: '#815E41', wordmarkColor: '#B04A1C' },
  ornate: { id: 'ornate', label: 'Ornate', background: '#B04A1C', bodyColor: '#FFFFFF', metaColor: '#FAE0D6', wordmarkColor: '#FAE0D6', borderColor: '#FAE0D6' },
  dark: { id: 'dark', label: 'Dark', background: '#16100B', bodyColor: '#F5EDDE', metaColor: '#C4AE96', wordmarkColor: '#E07840' },
  sepia: { id: 'sepia', label: 'Sepia', background: '#F5EDDA', bodyColor: '#2A1E12', metaColor: '#815E41', wordmarkColor: '#8A3610' },
}
export const TEMPLATE_ORDER: TemplateId[] = ['minimal', 'ornate', 'dark', 'sepia']
