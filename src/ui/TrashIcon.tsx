/**
 * A small, crisp trash-can icon used by the delete affordances
 * (`SelectionToolbar` and `ContextMenu`).
 *
 * Deliberately an inline SVG rather than the `🗑` emoji the two call sites
 * used before: that codepoint renders as a tiny monochrome text glyph at the
 * 14-16px sizes these affordances need, which reads as a vague little box
 * rather than a bin - and it renders differently on every platform. An SVG
 * with `currentColor` keeps the existing hover-to-`--danger` behaviour while
 * staying sharp at any size.
 */
export function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* lid line + handle */}
      <path d="M3 6h18" />
      <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
      {/* body */}
      <path d="M19 6l-1 13.5A2 2 0 0 1 16 21.5H8A2 2 0 0 1 6 19.5L5 6" />
      {/* inner ribs */}
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
