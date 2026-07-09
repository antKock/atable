/* =========================================================================
   Mijote — Foyer (features 14 récup. d'accès + 15 multi-foyer) · shared kit
   Tokens, icons, phone frame, and the reusable UI primitives that the three
   acts (tronc commun / 14 / 15) compose. All symbols exported to window.
   Grounded in the real codebase: globals.css tokens, the (app) shell, the
   /household screen, the onboarding forms, RecipeCard, the pill nav.
   ========================================================================= */

const MJ = {
  bg: '#F5F1E8',
  ink: '#1A1A18',
  surface: '#FFFFFF',
  muted: '#6B6E68',
  accent: '#6E7A38',
  accentSoft: 'rgba(110,122,56,0.10)',
  accentSoft20: 'rgba(110,122,56,0.20)',
  border: '#E5DED6',
  navInactive: '#B5B3AD',
  btnGradient: 'linear-gradient(155deg, #7d8c40, #5d6a2e)',
  btnShadow: '0 2px 6px rgba(93,106,46,0.22), 0 8px 18px rgba(93,106,46,0.12)',
  cardGradient: 'linear-gradient(168deg, #FFFFFF, #F5F7F0)',
  cardShadowSm: '0 1px 2px rgba(110,122,56,0.05), 0 2px 4px rgba(110,122,56,0.06), 0 3px 8px rgba(0,0,0,0.04)',
  chipBg: 'rgba(26,26,24,0.05)',
  muted50: 'rgba(238,242,228,0.5)',
  destructive: '#B4472E',
  sage100: '#B6C4A8',
  sage500: '#9AAD8C',
  sage800: '#6B7F5C',
  cream: '#F5F1E8',
  sageBg: 'radial-gradient(80% 80% at 50% 38%, #B6C4A8 0%, #9AAD8C 55%, #6B7F5C 100%)',
  fontDisplay: "'Fraunces', Georgia, serif",
  fontSans: "'Inter', system-ui, sans-serif",
  fontMono: "'DM Mono', ui-monospace, monospace",
};

/* Foyer identity colours — muted, warm, harmonious (shared chroma/lightness,
   varied hue). Used as small dots to mark a recipe's origin foyer (feature 15). */
const FOYER_COLORS = {
  olive: '#6E7A38',   // perso / default
  clay: '#B0673B',    // terracotta
  teal: '#4E7C8A',    // muted blue
  plum: '#8A5A7C',    // muted plum
  ochre: '#A0863C',   // ochre
};

