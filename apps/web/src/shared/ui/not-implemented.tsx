import type { ReactNode } from 'react';

interface NotImplementedProps {
  title: string;
  description: string;
  items?: readonly string[];
  children?: ReactNode;
}

export function NotImplemented({ title, description, items, children }: NotImplementedProps) {
  return (
    <section className="card" aria-labelledby="not-implemented-title">
      <h2 id="not-implemented-title">{title}</h2>
      <p className="muted">{description}</p>
      {items && items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}
