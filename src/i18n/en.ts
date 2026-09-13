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
  'toolbar.copyTitle': 'Copy ({{mod}}+Shift+C)',
  'toolbar.copied': 'Copied',
  'toolbar.download': 'Download',
  'toolbar.exportOptions': 'Export options',
  'toolbar.clear': 'Clear board',
  'toolbar.clearConfirm': 'Clear the board? This can still be undone with {{mod}}+Z.',

  'export.format': 'Format',
  'export.formatPng': 'PNG',
  'export.formatJpg': 'JPG',
  'export.scale': 'Size',
  'export.quality': 'Quality',
  'export.estimate': '{{w}} × {{h}} px',
  'export.willDownscale': 'Exports at {{scale}}x — larger would exceed the safe canvas size',

  'layout.auto': 'Auto',
  'layout.rows': 'Rows',
  'layout.columns': 'Stacked',
  'layout.grid': 'Grid',
  'layout.compare': 'Side by side',
  'layout.steps': 'Steps',
  'layout.free': 'Manual',
  'layout.freeNotice': 'Auto layout off',
  'layout.turnOn': 'Turn back on',

  'background.white': 'White',
  'background.black': 'Black',
  'background.transparent': 'Transparent',

  'style.plain': 'Plain',
  'style.card': 'Card',
  'style.soft': 'Soft',

  'spacing.gap': 'Gap',
  'spacing.gapWithPercent': 'Gap · {{percent}}%',
  'spacing.padding': 'Padding',

  'selection.count': '{{count}} selected',
  'selection.crop': 'Crop',
  'selection.duplicate': 'Duplicate',
  'selection.duplicateTitle': 'Duplicate (D)',
  'selection.bringToFront': 'Bring to front',
  'selection.bringToFrontTitle': 'Bring to front (F)',
  'selection.delete': 'Delete',
  'selection.style': 'Edit style',
  'selection.styleTitle': 'Color & size',

  'crop.confirm': 'Done',
  'crop.cancel': 'Cancel',

  'annotate.arrow': 'Arrow',
  'annotate.arrowTitle': 'Arrow (A)',
  'annotate.box': 'Box',
  'annotate.boxTitle': 'Box (R)',
  'annotate.text': 'Text',
  'annotate.textTitle': 'Text (T)',
  'annotate.marker': 'Number',
  'annotate.markerTitle': 'Number (N)',
  'annotate.redact': 'Redact',
  'annotate.redactTitle': 'Redact (C)',
  'annotate.settings': 'Style',
  'annotate.settingsTitle': 'Color & size — or scroll while a tool is armed',
  'annotate.color': 'Color',
  'annotate.size': 'Size',

  'zoom.out': 'Zoom out',
  'zoom.in': 'Zoom in',
  'zoom.reset': 'Reset zoom to 100%',
  'zoom.fit': 'Fit to view',
  'zoom.level': 'Zoom {{percent}}%',

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

  'recovery.message': 'Recovered your last board',
  'recovery.startFresh': 'Start fresh',
  'recovery.dismiss': 'Dismiss',

  'cleared.message': 'Board cleared',
  'cleared.restore': 'Restore',
  'cleared.dismiss': 'Dismiss',
} as const

export type MessageKey = keyof typeof en