/* ============================ Icons (lucide geometry, 24-grid) ============================ */
const Lc = ({ children, size = 20, stroke = 1.75, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>{children}</svg>
);
const IconArrowLeft = (p) => <Lc {...p}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></Lc>;
const IconChevronLeft = (p) => <Lc {...p}><path d="m15 18-6-6 6-6" /></Lc>;
const IconChevronRight = (p) => <Lc {...p}><path d="m9 18 6-6-6-6" /></Lc>;
const IconChevronDown = (p) => <Lc {...p}><path d="m6 9 6 6 6-6" /></Lc>;
const IconArrowRight = (p) => <Lc {...p}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Lc>;
const IconPencil = (p) => <Lc {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Lc>;
const IconTrash = (p) => <Lc {...p}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Lc>;
const IconCheck = (p) => <Lc {...p}><path d="M20 6 9 17l-5-5" /></Lc>;
const IconCheckCircle = (p) => <Lc {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></Lc>;
const IconUsers = (p) => <Lc {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Lc>;
const IconX = (p) => <Lc {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Lc>;
const IconCopy = (p) => <Lc {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Lc>;
const IconPlus = (p) => <Lc {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Lc>;
const IconHome = (p) => <Lc {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" /></Lc>;
const IconBook = (p) => <Lc {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></Lc>;
const IconMail = (p) => <Lc {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></Lc>;
const IconKey = (p) => <Lc {...p}><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.5 12.5 8-8" /><path d="m16 5 3 3" /><path d="m19 2 3 3" /></Lc>;
const IconSearch = (p) => <Lc {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Lc>;
const IconShieldCheck = (p) => <Lc {...p}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></Lc>;
const IconEye = (p) => <Lc {...p}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Lc>;
const IconLock = (p) => <Lc {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Lc>;
const IconLogOut = (p) => <Lc {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Lc>;
const IconMove = (p) => <Lc {...p}><path d="M5 9 2 12l3 3" /><path d="M9 5l3-3 3 3" /><path d="m15 19-3 3-3-3" /><path d="M19 9l3 3-3 3" /><path d="M2 12h20" /><path d="M12 2v20" /></Lc>;
const IconSwitch = (p) => <Lc {...p}><path d="m17 3 4 4-4 4" /><path d="M21 7H9a4 4 0 0 0-4 4v0" /><path d="m7 21-4-4 4-4" /><path d="M3 17h12a4 4 0 0 0 4-4v0" /></Lc>;
const IconSmartphone = (p) => <Lc {...p}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></Lc>;
const IconSparkle = (p) => <Lc {...p}><path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15l-1.6-4.2L6 9.2l4.4-1.6z" /></Lc>;
const IconChart = (p) => <Lc {...p}><path d="M3 3v18h18" /><path d="M7 16v-5" /><path d="M12 16V8" /><path d="M17 16v-8" /></Lc>;
const IconShare = (p) => <Lc {...p}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" /></Lc>;
const IconFolderInput = (p) => <Lc {...p}><path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2" /><path d="M2 13h10" /><path d="m9 16 3-3-3-3" /></Lc>;
const IconSettings = (p) => <Lc {...p}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></Lc>;

function CocotteMark({ size = 22, accent = MJ.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden="true" style={{ display: 'block' }}>
      <g stroke={accent} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.55">
        <path d="M28 17 Q30 13 28 9 Q26 5 28 1" />
        <path d="M40 15 Q42 11 40 7 Q38 3 40 -1" />
        <path d="M52 17 Q54 13 52 9 Q50 5 52 1" />
      </g>
      <rect x="3" y="38" width="6" height="9" rx="3" fill={accent} />
      <rect x="71" y="38" width="6" height="9" rx="3" fill={accent} />
      <path d="M9 36 Q9 32 13 32 L67 32 Q71 32 71 36 L71 56 Q71 64 61 64 L19 64 Q9 64 9 56 Z" fill={accent} />
      <path d="M14 58 Q14 62 18 62 L62 62 Q66 62 66 58" stroke="rgba(255,255,255,0.30)" strokeWidth="1.5" fill="none" />
      <path d="M10 30 Q10 22 40 22 Q70 22 70 30 Z" fill={accent} opacity="0.78" />
      <circle cx="40" cy="19" r="2.5" fill={accent} opacity="0.78" />
    </svg>
  );
}

/* ============================ Phone frame ============================ */
const PHONE_W = 320;

function PhoneFrame({ children, height = 660, tone = 'light', style }) {
  const glyph = tone === 'light' ? MJ.ink : MJ.cream;
  return (
    <div style={{
      width: PHONE_W + 14, height: height + 14,
      borderRadius: 46, padding: 7,
      background: 'linear-gradient(160deg, #2a2a26, #18180f)',
      boxShadow: '0 1px 0 1px rgba(255,255,255,0.04) inset, 0 22px 48px -18px rgba(45,53,32,0.34), 0 8px 22px -10px rgba(45,53,32,0.18)',
      position: 'relative', flex: 'none', ...style,
    }}>
      <div style={{ width: PHONE_W, height, borderRadius: 39, overflow: 'hidden', position: 'relative', background: MJ.bg }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 38, zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 0', color: glyph, pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.2px' }}>9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 9 }}>
              {[3, 5, 7, 9].map((h, i) => <span key={i} style={{ width: 2.5, height: h, background: glyph, borderRadius: 1 }} />)}
            </div>
            <div style={{ width: 20, height: 10, border: `1.3px solid ${glyph}`, borderRadius: 2.5, padding: 1.3, boxSizing: 'border-box', position: 'relative' }}>
              <div style={{ width: '74%', height: '100%', background: glyph, borderRadius: 1 }} />
              <div style={{ position: 'absolute', top: 3, right: -2.5, width: 1.6, height: 3.5, background: glyph, borderRadius: 1 }} />
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', width: 86, height: 22, background: '#000', borderRadius: 14, zIndex: 31 }} />
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>{children}</div>
        </div>
        <div style={{ position: 'absolute', bottom: 7, left: '50%', transform: 'translateX(-50%)', width: 104, height: 4, borderRadius: 3, background: tone === 'light' ? 'rgba(26,26,24,0.32)' : 'rgba(245,241,232,0.6)', zIndex: 30 }} />
      </div>
    </div>
  );
}

/* ============================ Member avatar ============================
   Owner = "membre". Optional name; empty name → auto alias. The avatar is a
   soft-tinted disc with initials (derived from the name/alias). Colour comes
   from the member's own foyer tint so identity reads consistently. */
function Avatar({ initials = 'LF', size = 36, color = MJ.accent, ring = false, style }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flex: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `color-mix(in srgb, ${color} 16%, #fff)`,
      color: color, fontFamily: MJ.fontSans, fontWeight: 700,
      fontSize: size * 0.36, letterSpacing: '0.01em',
      boxShadow: ring ? `0 0 0 2px ${MJ.bg}, 0 0 0 3.5px ${color}` : `inset 0 0 0 1px color-mix(in srgb, ${color} 30%, transparent)`,
      ...style,
    }}>{initials}</div>
  );
}

/* Small colour dot marking a foyer (feature 15). */
function FoyerDot({ color = MJ.accent, size = 9, style }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, flex: 'none', display: 'inline-block', ...style }} />;
}

/* ============================ Home header (feature: explicit foyer access) ============
   Sticky top bar on /home. Left: wordmark. Right: the member avatar → taps to
   the foyer screen. This is the primary "make foyer access explicit" answer. */
/* Real /home header: big Fraunces « Mijote » left, a settings gear right → foyer.
   No foyer switcher here — foyer filtering lives only in the library (feature 15). */
function HomeHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 6px' }}>
      <h1 style={{ margin: 0, fontFamily: MJ.fontDisplay, fontVariationSettings: '"opsz" 144', fontWeight: 700, fontSize: 30, lineHeight: 1, letterSpacing: '-0.02em', color: MJ.ink }}>Mijote</h1>
      <button style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MJ.muted, cursor: 'pointer' }}><IconSettings size={22} /></button>
    </div>
  );
}

/* ============================ Bottom pill nav (Lot 6) ============================ */
function PillNav({ active = 'home' }) {
  const items = [
    { key: 'home', icon: IconHome },
    { key: 'add', icon: IconPlus, isAdd: true },
    { key: 'library', icon: IconBook },
  ];
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', zIndex: 40,
      width: 'calc(100% - 32px)', maxWidth: 380, height: 60,
      background: 'rgba(245,241,232,0.92)', backdropFilter: 'blur(10px) saturate(140%)',
      WebkitBackdropFilter: 'blur(10px) saturate(140%)', border: `1px solid ${MJ.border}`,
      borderRadius: 999, boxShadow: '0 6px 18px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 12px',
    }}>
      {items.map(({ key, icon: Icon, isAdd }) => {
        const isActive = active === key;
        return isAdd ? (
          <span key={key} style={{ width: 48, height: 48, borderRadius: '50%', background: MJ.btnGradient, boxShadow: MJ.btnShadow, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} stroke={2.5} />
          </span>
        ) : (
          <span key={key} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={24} stroke={isActive ? 2.4 : 1.75} color={isActive ? MJ.accent : MJ.navInactive} style={isActive ? { filter: 'drop-shadow(0 0 4px rgba(110,122,56,0.35))' } : undefined} />
          </span>
        );
      })}
    </div>
  );
}

