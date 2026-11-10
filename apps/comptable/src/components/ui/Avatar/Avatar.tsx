import { useState } from 'react';
import { initials } from '@/utils/format';
import styles from './Avatar.module.css';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md';
  /** Photo de profil — URL présignée renvoyée par le backend (`UserResponse.photoUrl`).
   *  Absente, invalide, ou en échec de chargement (URL expirée) : repli sur les initiales. */
  photoUrl?: string | null;
}

export function Avatar({ name, size = 'md', photoUrl }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setFailed(true)}
        className={[styles.avatar, styles.photo, styles[size]].join(' ')}
      />
    );
  }
  return (
    <span className={[styles.avatar, styles[size]].join(' ')} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
