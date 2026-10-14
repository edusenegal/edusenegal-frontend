import { initials } from '@/utils/format';
import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md';
}

export function Avatar({ name, size = 'md' }: AvatarProps) {
  return (
    <span className={[styles.avatar, styles[size]].join(' ')} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
