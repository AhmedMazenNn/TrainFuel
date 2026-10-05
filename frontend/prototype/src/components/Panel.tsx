import React from 'react';

interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article' | 'aside';
  tone?: 'surface' | 'elevated';
  padded?: boolean;
}

export function Panel({ as: Tag = 'section', tone = 'surface', padded = true, className = '', children, ...rest }: PanelProps) {
  return (
    <Tag
      className={`rounded-panel border border-line ${tone === 'elevated' ? 'bg-elevated' : 'bg-surface'} ${padded ? 'p-5 md:p-6' : ''} ${className}`}
      {...rest}>
      
      {children}
    </Tag>);

}