/* ============================ Screen scaffold ============================ */
function Screen({ children, scroll = false, pad = true }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: scroll ? 'auto' : 'hidden', background: MJ.bg }}>
      <div style={{ minHeight: '100%', paddingTop: 38, paddingBottom: pad ? 24 : 0 }}>{children}</div>
    </div>
  );
}

/* Detail-screen top bar with a back chevron + centred title (used by foyer sub-screens). */
function TopBar({ title, onBack = true, right }) {
  return (
    <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 8px', position: 'relative' }}>
      {onBack && <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MJ.ink }}><IconChevronLeft size={22} stroke={2} /></div>}
      <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 15.5, fontWeight: 600, color: MJ.ink }}>{title}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>{right}</div>
    </div>
  );
}

/* Big Fraunces screen title (matches /household h1). */
function PageTitle({ children, size = 30 }) {
  return <h1 style={{ margin: 0, fontFamily: MJ.fontDisplay, fontVariationSettings: '"opsz" 144', fontWeight: 600, fontSize: size, letterSpacing: '-0.02em', color: MJ.ink, lineHeight: 1.05 }}>{children}</h1>;
}

function SectionLabel({ children, style }) {
  return <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: MJ.muted, ...style }}>{children}</p>;
}

/* Card surface (matches --card-gradient + soft shadow). */
function Card({ children, style, onAccent }) {
  return (
    <div style={{
      borderRadius: 14, background: MJ.surface,
      boxShadow: onAccent ? `inset 0 0 0 1px ${MJ.accentSoft20}` : `inset 0 0 0 1px ${MJ.border}`,
      ...style,
    }}>{children}</div>
  );
}

