import { motion } from 'motion/react';

interface HomeAboutProps {
  title: string;
  name: string;
  description: string;
  location: string;
}

/** GitHub icon — Lucide, viewBox 0 0 24 24 */
function GithubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="GitHub"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

/** Mail icon — Lucide, viewBox 0 0 24 24 */
function MailIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Email"
    >
      <rect width={20} height={16} x={2} y={4} rx={2} />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/** Bilibili icon — Simple Icons, viewBox 0 0 24 24 */
function BilibiliIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Bilibili"
    >
      <path d="M17.813 4.653a.85.85 0 0 1 .15.15l1.637 1.865c.1.116.195.234.287.355l.129.176.082.133V17.5a2.5 2.5 0 0 1-2.5 2.5H6.5a2.5 2.5 0 0 1-2.5-2.5V7.332l.081-.133.129-.176a3.01 3.01 0 0 1 .287-.355l1.637-1.865a.91.91 0 0 1 .15-.15l.215-.164.21-.133.228-.105.235-.078.24-.047.245-.02.25-.003.245.02.24.047.235.078.228.105.21.133.215.164.673.473.674-.473.215-.164.21-.133.228-.105.235-.078.24-.047.245-.02.25-.003.245.02.24.047.235.078.228.105.21.133.215.164.673.473.674-.473zM7.5 9.332a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1zm9 0a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1z" />
    </svg>
  );
}

/** NetEase Cloud Music icon — Simple Icons, viewBox 0 0 24 24 */
function NetEaseMusicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="NetEase Cloud Music"
    >
      <path d="M13.046 9.388a3.919 3.919 0 0 0-.66.19c-.809.312-1.447.991-1.666 1.775a2.269 2.269 0 0 0-.074.81c.048.546.333 1.05.764 1.35a1.483 1.483 0 0 0 2.01-.286c.406-.531.355-1.183.24-1.636-.098-.387-.22-.816-.345-1.249a64.76 64.76 0 0 1-.269-.954zm-.82 10.07c-3.984 0-7.224-3.24-7.224-7.223 0-.98.226-3.02 1.884-4.822A7.188 7.188 0 0 1 9.502 5.6a.792.792 0 1 1 .587 1.472 5.619 5.619 0 0 0-2.795 2.462 5.538 5.538 0 0 0-.707 2.7 5.645 5.645 0 0 0 5.638 5.638c1.844 0 3.627-.953 4.542-2.428 1.042-1.68.772-3.931-.627-5.238a3.299 3.299 0 0 0-1.437-.777c.172.589.334 1.18.494 1.772.284 1.12.1 2.181-.519 2.989-.39.51-.956.888-1.592 1.064a3.038 3.038 0 0 1-2.58-.44 3.45 3.45 0 0 1-1.44-2.514c-.04-.467.002-.93.128-1.376.35-1.256 1.356-2.339 2.622-2.826a5.5 5.5 0 0 1 .823-.246l-.134-.505c-.37-1.371.25-2.579 1.547-3.007.329-.109.68-.145 1.025-.105.792.09 1.476.592 1.709 1.023.258.507-.096 1.153-.706 1.153a.788.788 0 0 1-.54-.213c-.088-.08-.163-.174-.259-.247a.825.825 0 0 0-.632-.166.807.807 0 0 0-.634.551c-.056.191-.031.406.02.595.07.256.159.597.217.82 1.11.098 2.162.54 2.97 1.296 1.974 1.844 2.35 4.886.892 7.233-1.197 1.93-3.509 3.177-5.889 3.177zM0 12c0 6.627 5.373 12 12 12s12-5.373 12-12S18.627 0 12 0 0 5.373 0 12Z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  {
    label: 'GitHub',
    href: 'https://github.com/Edmounds',
    icon: <GithubIcon />,
  },
  {
    label: 'Bilibili',
    href: 'https://space.bilibili.com/397591871',
    icon: <BilibiliIcon />,
  },
  {
    label: 'Email',
    href: 'mailto:edmounds666@gmail.com',
    icon: <MailIcon />,
  },
  {
    label: 'NetEase Music',
    href: 'https://y.music.163.com/m/user?id=1460343107',
    icon: <NetEaseMusicIcon />,
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
};

export default function HomeAbout({ title, name, description, location }: HomeAboutProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      {/* Title */}
      <motion.h1
        variants={itemVariants}
        className="home-about-title"
      >
        {title}
      </motion.h1>

      {/* Name */}
      <motion.h2
        variants={itemVariants}
        className="home-about-name"
      >
        {name}
      </motion.h2>

      {/* Description */}
      <motion.p
        variants={itemVariants}
        className="home-about-desc"
      >
        {description}
      </motion.p>

      {/* Location */}
      <motion.p
        variants={itemVariants}
        className="home-about-location"
      >
        {location}
      </motion.p>

      {/* Social Links */}
      <motion.div
        variants={itemVariants}
        className="home-about-socials"
      >
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.href.startsWith('mailto:') ? undefined : '_blank'}
            rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
            className="home-about-social-link"
            title={link.label}
          >
            {link.icon}
            <span>{link.label}</span>
          </a>
        ))}
      </motion.div>
    </motion.div>
  );
}
