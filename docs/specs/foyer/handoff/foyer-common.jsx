/* =========================================================================
   Mijote — Foyer · ACTE 0 — Tronc commun (v3)
   - Home lean : accès via icône Réglages, carrousels horizontaux, PAS de
     switcher ni de filtre foyer (le foyer se filtre seulement en bibliothèque).
   - Hub = Toi (une seule ligne → profil) + Tes foyers.
   - Détail de foyer : membres listés inline (moins de clics).
   - Profil = nom + email de secours (saisi ici, aucun envoi).
   - Choix de foyer : tap = confirme + enregistre (pas de bouton).
   ========================================================================= */

const {
  MJ, Screen, TopBar, PageTitle, SectionLabel, Card, Row, Hairline, RolePill,
  PrimaryPill, TextLink, GridCard, Sheet, HomeHeader, PillNav,
  IconChevronRight, IconPencil, IconCheck, IconUsers, IconMail, IconShieldCheck,
  IconPlus, IconEye, IconLock, IconTrash,
} = window;

const FOOD = [
  ['#d8c49a', '#9c7f4f'], ['#c9a27a', '#7d5a38'], ['#b7c39a', '#7d8c50'],
  ['#e0b48c', '#a86b3d'], ['#c6b0c0', '#8a5a7c'], ['#a9c2c9', '#4e7c8a'],
];

/* ─────────────────────────────────────────────────────────────────────────
   0.1 — Home lean : icône Réglages, carrousels horizontaux, aucun marqueur foyer
   ───────────────────────────────────────────────────────────────────────── */