/* A row inside a card (icon · text · trailing). Hairline divider handled by parent. */
function Row({ icon, title, sub, trailing, onColor, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', ...style }}>
      {icon && <div style={{ flex: 'none', color: onColor || MJ.muted, display: 'flex' }}>{icon}</div>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 500, color: MJ.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        {sub && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: MJ.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>}
      </div>
      {trailing && <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>{trailing}</div>}
    </div>
  );
}

function Hairline() {
  return <div style={{ height: 1, background: MJ.border, marginLeft: 14 }} />;
}

/* Role pill: membre (olive) / invité (neutral + eye). */
function RolePill({ role }) {
  const isGuest = role === 'invité';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: isGuest ? MJ.chipBg : MJ.accentSoft,
      color: isGuest ? MJ.muted : MJ.accent,
    }}>
      {isGuest && <IconEye size={12} stroke={2} />}
      {role}
    </span>
  );
}

/* Primary olive pill button (foyer-screen CTA grammar — h54 / rounded-27 / 17px). */
function PrimaryPill({ children, style }) {
  return (
    <button style={{ width: '100%', height: 54, border: 'none', borderRadius: 27, background: MJ.accent, color: '#fff', fontFamily: MJ.fontSans, fontWeight: 600, fontSize: 17, letterSpacing: '-0.005em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...style }}>{children}</button>
  );
}

/* Gradient CTA (the RecipeForm save button grammar — rounded-md 12px). */
function GradientCTA({ children, style }) {
  return (
    <button style={{ width: '100%', minHeight: 48, border: 'none', borderRadius: 12, background: MJ.btnGradient, boxShadow: MJ.btnShadow, color: '#fff', fontFamily: MJ.fontSans, fontWeight: 500, fontSize: 14.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 20px', ...style }}>{children}</button>
  );
}

/* Secondary text link (matches the onboarding forms' tertiary link). */
function TextLink({ children, color = MJ.ink, style }) {
  return <button style={{ width: '100%', background: 'transparent', border: 'none', padding: '14px 0', fontFamily: MJ.fontSans, fontWeight: 500, fontSize: 15, color, cursor: 'pointer', ...style }}>{children}</button>;
}

/* Copy-link block (matches InviteLinkDisplay / CodeDisplay grammar). */
function LinkBlock({ label, value, mono = false, icon, accentIcon = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 14, background: MJ.muted50, boxShadow: `inset 0 0 0 1px ${MJ.border}`, padding: '11px 12px 11px 14px' }}>
      {icon && <div style={{ flex: 'none', color: MJ.muted, display: 'flex' }}>{icon}</div>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: MJ.muted }}>{label}</p>
        <p style={{ margin: '3px 0 0', fontSize: mono ? 15 : 12.5, fontFamily: mono ? MJ.fontMono : MJ.fontSans, fontWeight: mono ? 500 : 400, color: MJ.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: mono ? '0.06em' : 0 }}>{value}</p>
      </div>
      <div style={{ flex: 'none', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentIcon ? MJ.accent : MJ.muted }}>
        <IconCopy size={18} />
      </div>
    </div>
  );
}

/* Dismissible hint card (same spirit as the homepage/foyer nudges). */
function HintCard({ icon, title, body, cta }) {
  return (
    <div style={{ position: 'relative', borderRadius: 14, background: MJ.accentSoft, boxShadow: `inset 0 0 0 1px ${MJ.accentSoft20}`, padding: '14px 40px 14px 14px' }}>
      <div style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MJ.muted }}><IconX size={14} /></div>
      <div style={{ display: 'flex', gap: 11 }}>
        <div style={{ flex: 'none', color: MJ.accent, marginTop: 1 }}>{icon}</div>
        <div>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: MJ.ink }}>{title}</p>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, lineHeight: 1.45, color: MJ.muted }}>{body}</p>
          {cta && <p style={{ margin: '9px 0 0', fontSize: 13, fontWeight: 600, color: MJ.accent, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{cta} <IconArrowRight size={13} stroke={2.2} /></p>}
        </div>
      </div>
    </div>
  );
}

/* Recipe card. `variant`: 'carousel' (aspect 3/2, home) or 'grid' (aspect 3/4, library).
   Foyer marker = a discreet TEXT chip (foyer name), library only — no colour, no eye. */
