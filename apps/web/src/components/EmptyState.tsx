interface EmptyStateProps {
  title: string;
  description: string;
}

export const EmptyState = ({ title, description }: EmptyStateProps) => (
  <div className="empty-state">
    <h2>{title}</h2>
    <p>{description}</p>
  </div>
);
