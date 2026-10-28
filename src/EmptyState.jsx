// One look for every "nothing here yet" moment: an icon, a headline that invites,
// one line that explains, and up to two actions.
//
//   <EmptyState icon={IconBook} title="Your Cookbook starts here"
//     body="Save from any website..." primary={{ label: 'Add a recipe', icon: IconPlus, onClick }}
//     secondary={{ label: 'Log a cook', onClick }} />

export default function EmptyState({ icon: Icon, title, body, primary, secondary, card = true }) {
  return (
    <div style={{
      textAlign: 'center', padding: card ? '40px 24px' : '32px 8px',
      ...(card ? { background: 'var(--warm-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--parchment)' } : {})
    }}>
      {Icon && (
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 16px',
          background: 'var(--parchment)', color: 'var(--clay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={26} strokeWidth={1.8} />
        </div>
      )}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '500', color: 'var(--ink)', lineHeight: '1.25', marginBottom: '8px' }}>
        {title}
      </div>
      {body && (
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6', maxWidth: '290px', margin: '0 auto' }}>
          {body}
        </div>
      )}
      {(primary || secondary) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '22px' }}>
          {primary && (
            <button onClick={primary.onClick} style={{
              padding: '13px 26px', background: 'var(--clay)', color: 'var(--cream)',
              border: 'none', borderRadius: 'var(--radius-pill)',
              fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '8px'
            }}>
              {primary.icon && <primary.icon size={16} strokeWidth={2.2} />}
              {primary.label}
            </button>
          )}
          {secondary && (
            <button onClick={secondary.onClick} style={{
              padding: '8px 14px', background: 'none', color: 'var(--clay)', border: 'none',
              fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
            }}>{secondary.label}</button>
          )}
        </div>
      )}
    </div>
  )
}
