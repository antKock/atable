/* =========================================================================
   Mijote — Foyer · ACTE 1 — Feature 14 : Récupération d'accès  (v4)
   - Hints déclinés : « install » minimaliste toujours au-dessus + UN hint
     principal (partage OU email). Tous dismissables, ne reviennent plus.
   - Landing : CTA espacés du logo.
   - Récup email inconnu → même écran (anti-énumération).
   - Fusion : UNIQUEMENT quand on saisit, depuis le profil, un email déjà pris.
   ========================================================================= */

const {
  MJ, Screen, TopBar, PageTitle, PrimaryPill, TextLink, HintCard, HomeHeader, PillNav, GridCard,
  IconMail, IconKey, IconShieldCheck, IconCheckCircle, IconX, IconSmartphone, IconUsers, IconArrowRight,
} = window;

const FOOD1 = [['#d8c49a', '#9c7f4f'], ['#c9a27a', '#7d5a38']];

/* Minimal one-line install strip (iOS only for now) — above the main hint, dismissable. */
function MiniInstallStrip() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 8px 0 12px', borderRadius: 10, background: MJ.surface, boxShadow: `inset 0 0 0 1px ${MJ.border}` }}>
      <IconSmartphone size={15} color={MJ.muted} />
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: MJ.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Installe l'app Mijote</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: MJ.accent }}>Installer</span>
      <span style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MJ.navInactive }}><IconX size={13} /></span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   1.1 — Hints sur la home : install (mini) + UN hint principal (email/partage)
   ───────────────────────────────────────────────────────────────────────── */
function HintEmailScreen({ main = 'email' }) {
  return (
    <Screen scroll>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, marginTop: -38, paddingTop: 38, background: 'rgba(245,241,232,0.92)', backdropFilter: 'blur(12px)' }}>
        <HomeHeader />
      </div>
      <div style={{ padding: '10px 16px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <MiniInstallStrip />
        {main === 'email' ? (
          <HintCard icon={<IconShieldCheck size={20} />} title="Sauvegarde ton accès" body="Ajoute un email et tu retrouveras ce foyer même si tu changes d'appareil. Pas de compte, pas de mot de passe." cta="Ajouter un email" />
        ) : (
          <HintCard icon={<IconUsers size={20} />} title="Cuisinez à plusieurs" body="Invite les gens de ton foyer : vos recettes se retrouvent au même endroit, en direct." cta="Inviter quelqu'un" />
        )}
      </div>
      <div style={{ padding: '14px 0 0' }}>
        <p style={{ margin: '0 0 10px 16px', fontFamily: MJ.fontDisplay, fontVariationSettings: '"opsz" 144', fontStyle: 'italic', fontWeight: 500, fontSize: 18, color: MJ.ink }}>Nouvelles recettes</p>
        <div style={{ display: 'flex', gap: 11, overflow: 'hidden', padding: '0 16px' }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ width: 200, flex: 'none' }}>
              <GridCard variant="carousel" title={['Gratin dauphinois aux herbes', 'Curry de courge & lait de coco'][i]} colors={FOOD1[i]} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 90 }} />
      <PillNav active="home" />
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   1.2 — Fork d'onboarding (CTA espacés du logo)
   ───────────────────────────────────────────────────────────────────────── */
function OnboardingForkScreen({ view = 'menu' }) {
  if (view === 'have') {
    return (
      <Screen>
        <div style={{ position: 'absolute', inset: 0, background: MJ.sageBg }} />
        <div style={{ position: 'absolute', top: 46, left: 10, color: MJ.cream }}><IconChevronLeftLite /></div>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '0 24px 40px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', paddingTop: 40, paddingBottom: 48 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MJ.cream, boxShadow: 'inset 0 0 0 1.5px rgba(245,241,232,0.5)' }}>
              <IconKey size={30} />
            </div>
            <h1 style={{ margin: '22px 0 0', fontFamily: MJ.fontDisplay, fontVariationSettings: '"opsz" 144', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: MJ.cream, lineHeight: 1.02 }}>Rejoindre<br />un foyer</h1>
            <p style={{ margin: '12px 0 0', fontSize: 14.5, color: 'rgba(245,241,232,0.85)', maxWidth: 272, lineHeight: 1.5 }}>Avec le code d'invitation d'un proche, ou l'email que tu avais sauvegardé.</p>
          </div>
          <button style={{ height: 54, borderRadius: 27, border: 'none', background: MJ.cream, color: MJ.ink, fontSize: 17, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
            <IconKey size={18} /> J'ai un code d'invitation
          </button>
          <button style={{ marginTop: 10, height: 54, borderRadius: 27, background: 'transparent', color: MJ.cream, fontSize: 16, fontWeight: 500, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: 'inset 0 0 0 1.5px rgba(245,241,232,0.55)', cursor: 'pointer' }}>
            <IconMail size={18} /> Récupérer avec mon email
          </button>
        </div>
      </Screen>
    );
  }
  return (
    <Screen>
      <div style={{ position: 'absolute', inset: 0, background: MJ.sageBg }} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '0 24px 40px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingTop: 40, paddingBottom: 48 }}>
          <img src="cocotte-illustration.svg" alt="" width={180} height={180} style={{ display: 'block' }} />
          <h1 style={{ margin: '12px 0 0', fontFamily: MJ.fontDisplay, fontVariationSettings: '"opsz" 144', fontWeight: 700, fontSize: 68, letterSpacing: '-0.025em', color: MJ.cream, lineHeight: 0.95 }}>Mijote</h1>
        </div>
        <button style={{ height: 54, borderRadius: 27, border: 'none', background: MJ.cream, color: MJ.ink, fontSize: 17, fontWeight: 600, cursor: 'pointer' }}>Essayer l'app</button>
        <button style={{ marginTop: 10, height: 54, borderRadius: 27, background: 'transparent', color: MJ.cream, fontSize: 17, fontWeight: 600, border: 'none', boxShadow: 'inset 0 0 0 1.5px rgba(245,241,232,0.55)', cursor: 'pointer' }}>Créer un foyer</button>
        <button style={{ marginTop: 12, background: 'transparent', border: 'none', color: MJ.cream, fontSize: 16, fontWeight: 500, padding: '10px 0', cursor: 'pointer' }}>Rejoindre un foyer</button>
      </div>
    </Screen>
  );
}
function IconChevronLeftLite() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>;
}

