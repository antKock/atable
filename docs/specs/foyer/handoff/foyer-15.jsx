/* =========================================================================
   Mijote — Foyer · ACTE 2 — Feature 15 : Multi-foyer à rôles  (v4)
   - Inviter = écran plein (pas une sheet).
   - Membres : cartes + chevrons (tappable), action rôle-aware (membre⇄invité).
   - Biblio : filtre foyer aligné sur la vraie FilterBar (wrap de pills dans un
     Popover), multi-select ; marqueur = label texte discret.
   - Déplacer : depuis la vraie pill d'actions de la fiche (icône ajoutée),
     copy de lecture-seule générique (pas de nom de foyer).
   - Desktop : une vraie bottom-sheet (choix de foyer) → dialog centré.
   ========================================================================= */

const {
  MJ, Screen, TopBar, PageTitle, SectionLabel, Card, Row, Hairline, RolePill,
  GradientCTA, TextLink, LinkBlock, GridCard, Sheet, Dialog, PillNav, RecipeActionPill, BackCircle,
  IconChevronRight, IconChevronDown, IconCheck, IconEye, IconLock, IconUsers, IconKey,
  IconLogOut, IconSearch, IconSwitch,
} = window;

const FOODS = [['#d8c49a', '#9c7f4f'], ['#c9a27a', '#7d5a38'], ['#b7c39a', '#7d8c50'], ['#e0b48c', '#a86b3d'], ['#c6b0c0', '#8a5a7c'], ['#a9c2c9', '#4e7c8a']];

/* ─────────────────────────────────────────────────────────────────────────
   2.1 — Inviter dans un foyer : rôle (invité / membre) + 2 liens (écran plein)
   ───────────────────────────────────────────────────────────────────────── */
function InviteScreen() {
  return (
    <Screen scroll>
      <TopBar title="Inviter" />
      <div style={{ padding: '4px 16px' }}>
        <PageTitle size={25}>Inviter dans<br /><em style={{ fontStyle: 'italic', color: MJ.accent, fontWeight: 500 }}>Chez nous</em></PageTitle>
        <p style={{ margin: '12px 0 22px', fontSize: 14, lineHeight: 1.5, color: MJ.muted }}>
          Deux liens, selon l'accès que tu veux donner. Partage celui qui convient (WhatsApp, SMS…).
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: MJ.accentSoft, color: MJ.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconUsers size={15} /></span>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: MJ.ink }}>Membre</span>
          <span style={{ fontSize: 12.5, color: MJ.muted }}>· consulte et modifie</span>
        </div>
        <LinkBlock label="Lien membre" value="mijote.app/j/olive-4821" icon={<IconKey size={17} />} />

        <div style={{ height: 20 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: MJ.chipBg, color: MJ.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconEye size={15} /></span>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: MJ.ink }}>Invité</span>
          <span style={{ fontSize: 12.5, color: MJ.muted }}>· lecture seule, en direct</span>
        </div>
        <LinkBlock label="Lien invité" value="mijote.app/j/olive-7712" icon={<IconEye size={17} />} accentIcon={false} />

        <p style={{ margin: '18px 2px 0', fontSize: 12, lineHeight: 1.45, color: MJ.muted }}>
          Pour retirer quelqu'un plus tard, va dans <strong style={{ color: MJ.ink }}>Membres</strong> — pas besoin de changer le lien.
        </p>
        <div style={{ height: 24 }} />
      </div>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   2.2 — Membres d'un foyer : cartes + chevrons (tappable) + révocation
   ───────────────────────────────────────────────────────────────────────── */
function MembersScreen() {
  const trail = (role) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><RolePill role={role} /><IconChevronRight size={17} color={MJ.muted} /></span>;
  return (
    <Screen scroll>
      <TopBar title="Membres" right={<span style={{ fontSize: 13.5, fontWeight: 600, color: MJ.accent, paddingRight: 10 }}>Inviter</span>} />
      <div style={{ padding: '4px 16px 8px' }}>
        <SectionLabel style={{ marginBottom: 10 }}>Membres · 2</SectionLabel>
        <Card>
          <Row title="Anthony (toi)" trailing={trail('membre')} />
          <Hairline />
          <Row title="Camille" sub="Rejoint il y a 3 mois" trailing={trail('membre')} />
        </Card>

        <SectionLabel style={{ margin: '22px 0 10px' }}>Invités · 1</SectionLabel>
        <Card>
          <Row title="Maman" sub="Lecture seule" trailing={trail('invité')} />
        </Card>
        <p style={{ margin: '12px 2px 0', fontSize: 12.5, lineHeight: 1.45, color: MJ.muted }}>
          Touche une personne pour changer son rôle ou la retirer. La retirer coupe son accès immédiatement.
        </p>
        <div style={{ height: 24 }} />
      </div>
    </Screen>
  );
}

