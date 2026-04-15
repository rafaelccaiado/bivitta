'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type NavSubItem = {
  href: string;
  label: string;
};

type NavItem = {
  href: string;
  icon: string;
  label: string;
  subItems?: NavSubItem[];
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    group: '',
    items: [
      { href: '/', icon: '⚡', label: 'Dashboard' },
    ],
  },
  {
    group: 'Receita',
    items: [
      { 
        href: '/receita', 
        icon: '💰', 
        label: 'Receita',
        subItems: [
          { href: '/receita', label: 'Geral' },
          { href: '/receita/trimestral', label: 'Trimestral' },
          { href: '/receita/conversao', label: 'Conversão' },
          { href: '/receita/margem', label: 'Margem' },
        ]
      },
    ],
  },
  {
    group: 'Financeiro',
    items: [
      { 
        href: '/financeiro', 
        icon: '💳', 
        label: 'Financeiro',
        subItems: [
          { href: '/financeiro', label: 'Geral' },
          { href: '/financeiro/recebiveis', label: 'Recebíveis' },
        ]
      },
    ],
  },
  {
    group: 'Operacional',
    items: [
      { href: '/consultas',    icon: '🩺', label: 'Consultas' },
      { href: '/agendamentos', icon: '📅', label: 'Agendamentos' },
      { href: '/callcenter',   icon: '📞', label: 'Call Center' },
    ],
  },
  {
    group: 'Clientes',
    items: [
      { 
        href: '/pacientes', 
        icon: '👥', 
        label: 'Pacientes',
        subItems: [
          { href: '/pacientes', label: 'Geral' },
          { href: '/pacientes/novos', label: 'Novos' },
        ]
      },
      { href: '/vittamais',    icon: '💎', label: 'VittaMais' },
    ],
  },
  {
    group: 'Especialidades',
    items: [
      { href: '/odontologia',  icon: '🦷', label: 'Odontologia' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const toggleExpand = (href: string) => {
    setExpandedItems(prev => 
      prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
    );
  };

  const isExpanded = (href: string) => expandedItems.includes(href);

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏥</div>
        <span className="sidebar-logo-text">Vitta BI</span>
      </div>

      <div className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.group || '_root'}>
            {group.group && (
              <div className="sidebar-group-label">{group.group}</div>
            )}
            {group.items.map((item) => (
              <div key={item.href}>
                <div
                  className={`sidebar-item ${isActive(item.href) ? 'active' : ''}`}
                  onClick={item.subItems ? () => toggleExpand(item.href) : undefined}
                  style={{ cursor: item.subItems ? 'pointer' : 'default' }}
                >
                  <Link href={item.href} className="sidebar-item-link">
                    <span className="icon">{item.icon}</span>
                    <span className="label">{item.label}</span>
                  </Link>
                  {item.subItems && (
                    <span className="expand-icon">{isExpanded(item.href) ? '▼' : '▶'}</span>
                  )}
                </div>
                {item.subItems && isExpanded(item.href) && (
                  <div className="sub-items">
                    {item.subItems.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`sidebar-sub-item ${isActive(subItem.href) ? 'active' : ''}`}
                      >
                        {subItem.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-user">
        <div className="user-avatar">V</div>
        <div className="user-info">
          <div className="user-name">Vitta BI</div>
          <div className="user-role">Administrador</div>
        </div>
      </div>
    </nav>
  );
}