/* ─────────────────────────────────────────────────────────────────────────
   1.3 — Récupération : saisie de l'email
   ───────────────────────────────────────────────────────────────────────── */
function RecoverScreen() {
  return (
    <Screen>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #F5F1E8, #EDE8E0)' }} />
      <div style={{ position: 'absolute', top: 46, left: 10, color: MJ.ink }}><IconChevronLeftLite /></div>
      <div style={{ position: 'relative', padding: '76px 24px 0' }}>
        <PageTitle size={27}>Récupérer mon accès</PageTitle>
        <p style={{ margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.5, color: 'rgba(26,26,24,0.55)', maxWidth: 290 }}>
          Entre l'email que tu avais sauvegardé. On t'envoie un lien pour retrouver ton foyer sur cet appareil.
        </p>
        <div style={{ marginTop: 24, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: 'rgba(26,26,24,0.5)' }}><IconMail size={19} /></span>
          <div style={{ height: 54, borderRadius: 14, background: MJ.surface, boxShadow: `inset 0 0 0 1.5px ${MJ.accent}`, display: 'flex', alignItems: 'center', padding: '0 16px 0 44px' }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: MJ.ink }}>a.kocken@gmail.com</span>
          </div>
        </div>
        <PrimaryPill style={{ marginTop: 16 }}>Envoyer le lien</PrimaryPill>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   1.4 — Lien envoyé + repli code · variante fusion (depuis le profil)
   ───────────────────────────────────────────────────────────────────────── */
function VerifyScreen({ merge = false }) {
  return (
    <Screen scroll>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #F5F1E8, #EDE8E0)' }} />
      <div style={{ position: 'absolute', top: 46, left: 10, zIndex: 5, color: MJ.ink }}><IconChevronLeftLite /></div>
      <div style={{ position: 'relative', padding: '64px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: merge ? 'rgba(110,122,56,0.14)' : MJ.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MJ.accent, marginBottom: 18 }}>
          {merge ? <IconCheckCircle size={33} /> : <IconMail size={33} />}
        </div>
        <PageTitle size={25}>{merge ? 'On réunit tes foyers' : 'Vérifie tes mails'}</PageTitle>
        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: MJ.muted, maxWidth: 272 }}>
          {merge
            ? <>Cet email est déjà utilisé par un autre profil. Ouvre le lien qu'on vient d'envoyer pour <strong style={{ color: MJ.ink }}>fusionner</strong> les deux accès en une seule identité.</>
            : <>On a envoyé un lien de connexion à cette adresse&nbsp;:</>}
        </p>
        {!merge && <p style={{ margin: '6px 0 0', fontSize: 14.5, fontWeight: 600, color: MJ.ink }}>a.kocken@gmail.com</p>}
        {!merge && <p style={{ margin: '6px 0 0', fontSize: 13.5, color: MJ.muted }}>Ouvre-le pour confirmer — c'est tout.</p>}

        <div style={{ marginTop: 22, width: '100%', borderRadius: 14, background: MJ.muted50, boxShadow: `inset 0 0 0 1px ${MJ.border}`, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: MJ.muted }}>
            <strong style={{ color: MJ.ink }}>Tu lis tes mails sur un autre appareil&nbsp;?</strong> Saisis plutôt le code reçu.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
            {['4', '8', '2', '', '', ''].map((d, i) => (
              <div key={i} style={{ width: 38, height: 48, borderRadius: 10, background: MJ.surface, boxShadow: `inset 0 0 0 1.5px ${i === 3 ? MJ.accent : MJ.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MJ.fontMono, fontSize: 20, fontWeight: 500, color: MJ.ink }}>{d}</div>
            ))}
          </div>
        </div>
        <TextLink style={{ marginTop: 16 }} color={MJ.muted}>Renvoyer · 0:42</TextLink>
      </div>
    </Screen>
  );
}

Object.assign(window, {
  HintEmailScreen, OnboardingForkScreen, RecoverScreen, VerifyScreen,
});