/* member action sheet — rôle-aware : membre → passer en invité ; invité → passer en membre */
function MemberActionScreen({ role = 'membre' }) {
  const isGuest = role === 'invité';
  return (
    <Screen>
      <TopBar title="Membres" />
      <div style={{ padding: '4px 16px', opacity: 0.45 }}>
        <div style={{ height: 56, borderRadius: 14, background: MJ.surface, boxShadow: `inset 0 0 0 1px ${MJ.border}`, marginBottom: 10 }} />
        <div style={{ height: 56, borderRadius: 14, background: MJ.surface, boxShadow: `inset 0 0 0 1px ${MJ.border}` }} />
      </div>
      <Sheet>
        <div style={{ padding: '2px 20px 8px' }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: MJ.ink }}>{isGuest ? 'Maman' : 'Camille'}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: MJ.muted }}>{isGuest ? 'Invité · lecture seule' : 'Membre · consulte et modifie'}</p>
        </div>
        <div style={{ padding: '6px 8px' }}>
          {isGuest
            ? <Row icon={<IconUsers size={19} />} title="Passer en membre (peut modifier)" style={{ padding: '13px 12px' }} />
            : <Row icon={<IconEye size={19} />} title="Passer en invité (lecture seule)" style={{ padding: '13px 12px' }} />}
          <Row icon={<IconLogOut size={19} color={MJ.destructive} />} title={<span style={{ color: MJ.destructive }}>Retirer du foyer</span>} onColor={MJ.destructive} style={{ padding: '13px 12px' }} />
        </div>
      </Sheet>
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   2.3 — Bibliothèque multi-foyer : filtre aligné sur la vraie FilterBar
   ───────────────────────────────────────────────────────────────────────── */
function FilterPill({ children, active = false, count }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999,
      fontSize: 13, fontWeight: 500, flex: 'none',
      border: active ? '1px solid transparent' : `1px solid ${MJ.border}`,
      background: active ? MJ.accentSoft : MJ.surface,
      color: active ? MJ.accent : MJ.ink,
    }}>
      {children}
      {count != null && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: MJ.accent, color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>}
      <IconChevronDown size={13} />
    </span>
  );
}

/* option button inside the popover — matches FilterBar's wrap-of-pills exactly */
function OptPill({ children, selected }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
      border: selected ? '1px solid transparent' : `1px solid ${MJ.border}`,
      background: selected ? MJ.accentSoft : 'transparent',
      color: selected ? MJ.accent : MJ.ink,
    }}>
      {selected && <IconCheck size={12} stroke={2.5} />}{children}
    </span>
  );
}

