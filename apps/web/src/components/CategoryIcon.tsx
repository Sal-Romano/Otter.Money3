import { icons, LucideIcon } from 'lucide-react';

interface CategoryIconProps {
  icon: string | null;
  size?: number;
  className?: string;
}

/**
 * Renders a category icon.
 * Supports both Lucide icon names (kebab-case like "credit-card")
 * and legacy emoji icons for backwards compatibility.
 */
export function CategoryIcon({ icon, size = 20, className = '' }: CategoryIconProps) {
  if (!icon) {
    // Default icon when none specified
    const CircleIcon = icons['Circle'];
    return <CircleIcon size={size} className={className} />;
  }

  // Check if it's an emoji (1-2 characters, non-ASCII)
  const isEmoji = icon.length <= 4 && /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(icon);

  if (isEmoji) {
    // Render emoji directly
    return (
      <span
        className={className}
        style={{ fontSize: size * 0.9, lineHeight: 1 }}
        role="img"
        aria-label="category icon"
      >
        {icon}
      </span>
    );
  }

  // Convert kebab-case to PascalCase for Lucide
  const iconName = icon
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('') as keyof typeof icons;

  const IconComponent = icons[iconName] as LucideIcon | undefined;

  if (!IconComponent) {
    // Fallback to circle if icon not found
    const CircleIcon = icons['Circle'];
    return <CircleIcon size={size} className={className} />;
  }

  return <IconComponent size={size} className={className} />;
}

/**
 * Get a Lucide icon component by name
 */
export function getIconComponent(iconName: string): LucideIcon | null {
  const pascalName = iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('') as keyof typeof icons;

  return (icons[pascalName] as LucideIcon) || null;
}

/**
 * List of common category icons for the icon picker
 */
export const CATEGORY_ICON_OPTIONS = [
  // Money & Finance
  'wallet', 'credit-card', 'banknote', 'coins', 'piggy-bank', 'landmark', 'receipt',
  'badge-dollar-sign', 'percent', 'trending-up', 'trending-down', 'line-chart', 'pie-chart',

  // Transportation
  'car', 'bus', 'train', 'plane', 'plane-takeoff', 'bike', 'fuel', 'milestone',

  // Home & Living
  'home', 'building', 'building-2', 'bed', 'sofa', 'lamp', 'plug', 'thermometer',

  // Shopping & Goods
  'shopping-cart', 'shopping-bag', 'package', 'gift', 'shirt', 'gem',

  // Food & Drink
  'utensils', 'utensils-crossed', 'coffee', 'wine', 'beer', 'pizza', 'apple',

  // Entertainment
  'tv', 'music', 'gamepad-2', 'film', 'camera', 'headphones', 'ticket',

  // Health & Wellness
  'heart', 'heart-pulse', 'stethoscope', 'pill', 'activity', 'dumbbell',

  // Work & Business
  'briefcase', 'laptop', 'smartphone', 'monitor', 'printer', 'users', 'building-2',

  // Communication
  'phone', 'mail', 'message-circle', 'send', 'wifi',

  // Documents
  'file-text', 'folder', 'clipboard', 'book', 'graduation-cap',

  // Nature & Outdoors
  'sun', 'cloud', 'tree', 'flower', 'mountain', 'waves',

  // Misc
  'star', 'heart', 'shield', 'lock', 'key', 'settings', 'tool', 'wrench',
  'repeat', 'arrow-left-right', 'arrow-right-left', 'refresh-cw',
  'map', 'compass', 'navigation', 'globe',
];
