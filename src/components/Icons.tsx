export function FlameIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="flame-svg">
      <path
        className="flame-outer"
        d="M12.4 2c.7 3.4-2.2 5-2.2 8 0 1.2.8 2.3 1.9 2.3-.3-1.9 1.5-3.1 1.9-4.9 2.3 1.9 3.8 4.2 3.8 6.8 0 3.4-2.6 6.1-5.8 6.1S6.2 17.6 6.2 14.2C6.2 9.3 11.6 7.4 12.4 2z"
      />
      <path className="flame-inner" d="M12 21c-1.9 0-3-1.5-3-3 0-2.3 2.2-3 3-5.3 1.1 1.5 3 3 3 5.3 0 1.5-1.1 3-3 3z" />
    </svg>
  );
}

const paths: Record<string, string> = {
  today: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
  calendar: "M4 7a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7zM4 10h16M8 3v4M16 3v4",
  stats: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  reminders: "M12 21a2 2 0 002-2h-4a2 2 0 002 2zM18 16V11a6 6 0 10-12 0v5l-2 2h16l-2-2zM2 5l3-2M22 5l-3-2",
  bell: "M12 21a2 2 0 002-2h-4a2 2 0 002 2zM18 16V11a6 6 0 10-12 0v5l-2 2h16l-2-2z",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  plus: "M12 5v14M5 12h14",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  check: "M5 12l5 5 9-10",
  clock: "M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  phone: "M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zM11 18h2",
  refresh: "M20 11a8 8 0 10-2.3 5.7M20 4v7h-7",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function NavIcon({ name }: { name: string }) {
  return <Icon name={name} size={20} />;
}