function HomeAccessScreen() {
  return (
    <Screen scroll>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, marginTop: -38, paddingTop: 38, background: 'rgba(245,241,232,0.92)', backdropFilter: 'blur(12px)' }}>
        <HomeHeader />
        <div style={{ padding: '4px 16px 8px' }}>
          <div style={{ height: 44, borderRadius: 12, background: MJ.surface, boxShadow: `inset 0 0 0 1px ${MJ.border}`, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', color: MJ.muted }}>
            <IconSearchLite /><span style={{ fontSize: 14.5 }}>Rechercher une recette…</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 0 0' }}>
        <p style={{ margin: '0 0 10px 16px', fontFamily: MJ.fontDisplay, fontVariationSettings: '"opsz" 144', fontStyle: 'italic', fontWeight: 500, fontSize: 18, color: MJ.ink }}>Nouvelles recettes</p>
        <div style={{ display: 'flex', gap: 11, overflow: 'hidden', padding: '0 16px' }}>
          {[0, 1].map((i, k) => (
            <div key={i} style={{ width: 200, flex: 'none' }}>
              <GridCard variant="carousel" title={['Gratin dauphinois aux herbes', 'Curry de courge & lait de coco'][k]} colors={FOOD[i]} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '18px 0 0' }}>
        <p style={{ margin: '0 0 10px 16px', fontFamily: MJ.fontDisplay, fontVariationSettings: '"opsz" 144', fontStyle: 'italic', fontWeight: 500, fontSize: 18, color: MJ.ink }}>À redécouvrir</p>
        <div style={{ display: 'flex', gap: 11, overflow: 'hidden', padding: '0 16px' }}>
          {[2, 3].map((i, k) => (
            <div key={i} style={{ width: 200, flex: 'none' }}>
              <GridCard variant="carousel" title={['Salade de lentilles tièdes', 'Poulet rôti au citron'][k]} colors={FOOD[i]} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 90 }} />
      <PillNav active="home" />
    </Screen>
  );
}
function IconSearchLite() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
}

/* ─────────────────────────────────────────────────────────────────────────
   0.2 — Hub : Toi (une ligne → profil) + Tes foyers
   ───────────────────────────────────────────────────────────────────────── */
function FoyerHubScreen() {
  return (
    <Screen scroll>
      <TopBar title="Foyer & profil" />
      <div style={{ padding: '4px 16px 8px' }}>
        {/* Toi — une seule ligne qui ouvre le profil (nom + email éditables ensemble) */}
        <SectionLabel style={{ marginBottom: 10 }}>Toi</SectionLabel>
        <Card>
          <Row icon={<IconShieldCheck size={18} color={MJ.accent} />} title="Anthony" sub="Nom & sauvegarde d'accès" trailing={<IconChevronRight size={18} color={MJ.muted} />} />
        </Card>

        {/* Tes foyers — tous égaux, ouvrables en tapant. Sous-titre = tag rôle puis détails. */}
        <SectionLabel style={{ margin: '24px 0 10px' }}>Tes foyers</SectionLabel>
        <Card>
          <Row title="Chez nous" sub={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><RolePill role="membre" />2 personnes · 38 recettes</span>} trailing={<IconChevronRight size={17} color={MJ.muted} />} />
          <Hairline />
          <Row title="Colloc' du 12" sub={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><RolePill role="membre" />4 personnes · 12 recettes</span>} trailing={<IconChevronRight size={17} color={MJ.muted} />} />
          <Hairline />
          <Row title="Recettes de maman" sub={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><RolePill role="invité" />7 recettes</span>} trailing={<IconChevronRight size={17} color={MJ.muted} />} />
          <Hairline />
          <Row icon={<IconPlus size={18} color={MJ.accent} />} title={<span style={{ color: MJ.accent, fontWeight: 600 }}>Créer ou rejoindre un foyer</span>} onColor={MJ.accent} />
        </Card>
        <div style={{ height: 24 }} />
      </div>
    </Screen>
  );
}

/* 0.2b — Détail d'un foyer : membres listés inline (moins de clics) */
function FoyerDetailScreen({ guest = false }) {
  return (
    <Screen scroll>
      <TopBar title="" />
      <div style={{ padding: '2px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <PageTitle size={30}>Chez nous</PageTitle>
          {!guest && <IconPencil size={17} color={MJ.muted} />}
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: MJ.muted }}>{guest ? 'Invité · 3 personnes' : 'Membre · 2 personnes'}</p>

        {guest && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, borderRadius: 12, background: MJ.chipBg, padding: '11px 13px', marginBottom: 18 }}>
            <IconEye size={17} color={MJ.muted} />
            <span style={{ fontSize: 12.5, lineHeight: 1.4, color: MJ.muted }}>Tu peux consulter les recettes en direct, mais pas les modifier.</span>
          </div>
        )}

        {/* Membres listés directement, chacun tappable (chevron) */}
        <SectionLabel style={{ marginBottom: 10 }}>Membres</SectionLabel>
        <Card>
          <Row title="Anthony (toi)" trailing={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><RolePill role={guest ? 'invité' : 'membre'} /><IconChevronRight size={17} color={MJ.muted} /></span>} />
          <Hairline />
          <Row title="Camille" trailing={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><RolePill role="membre" /><IconChevronRight size={17} color={MJ.muted} /></span>} />
          {guest && <><Hairline /><Row title="Maman" trailing={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><RolePill role="membre" /><IconChevronRight size={17} color={MJ.muted} /></span>} /></>}
        </Card>

        {!guest && (
          <div style={{ marginTop: 12 }}>
            <Card><Row icon={<IconPlus size={19} color={MJ.accent} />} title={<span style={{ color: MJ.accent, fontWeight: 600 }}>Inviter quelqu'un</span>} onColor={MJ.accent} /></Card>
          </div>
        )}

        <div style={{ height: 16 }} />
        <TextLink color={MJ.destructive}>Quitter ce foyer</TextLink>
        {!guest && <TextLink color={MJ.destructive}>Supprimer le foyer</TextLink>}
        <div style={{ height: 24 }} />
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   0.3 — Profil (« Toi ») : nom (pas d'avatar) + email de secours
   Saisir l'email n'envoie RIEN — le lien part seulement à la récup (Acte 1).
   ───────────────────────────────────────────────────────────────────────── */
function ProfilScreen({ empty = false }) {
  return (
    <Screen>
      <TopBar title="Ton profil" right={<span style={{ fontSize: 15, fontWeight: 600, color: MJ.accent, paddingRight: 10 }}>OK</span>} />
      <div style={{ padding: '10px 20px' }}>
        <SectionLabel style={{ marginBottom: 8 }}>Ton nom</SectionLabel>
        <div style={{ height: 54, borderRadius: 14, background: MJ.surface, boxShadow: `inset 0 0 0 1.5px ${empty ? MJ.border : MJ.accent}`, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <span style={{ fontSize: 17, fontWeight: 500, color: empty ? 'rgba(26,26,24,0.32)' : MJ.ink }}>{empty ? 'Lapin Farceur' : 'Anthony'}</span>
          {!empty && <span style={{ marginLeft: 'auto', width: 2, height: 22, background: MJ.accent, borderRadius: 1 }} />}
        </div>
        <p style={{ margin: '10px 2px 0', fontSize: 12.5, lineHeight: 1.45, color: MJ.muted }}>
          {empty ? 'Laisse vide et on te donne un alias par défaut. Changeable quand tu veux.' : 'Ton nom apparaît auprès des autres membres de tes foyers.'}
        </p>

        <SectionLabel style={{ margin: '26px 0 8px' }}>Retrouver ton accès</SectionLabel>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(26,26,24,0.5)' }}><IconMail size={19} /></span>
          <div style={{ height: 54, borderRadius: 14, background: MJ.surface, boxShadow: `inset 0 0 0 1.5px ${empty ? MJ.border : MJ.border}`, display: 'flex', alignItems: 'center', padding: '0 16px 0 46px' }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: empty ? 'rgba(26,26,24,0.32)' : MJ.ink }}>{empty ? 'ton@email.com' : 'a.kocken@gmail.com'}</span>
          </div>
        </div>
        <p style={{ margin: '10px 2px 0', fontSize: 12.5, lineHeight: 1.45, color: MJ.muted }}>
          Ton email sert uniquement à <strong style={{ color: MJ.ink }}>retrouver ton accès</strong> si tu changes ou perds ton appareil. On t'enverra un lien seulement à ce moment-là — pas de mot de passe, pas de compte.
        </p>
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   0.4 — Choix de foyer (sheet à l'enregistrement). Tap sur un foyer = confirme
   ET enregistre → pas de bouton. Une recette = un seul foyer.
   ───────────────────────────────────────────────────────────────────────── */
function ChoixFoyerSheetScreen() {
  return (
    <Screen>
      <TopBar title="Nouvelle recette" />
      <div style={{ padding: '6px 16px', opacity: 0.45 }}>
        <div style={{ height: 40, borderRadius: 10, background: MJ.surface, boxShadow: `inset 0 0 0 1px ${MJ.border}`, marginBottom: 10 }} />
        <div style={{ height: 120, borderRadius: 10, background: MJ.surface, boxShadow: `inset 0 0 0 1px ${MJ.border}` }} />
      </div>
      <Sheet title="Enregistrer dans quel foyer ?">
        <div style={{ padding: '0 8px 6px' }}>
          {[
            { name: 'Chez nous', sub: '38 recettes' },
            { name: "Colloc' du 12", sub: '12 recettes' },
          ].map((f) => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 12px', borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: MJ.ink }}>{f.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: MJ.muted }}>{f.sub}</p>
              </div>
              <IconChevronRight size={18} color={MJ.muted} />
            </div>
          ))}
          <div style={{ height: 1, background: MJ.border, margin: '4px 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px' }}>
            <IconLock size={15} color={MJ.navInactive} />
            <span style={{ fontSize: 12.5, color: MJ.muted, lineHeight: 1.4 }}>Les foyers où tu es invité sont en lecture seule — pas de destination possible.</span>
          </div>
        </div>
      </Sheet>
    </Screen>
  );
}

Object.assign(window, {
  HomeAccessScreen, FoyerHubScreen, FoyerDetailScreen, ProfilScreen, ChoixFoyerSheetScreen,
});
