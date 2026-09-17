type Props = {
  onClick: () => void;
  label?: string;
};

export function ViewCallButton({ onClick, label = "View call details" }: Props) {
  return (
    <button
      type="button"
      className="saas-view-btn"
      onClick={onClick}
      aria-label={label}
    >
      <span className="saas-view-btn__text">View</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
        />
      </svg>
    </button>
  );
}
