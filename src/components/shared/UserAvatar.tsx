import { getAvatarColor, getInitials } from '../layout/ChatListItem';

/** The gradients offered in the profile editor. */
export const AVATAR_COLORS = [
  'linear-gradient(135deg, #ff885e, #ff516a)',
  'linear-gradient(135deg, #ffcd6a, #ffa85c)',
  'linear-gradient(135deg, #a695ff, #8f7bff)',
  'linear-gradient(135deg, #6fd8ff, #52b6ff)',
  'linear-gradient(135deg, #62c5a8, #3eb489)',
  'linear-gradient(135deg, #ff9ecb, #ff6fa5)',
  'linear-gradient(135deg, #9be36b, #5fc23a)',
  'linear-gradient(135deg, #b7c0cd, #8b98a8)',
];

function isPhoto(value?: string): boolean {
  return !!value && (value.startsWith('data:image') || value.startsWith('http') || value.startsWith('blob:'));
}

/**
 * One avatar for the whole app: the uploaded photo when there is one, otherwise
 * the colour the person picked, otherwise a Telegram gradient derived from them.
 */
export function UserAvatar({
  name,
  id,
  avatar,
  avatarColor,
  size = 48,
  className = '',
  fontSize,
  children,
}: {
  name: string;
  id: string;
  avatar?: string;
  avatarColor?: string;
  size?: number;
  className?: string;
  /** Overrides the automatic initials size (used for group/channel icons). */
  fontSize?: number;
  /** Extra content drawn inside the circle, e.g. a group icon. */
  children?: React.ReactNode;
}) {
  const photos = isPhoto(avatar);
  const background = photos ? undefined : (avatarColor || getAvatarColor(name || id));
  return (
    <div
      className={`avatar-sheen rounded-full flex items-center justify-center text-white font-semibold select-none shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        background,
        fontSize: fontSize ?? Math.max(11, Math.round(size * 0.36)),
      }}
    >
      {photos
        ? <img src={avatar} alt={name} className="w-full h-full object-cover" draggable={false} />
        : (children ?? getInitials(name || '?'))}
    </div>
  );
}
