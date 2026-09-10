/**
 * All user-facing copy lives here so Phase 5 can add Thai without touching
 * components. Keys are dot-namespaced by area.
 */
export const en = {
  'app.name': 'Snapboard',
  'app.tagline': 'Paste. Arrange. Copy.',

  'empty.title': 'Paste a screenshot',
  'empty.shortcut': '{{mod}} + V',
  'empty.or': 'or drop image files here',
  'empty.browse': 'Choose files',
  'empty.privacy': 'Your images stay on your device. Nothing is uploaded.',

  'drop.overlay': 'Drop to add {{count}} image(s)',

  'toolbar.background': 'Background',
  'toolbar.layout': 'Layout',
  'toolbar.style': 'Style',
  'toolbar.spacing': 'Spacing',
  'toolbar.copy': 'Copy',
  'toolbar.copied': 'Copied',
  'toolbar.download': 'Download',
  'toolbar.clear': 'Clear board',

  'layout.auto': 'Auto',
  'layout.rows': 'Rows',
  'layout.columns': 'Stacked',
  'layout.grid': 'Grid',
  'layout.compare': 'Side by side',
  'layout.steps': 'Steps',
  'layout.free': 'Manual',

  'background.white': 'White',
  'background.black': 'Black',
  'background.slate': 'Slate',
  'background.transparent': 'Transparent',

  'style.plain': 'Plain',
  'style.card': 'Card',
  'style.soft': 'Soft',

  'spacing.gap': 'Gap',
  'spacing.padding': 'Padding',

  'toast.copied': 'Copied. Paste it anywhere with {{mod}} + V.',
  'toast.copiedUnverified': 'Copied. If pasting does not work, use Download.',
  'toast.downloaded': 'Saved as {{name}}',
  'toast.copyFailed': 'Could not copy, so the image was downloaded instead.',
  'toast.exportDownscaled': 'Exported at {{scale}}x because the image would have been too large.',
  'toast.rejected.not-an-image': '{{name}} is not a supported image',
  'toast.rejected.svg-not-supported': 'SVG files are not supported',
  'toast.rejected.too-large': '{{name}} is larger than 50 MB',
  'toast.rejected.too-many-pixels': '{{name}} has too many pixels to open safely',
  'toast.rejected.corrupt': '{{name}} could not be read as an image',
  'toast.decoding': 'Adding {{done}} of {{total}}...',
} as const

export type MessageKey = keyof typeof en
