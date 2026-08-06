import { useState } from 'react';
import { BentoCard } from '../DashboardGrid';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleCategoryProps {
  title: string;
  icon?: any;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerAction?: React.ReactNode;
  className?: string;
}

export function CollapsibleCategory({ 
  title, 
  icon: Icon, 
  description, 
  children, 
  defaultOpen = false,
  headerAction,
  className
}: CollapsibleCategoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <BentoCard className={className} style={{ gridColumn: 'span 12', marginBottom: '1.5rem' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', paddingBottom: isOpen ? '1rem' : '0', borderBottom: isOpen ? '1px solid var(--card-border)' : 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isOpen ? <ChevronDown size={20} color="var(--text-secondary)" /> : <ChevronRight size={20} color="var(--text-secondary)" />}
            {Icon && <Icon size={24} />}
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{title}</h2>
          </div>
          {headerAction && isOpen && (
            <div onClick={e => e.stopPropagation()}>
              {headerAction}
            </div>
          )}
        </div>
        {!isOpen && description && (
          <p style={{ margin: `0.2rem 0 0 ${Icon ? '4.25rem' : '2rem'}`, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {description}
          </p>
        )}
      </div>

      {isOpen && (
        <div style={{ marginTop: '1.5rem' }}>
          {children}
        </div>
      )}
    </BentoCard>
  );
}
