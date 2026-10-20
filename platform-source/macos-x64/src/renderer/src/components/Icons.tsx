// Inline SVG icons. Stroke icons on a 16px grid that inherit currentColor.

type IconProps = { className?: string }

function Svg({ className, children }: IconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export const PlusIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
)

export const ChevronUpIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M4 10l4-4 4 4" />
  </Svg>
)

export const ChevronDownIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M4 6l4 4 4-4" />
  </Svg>
)

export const PencilIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z" />
  </Svg>
)

export const ArchiveIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <rect x="2" y="3" width="12" height="3" rx="0.5" />
    <path d="M3 6v6.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V6M6.5 9h3" />
  </Svg>
)

export const RestoreIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M3 8a5 5 0 105-5H5M5 1L3 3l2 2" />
  </Svg>
)

export const NoteIcon = (p: IconProps): React.JSX.Element => (
  <Svg {...p}>
    <path d="M4 2h6l3 3v9H4z M10 2v3h3 M6 8h5 M6 11h5" />
  </Svg>
)
