export default function PasswordEyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      className="password-toggle-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {visible && <path d="M4 4l16 16" />}
    </svg>
  )
}
