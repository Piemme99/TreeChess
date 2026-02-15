interface LichessLogoProps {
  size?: number;
  className?: string;
}

export function LichessLogo({ size = 16, className = '' }: LichessLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 50 50"
      width={size}
      height={size}
      className={className}
      aria-label="Lichess"
    >
      <path
        fill="currentColor"
        d="M11.553 40.564c2.207-4.064 7.888-7.702 11.553-9.283-5.263-5.958-8.062-8.554-11.063-13.197C8.747 13.005 9.533 6.199 14.39 2.855c0 0-.837 3.46.058 7.03 2.096 8.365 16.015 18.967 17.072 23.62.523 2.305-.046 5.202-1.893 7.06l5.803-1.27c2.08 1.466.82 5.167.82 5.167-3.803-.54-9.815-.07-13.28-.07C16.91 44.39 13.26 43.708 11.553 40.564z"
      />
    </svg>
  );
}
