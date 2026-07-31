import { FileStack, Images, Minimize2, Lock } from 'lucide-react';
import type { NavItem, NavSection } from 'meoweo-shared';

import type { Screen } from './navigation';

const ITEMS: NavItem<Screen>[] = [
  { screen: 'organize', label: 'Organize', Icon: FileStack },
  { screen: 'convert', label: 'Convert', Icon: Images },
  { screen: 'compress', label: 'Compress', Icon: Minimize2 },
  { screen: 'protect', label: 'Protect', Icon: Lock, badge: 'Soon' },
];

/** The sidebar, as this suite defines it. */
export const PDF_NAV_SECTIONS: NavSection<Screen>[] = [{ label: 'PDF Tools', items: ITEMS }];