function LibraryMultiScreen({ popover = false }) {
  const cards = [
    { t: 'Gratin dauphinois aux herbes', c: FOODS[0], f: 'Chez nous' },
    { t: 'Tajine d\u2019agneau aux abricots', c: FOODS[3], f: "Colloc'" },
    { t: 'Tarte aux pommes de maman', c: FOODS[4], f: 'Maman' },
    { t: 'Curry de courge & coco', c: FOODS[2], f: 'Chez nous' },
    { t: 'Ceviche de dorade', c: FOODS[5], f: "Colloc'" },
    { t: 'Riz cantonais express', c: FOODS[1], f: 'Chez nous' },
  ];
  return (
    <Screen scroll>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, marginTop: -38, paddingTop: 38, background: 'rgba(245,241,232,0.92)', backdropFilter: 'blur(12px)' }}>
        <div style={{ padding: '8px 16px 4px' }}>
          <div style={{ height: 42, borderRadius: 12, background: MJ.surface, boxShadow: `inset 0 0 0 1px ${MJ.border}`, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', color: MJ.muted }}>
            <IconSearch size={16} /><span style={{ fontSize: 14 }}>Rechercher…</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px 10px', overflow: 'hidden', position: 'relative' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${MJ.border}`, background: MJ.surface, fontSize: 13, fontWeight: 500, flex: 'none', color: MJ.ink }}>De saison</span>
          <FilterPill active count={2}>Foyer</FilterPill>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${MJ.border}`, background: MJ.surface, fontSize: 13, fontWeight: 500, flex: 'none', color: MJ.ink }}>Type de plat <IconChevronDown size={13} /></span>
        </div>
        {popover && (
          <div style={{ position: 'absolute', top: 116, left: 58, zIndex: 30, background: MJ.surface, border: `1px solid ${MJ.border}`, borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,0.16)', padding: 12, maxWidth: 240 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <OptPill selected>Chez nous</OptPill>
              <OptPill selected>Colloc' du 12</OptPill>
              <OptPill>Recettes de maman</OptPill>
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '4px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
        {cards.map((c, i) => <GridCard key={i} variant="grid" title={c.t} colors={c.c} foyerLabel={c.f} />)}
      </div>
      <div style={{ height: 90 }} />
      <PillNav active="library" />
    </Screen>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   2.4 — Déplacer une recette : depuis la vraie pill d'actions de la fiche
   ───────────────────────────────────────────────────────────────────────── */
function MoveRecipeScreen() {
  return (
    <Screen>
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ height: 210, position: 'relative', background: `linear-gradient(155deg, ${FOODS[0][0]}, ${FOODS[0][1]})` }}>
          <BackCircle />
          <RecipeActionPill move highlight="move" />
        </div>
        <div style={{ padding: '18px 18px' }}>
          <p style={{ margin: 0, fontFamily: MJ.fontDisplay, fontVariationSettings: '"opsz" 144', fontWeight: 600, fontSize: 26, color: MJ.ink, letterSpacing: '-0.02em' }}>Gratin dauphinois</p>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(245,241,232,0.4)' }} />
      <Sheet title="Déplacer vers quel foyer ?">
        <div style={{ padding: '0 8px 6px' }}>
          {[
            { name: 'Chez nous', cur: true },
            { name: "Colloc' du 12" },
          ].map((f) => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 12px', borderRadius: 12, background: f.cur ? MJ.accentSoft : 'transparent' }}>
              <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600, color: MJ.ink }}>{f.name}</span>
              {f.cur ? <span style={{ fontSize: 12, fontWeight: 600, color: MJ.accent }}>Actuel</span> : <IconChevronRight size={17} color={MJ.muted} />}
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

/* ─────────────────────────────────────────────────────────────────────────
   2.5 — Desktop / tablette : une vraie bottom-sheet → dialog centré
   Exemple avec « choix de foyer » (qui EST une sheet sur mobile).
   ───────────────────────────────────────────────────────────────────────── */
function DesktopSheetDialog() {
  return (
    <div style={{ width: 640, height: 440, borderRadius: 16, overflow: 'hidden', position: 'relative', background: MJ.bg, boxShadow: '0 30px 70px -20px rgba(45,53,32,0.4)', border: `1px solid ${MJ.border}` }}>
      {/* faded library behind */}
      <div style={{ position: 'absolute', inset: 0, padding: 24, opacity: 0.5 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} style={{ aspectRatio: '3/4', borderRadius: 12, background: `linear-gradient(155deg, ${FOODS[i % 6][0]}, ${FOODS[i % 6][1]})` }} />)}
        </div>
      </div>
      <Dialog title="Enregistrer dans quel foyer ?" width={380}>
        <div style={{ padding: '8px 10px 16px' }}>
          {[
            { name: 'Chez nous', sub: '38 recettes' },
            { name: "Colloc' du 12", sub: '12 recettes' },
          ].map((f) => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', borderRadius: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: MJ.ink }}>{f.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: MJ.muted }}>{f.sub}</p>
              </div>
              <IconChevronRight size={18} color={MJ.muted} />
            </div>
          ))}
          <div style={{ height: 1, background: MJ.border, margin: '4px 12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px' }}>
            <IconLock size={15} color={MJ.navInactive} />
            <span style={{ fontSize: 12, color: MJ.muted, lineHeight: 1.4 }}>Les foyers où tu es invité sont en lecture seule.</span>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

Object.assign(window, {
  InviteScreen, MembersScreen, MemberActionScreen, LibraryMultiScreen, MoveRecipeScreen, DesktopSheetDialog,
});
