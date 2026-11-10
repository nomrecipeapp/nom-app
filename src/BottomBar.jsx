// The one floating bar that sits just above the bottom nav. Every pinned action uses it,
// so they all line up, look the same and slide in the same way:
//   - FloatingAction (Log a Cook, Save to My Cookbook) on recipe pages
//   - Cookbook Select mode (Add tag, Remove tag, Delete)
//
//   <BottomBar visible={selecting} space={120}>...buttons...</BottomBar>
//
// Place it at the very end of the screen's scrolling content. `space` is how much room it
// leaves at the bottom of the page so the bar never covers the last lines.

export const BAR_SHADOW = '0 8px 24px rgba(28,26,23,0.18)'

export default function BottomBar({ visible = true, space = 72, children }) {
  return (
    <>
      <div aria-hidden="true" style={{ height: space }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 'var(--nav-clearance)', zIndex: 110,
        display: 'flex', justifyContent: 'center', padding: '0 16px',
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}>
        <div aria-hidden={!visible} style={{ width: '100%', maxWidth: '448px' }}>
          {children}
        </div>
      </div>
    </>
  )
}
