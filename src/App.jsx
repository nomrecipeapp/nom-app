import './index.css'

export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '8px'
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '72px',
        fontWeight: '700',
        color: 'var(--clay)',
        letterSpacing: '-3px',
        lineHeight: '1'
      }}>
        Nom
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: '14px',
        color: 'var(--muted)',
        letterSpacing: '0.08em'
      }}>
        Your kitchen, your story.
      </div>
    </div>
  )
}