function GridCard({ title, colors = ['#d8c49a', '#9c7f4f'], foyerLabel, variant = 'grid' }) {
  const carousel = variant === 'carousel';
  return (
    <div style={{ width: '100%', borderRadius: 12, overflow: 'hidden', background: MJ.cardGradient, boxShadow: MJ.cardShadowSm, borderBottom: '1px solid rgba(110,122,56,0.22)', position: 'relative' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: carousel ? '3 / 2' : '3 / 4', background: `linear-gradient(155deg, ${colors[0]}, ${colors[1]})` }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 30% 20%, rgba(255,247,225,0.5), transparent 55%)' }} />
        {foyerLabel && (
          <div style={{ position: 'absolute', top: 7, left: 7, maxWidth: 'calc(100% - 14px)', display: 'inline-flex', alignItems: 'center', height: 19, padding: '0 8px', borderRadius: 999, background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(2px)' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: MJ.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{foyerLabel}</span>
          </div>
        )}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.25, color: MJ.ink, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: MJ.muted }}>25 min · €€</p>
      </div>
    </div>
  );
}

/* Recipe-hero action pill (matches the real detail overlay: white pill, top-right,
   Share | Edit | [Move] | Delete, split by 1px dividers). `move` inserts the
   « déplacer vers un foyer » action as a 4th icon (feature 15). */
function RecipeActionPill({ move = false, highlight }) {
  const glyph = (Icon, key) => (
    <span key={key} style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: highlight === key ? MJ.accent : MJ.ink, background: highlight === key ? MJ.accentSoft : 'transparent' }}>
      <Icon size={15} stroke={1.9} />
    </span>
  );
  const div = (k) => <span key={k} style={{ width: 1, height: 16, background: MJ.border }} />;
  const items = move
    ? [glyph(IconShare, 'share'), div('d1'), glyph(IconPencil, 'edit'), div('d2'), glyph(IconFolderInput, 'move'), div('d3'), glyph(IconTrash, 'del')]
    : [glyph(IconShare, 'share'), div('d1'), glyph(IconPencil, 'edit'), div('d2'), glyph(IconTrash, 'del')];
  return (
    <div style={{ position: 'absolute', right: 12, top: 12, display: 'inline-flex', alignItems: 'center', gap: 2, borderRadius: 999, padding: 4, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.10)' }}>{items}</div>
  );
}

/* Back circle button (white disc, top-left) matching BackCircleButton. */
function BackCircle() {
  return <div style={{ position: 'absolute', left: 12, top: 12, width: 36, height: 36, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MJ.ink }}><IconChevronLeft size={19} stroke={2} /></div>;
}

/* Bottom sheet shell (for the "choix de foyer" picker + action sheets). */
function Sheet({ children, title }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,24,0.34)', zIndex: 44 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 45, background: MJ.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: '0 -12px 40px rgba(0,0,0,0.18)', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: MJ.border, margin: '9px auto 4px' }} />
        {title && <p style={{ margin: 0, padding: '8px 20px 12px', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: MJ.muted }}>{title}</p>}
        {children}
      </div>
    </>
  );
}

/* Centred dialog (desktop/tablet substitute for the mobile bottom sheet). */
function Dialog({ children, title, width = 360 }) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,24,0.34)', zIndex: 44 }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 45, width, maxWidth: 'calc(100% - 40px)', background: MJ.surface, borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
        {title && <p style={{ margin: 0, padding: '18px 20px 6px', fontSize: 15, fontWeight: 700, color: MJ.ink }}>{title}</p>}
        {children}
      </div>
    </>
  );
}

Object.assign(window, {
  MJ, FOYER_COLORS, Lc, CocotteMark, PhoneFrame, PHONE_W,
  Avatar, FoyerDot, HomeHeader, PillNav, Screen, TopBar, PageTitle, SectionLabel,
  Card, Row, Hairline, RolePill, PrimaryPill, GradientCTA, TextLink, LinkBlock, HintCard, GridCard, Sheet, Dialog,
  IconArrowLeft, IconChevronLeft, IconChevronRight, IconChevronDown, IconArrowRight, IconPencil, IconTrash,
  IconCheck, IconCheckCircle, IconUsers, IconX, IconCopy, IconPlus, IconHome, IconBook, IconMail, IconKey,
  IconSearch, IconShieldCheck, IconEye, IconLock, IconLogOut, IconMove, IconSwitch, IconSmartphone, IconSparkle, IconChart, IconSettings,
  IconShare, IconFolderInput, RecipeActionPill, BackCircle,
});
