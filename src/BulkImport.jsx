// "Bring your recipes": bring a whole library in at once, from another app's
// export file or a pasted list of links.
//
// Steps: pick a source → choose a file or paste links → choose what to bring
// in (everything is ticked) → importing → done. Recipes come in as Want to
// Make, stay out of friends' Feeds, and anything that looks incomplete lands
// in the Cookbook's Needs a look filter instead of making people review it all.
//
// Limits: files are unlimited. Links use the normal daily link limit, up to
// LINKS_PER_PASTE at a time; links that don't fit are saved for tomorrow.
import { useEffect, useMemo, useRef, useState } from 'react'
import { SOURCES, readSourceFile } from './importSources'
import {
  LINKS_PER_PASTE, loadExisting, splitDuplicates, linksFromText, siteLabel,
  linksLeftToday, saveImported, runPool, fetchLink,
} from './bulkImport'
import { addWaitingLinks, getWaitingLinks, setWaitingLinks } from './waitingLinks'
import { IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconX } from './icons'
import { toast } from './ui'
import { success, tap } from './haptics'

const display = { fontFamily: 'var(--font-display)', color: 'var(--ink)', lineHeight: 1.2 }
const body = { fontFamily: 'var(--font-body)' }
const primaryBtn = (disabled) => ({
  width: '100%', minHeight: '50px', padding: '14px', border: 'none', borderRadius: 'var(--radius-pill)',
  background: disabled ? 'var(--tan)' : 'var(--clay)', color: 'var(--cream)',
  ...body, fontSize: '15px', fontWeight: '700', cursor: disabled ? 'default' : 'pointer',
})
const quietBtn = {
  width: '100%', minHeight: '44px', padding: '12px', background: 'none', border: 'none',
  ...body, fontSize: '14px', fontWeight: '600', color: 'var(--muted)', cursor: 'pointer',
}
const card = { background: 'var(--warm-white)', border: '1px solid var(--parchment)', borderRadius: 'var(--radius-md)' }

function Tick({ on, partial }) {
  return (
    <span aria-hidden="true" style={{
      width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: on || partial ? 'var(--clay)' : 'transparent',
      border: on || partial ? 'none' : '1.5px solid var(--tan)', color: 'var(--cream)',
    }}>
      {on ? <IconCheck size={14} strokeWidth={2.6} /> : partial ? <span style={{ width: '10px', height: '2.5px', borderRadius: '2px', background: 'var(--cream)' }} /> : null}
    </span>
  )
}

function Header({ title, sub, onBack }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <button onClick={onBack} aria-label="Back" style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '44px', padding: 0, marginBottom: '8px', background: 'none', border: 'none', color: 'var(--muted)', ...body, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
        <IconChevronLeft size={16} strokeWidth={2.2} /> Back
      </button>
      <div style={{ ...display, fontSize: '26px', fontWeight: '600', marginBottom: '6px' }}>{title}</div>
      {sub && <div style={{ ...body, fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5 }}>{sub}</div>}
    </div>
  )
}

const linkTitle = (url) => {
  try {
    const u = new URL(url)
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || u.hostname)
    return last.replace(/[-_]+/g, ' ').replace(/\.html?$/, '').slice(0, 70) || u.hostname
  } catch { return url }
}

export default function BulkImport({ session, onClose, onFinish, startWithWaiting = false }) {
  const userId = session.user.id
  const [stage, setStage] = useState('source') // source | file | paste | choose | importing | done
  const [source, setSource] = useState(null)   // a SOURCES entry, or 'links'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [pasted, setPasted] = useState('')
  const [linksLeft, setLinksLeft] = useState(null)

  const [items, setItems] = useState([])        // what can be imported
  const [skipped, setSkipped] = useState(0)     // already in the Cookbook
  const [selected, setSelected] = useState(new Set())
  const [open, setOpen] = useState(new Set())   // expanded groups
  const [search, setSearch] = useState('')

  const [progress, setProgress] = useState({ done: 0, total: 0, added: 0, needsLook: 0, recent: [] })
  const [result, setResult] = useState(null)
  const stopRef = useRef(false)
  const fileInput = useRef(null)

  const isLinks = source === 'links'

  useEffect(() => {
    linksLeftToday().then(n => setLinksLeft(n ?? LINKS_PER_PASTE))
    if (startWithWaiting) {
      getWaitingLinks(userId).then(list => {
        if (!list.length) return
        setSource('links')
        setPasted(list.join('\n'))
        setStage('paste')
      })
    }
  }, [userId, startWithWaiting])

  // Leaving mid-import would stop it, so ask first
  useEffect(() => {
    if (stage !== 'importing') return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [stage])

  // ── Groups for the choose screen ──
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const map = new Map()
    for (const it of items) {
      if (q && !it.title.toLowerCase().includes(q)) continue
      const names = it.groups.length ? it.groups : [isLinks ? 'Other' : 'No category']
      for (const g of names) {
        if (!map.has(g)) map.set(g, [])
        map.get(g).push(it)
      }
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [items, search, isLinks])

  const selectedItems = items.filter(it => selected.has(it.key))
  const allowedLinks = isLinks ? Math.max(0, Math.min(linksLeft ?? LINKS_PER_PASTE, LINKS_PER_PASTE)) : Infinity
  const importCount = Math.min(selectedItems.length, allowedLinks)
  const forTomorrow = selectedItems.length - importCount

  function toggle(key) {
    tap()
    setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleGroup(list) {
    tap()
    const allOn = list.every(it => selected.has(it.key))
    setSelected(s => {
      const n = new Set(s)
      list.forEach(it => allOn ? n.delete(it.key) : n.add(it.key))
      return n
    })
  }
  function toggleAll() {
    tap()
    setSelected(s => s.size === items.length ? new Set() : new Set(items.map(it => it.key)))
  }

  function showChoose(list, dupes) {
    setItems(list)
    setSkipped(dupes)
    setSelected(new Set(list.map(it => it.key)))
    setOpen(new Set())
    setSearch('')
    setStage('choose')
  }

  // ── Reading the file ──
  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (!source.looksRight(file)) {
      setError(`That doesn't look like a ${source.name} export. Look for a file ending in .paprikarecipes.`)
      return
    }
    setBusy(true)
    try {
      const [all, existing] = await Promise.all([readSourceFile(source, file), loadExisting(userId)])
      if (!all.length) { setError(`We couldn't find any recipes in that file. Try exporting from ${source.name} again.`); setBusy(false); return }
      const { fresh, dupes } = splitDuplicates(all, existing)
      if (!fresh.length) { setError(`All ${all.length} recipes in that file are already in your Cookbook.`); setBusy(false); return }
      showChoose(fresh, dupes.length)
    } catch (err) {
      console.error('Reading import file failed', err)
      setError("We couldn't open that file. Try exporting it again.")
    }
    setBusy(false)
  }

  // ── Reading pasted links ──
  async function findLinks() {
    setError(null)
    setBusy(true)
    try {
      const existing = await loadExisting(userId)
      const { fresh, dupes } = linksFromText(pasted, existing)
      if (!fresh.length) {
        setError(dupes.length ? 'Those recipes are already in your Cookbook.' : "We didn't find any links. Paste links that start with https://")
        setBusy(false)
        return
      }
      showChoose(fresh.map(url => ({ key: url, title: linkTitle(url), groups: [siteLabel(url)], url })), dupes.length)
    } catch {
      setError("Something went wrong. Check your connection and try again.")
    }
    setBusy(false)
  }

  // ── Importing ──
  async function startImport() {
    const list = selectedItems.slice(0, importCount)
    const later = isLinks ? selectedItems.slice(importCount).map(it => it.url) : []
    stopRef.current = false
    setProgress({ done: 0, total: list.length, added: 0, needsLook: 0, recent: [] })
    setStage('importing')

    const failed = []
    const unfinished = []
    let added = 0, needsLook = 0, limitHit = false
    const note = (title, ok) => setProgress(p => ({
      ...p, done: p.done + 1, added, needsLook,
      recent: [{ title, ok }, ...p.recent].slice(0, 4),
    }))

    await runPool(list, async (it) => {
      if (limitHit) { unfinished.push(it.url); return }
      try {
        if (isLinks) {
          const got = await fetchLink(it.url)
          if (got.limitReached) { limitHit = true; unfinished.push(it.url); return }
          if (got.failed) { failed.push({ url: it.url, why: got.failed }); note(it.title, false); return }
          const r = await saveImported(userId, got.recipe, { from: 'links', hints: got.hints })
          added++; if (r.needsLook) needsLook++
          note(got.recipe.title, true)
        } else {
          const r = await saveImported(userId, it.recipe, { from: source.id, photo: it.photo })
          added++; if (r.needsLook) needsLook++
          note(it.title, true)
        }
      } catch (err) {
        console.error('Import failed', err)
        failed.push({ url: it.url, title: it.title, why: 'error' })
        note(it.title, false)
      }
    }, { concurrency: isLinks ? 3 : 4, shouldStop: () => stopRef.current })

    const waiting = [...unfinished, ...later]
    // What's left of the waiting list after this run (a "Bring them in" run starts from it)
    if (isLinks) {
      const before = await getWaitingLinks(userId)
      const tried = new Set(list.map(it => it.url))
      await setWaitingLinks(userId, before.filter(u => !tried.has(u)))
      if (waiting.length) await addWaitingLinks(userId, waiting)
    }
    success()
    setResult({ added, needsLook, failed, waiting: waiting.length })
    setStage('done')
  }

  function back() {
    setError(null)
    if (stage === 'file' || stage === 'paste') { setStage('source'); return }
    if (stage === 'choose') { setStage(isLinks ? 'paste' : 'file'); return }
    onClose()
  }

  // ── Screens ──
  const frame = (children) => (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '16px 24px', paddingTop: 'calc(16px + var(--safe-top))', paddingBottom: 'calc(40px + var(--safe-bottom))' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--safe-top)', background: 'var(--cream)', zIndex: 150 }} />
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>{children}</div>
    </div>
  )

  if (stage === 'source') return frame(<>
    <Header title="Add recipes in bulk" sub="Have a ton of saved recipes you&apos;re ready to bring into Nom? Bring them over in bulk from Paprika or a list of links. They come in as Want to Make." onBack={onClose} />
    <div style={{ ...body, fontSize: '11px', fontWeight: '700', color: 'var(--charcoal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Where are your recipes?</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {SOURCES.map(s => (
        <button key={s.id} onClick={() => { tap(); setSource(s); setStage('file') }} style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px', minHeight: '56px', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', ...body, fontSize: '15px', fontWeight: '600', color: 'var(--ink)' }}>{s.name}</span>
            <span style={{ display: 'block', ...body, fontSize: '12px', color: 'var(--muted)' }}>Your whole library, photos included</span>
          </span>
          <IconChevronRight size={18} strokeWidth={2} />
        </button>
      ))}
      <button onClick={() => { tap(); setSource('links'); setStage('paste') }} style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px', minHeight: '56px', padding: '12px 16px', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', ...body, fontSize: '15px', fontWeight: '600', color: 'var(--ink)' }}>A list of links</span>
          <span style={{ display: 'block', ...body, fontSize: '12px', color: 'var(--muted)' }}>From your bookmarks, Notes or Pinterest</span>
        </span>
        <IconChevronRight size={18} strokeWidth={2} />
      </button>
    </div>
    <div style={{ ...body, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5, marginTop: '16px' }}>
      Using a different app? <a href="mailto:nom.recipeapp@gmail.com?subject=Import%20from%20another%20app" style={{ color: 'var(--clay)', fontWeight: '600' }}>Tell us which one</a> and we'll add it.
    </div>
  </>)

  if (stage === 'file') return frame(<>
    <Header title={`From ${source.name}`} sub="Export your recipes from the other app, then choose the file here." onBack={back} />
    <div style={{ ...card, padding: '16px', marginBottom: '20px' }}>
      {source.howTo.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: '10px', ...body, fontSize: '14px', color: 'var(--charcoal)', lineHeight: 1.5, marginBottom: i < source.howTo.length - 1 ? '10px' : 0 }}>
          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--parchment)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--clay)' }}>{i + 1}</span>
          {step}
        </div>
      ))}
    </div>
    {error && <div role="alert" style={{ ...body, fontSize: '13px', color: '#B85252', marginBottom: '12px', lineHeight: 1.5 }}>{error}</div>}
    {/* No accept= filter: iPhone greys out file types it doesn't know, like .paprikarecipes */}
    <input ref={fileInput} type="file" onChange={onFile} style={{ display: 'none' }} />
    <button onClick={() => fileInput.current?.click()} disabled={busy} style={primaryBtn(busy)}>
      {busy ? 'Reading your recipes...' : 'Choose file'}
    </button>
  </>)

  if (stage === 'paste') return frame(<>
    <Header title="Paste your links" sub={`Paste up to ${LINKS_PER_PASTE} recipe links, one per line. A copied note full of links works too.`} onBack={back} />
    <textarea
      value={pasted} onChange={e => { setPasted(e.target.value); setError(null) }}
      placeholder={'https://smittenkitchen.com/...\nhttps://www.tiktok.com/...'}
      aria-label="Recipe links" rows={9} autoCapitalize="none" autoCorrect="off" spellCheck={false}
      style={{ width: '100%', boxSizing: 'border-box', padding: '14px', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--warm-white)', ...body, fontSize: '14px', color: 'var(--ink)', outline: 'none', resize: 'vertical', marginBottom: '10px' }}
    />
    {linksLeft != null && (
      <div style={{ ...body, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '14px' }}>
        {linksLeft <= 0
          ? "You've brought in today's links. Paste them anyway and we'll save them for tomorrow."
          : linksLeft < LINKS_PER_PASTE
            ? `You can bring in ${linksLeft} more links today. Any extra are saved for tomorrow.`
            : `You can bring in up to ${LINKS_PER_PASTE} links at a time.`}
      </div>
    )}
    {error && <div role="alert" style={{ ...body, fontSize: '13px', color: '#B85252', marginBottom: '12px', lineHeight: 1.5 }}>{error}</div>}
    <button onClick={findLinks} disabled={busy || !pasted.trim()} style={primaryBtn(busy || !pasted.trim())}>
      {busy ? 'Finding recipes...' : 'Find recipes'}
    </button>
  </>)

  if (stage === 'choose') {
    const noun = isLinks ? 'links' : 'recipes'
    const allOn = selected.size === items.length
    return frame(<>
      <Header
        title={`${items.length} ${items.length === 1 ? noun.slice(0, -1) : noun} found`}
        sub={skipped ? `${skipped} already in your Cookbook, so we skipped ${skipped === 1 ? 'it' : 'them'}.` : 'Everything is ticked. Untick anything you want to leave behind.'}
        onBack={back}
      />
      {items.length > 8 && (
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" aria-label="Search recipes"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', border: '1.5px solid var(--tan)', borderRadius: 'var(--radius-md)', background: 'var(--warm-white)', ...body, fontSize: '14px', color: 'var(--ink)', outline: 'none', marginBottom: '10px' }} />
      )}
      <button onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', minHeight: '44px', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer', ...body, fontSize: '14px', fontWeight: '600', color: 'var(--ink)' }}>
        <Tick on={allOn} partial={!allOn && selected.size > 0} /> Select all
      </button>
      <div style={{ ...card, overflow: 'hidden', marginBottom: '20px' }}>
        {groups.map(([name, list], gi) => {
          const onCount = list.filter(it => selected.has(it.key)).length
          const expanded = open.has(name) || !!search.trim()
          return (
            <div key={name} style={{ borderTop: gi ? '1px solid var(--parchment)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button onClick={() => toggleGroup(list)} aria-label={`${onCount === list.length ? 'Untick' : 'Tick'} all in ${name}`} style={{ minWidth: '48px', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Tick on={onCount === list.length} partial={onCount > 0 && onCount < list.length} />
                </button>
                <button onClick={() => setOpen(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n })} aria-expanded={expanded} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minHeight: '52px', padding: '0 14px 0 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', ...body }}>
                  <span style={{ flex: 1, fontSize: '15px', fontWeight: '600', color: 'var(--ink)' }}>{name}</span>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{onCount === list.length ? list.length : `${onCount} of ${list.length}`}</span>
                  <span style={{ color: 'var(--muted)', display: 'inline-flex', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><IconChevronDown size={16} strokeWidth={2} /></span>
                </button>
              </div>
              {expanded && list.map(it => (
                <button key={it.key} onClick={() => toggle(it.key)} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', minHeight: '44px', padding: '6px 14px 6px 13px', background: 'var(--cream)', border: 'none', borderTop: '1px solid var(--parchment)', cursor: 'pointer', textAlign: 'left', ...body, fontSize: '14px', color: 'var(--charcoal)' }}>
                  <Tick on={selected.has(it.key)} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                </button>
              ))}
            </div>
          )
        })}
        {!groups.length && <div style={{ padding: '18px', ...body, fontSize: '14px', color: 'var(--muted)', textAlign: 'center' }}>No recipes match "{search.trim()}".</div>}
      </div>
      {isLinks && forTomorrow > 0 && (
        <div style={{ ...body, fontSize: '13px', color: 'var(--charcoal)', lineHeight: 1.5, marginBottom: '12px', textAlign: 'center' }}>
          {importCount > 0
            ? `You can bring in ${importCount} today. We'll save the other ${forTomorrow} for tomorrow.`
            : `You've brought in today's links. We'll save these ${forTomorrow} for tomorrow.`}
        </div>
      )}
      <button
        onClick={importCount > 0 ? startImport : async () => { await addWaitingLinks(userId, selectedItems.map(it => it.url)); toast('Saved for tomorrow'); onClose() }}
        disabled={!selectedItems.length}
        style={primaryBtn(!selectedItems.length)}
      >
        {!selectedItems.length ? 'Tick something to import' : importCount > 0 ? `Import ${importCount} ${importCount === 1 ? 'recipe' : 'recipes'}` : `Save ${forTomorrow} for tomorrow`}
      </button>
    </>)
  }

  if (stage === 'importing') {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
    return frame(<>
      <div style={{ height: '44px' }} />
      <div style={{ ...display, fontSize: '26px', fontWeight: '600', marginBottom: '6px' }}>Bringing in your recipes</div>
      <div style={{ ...body, fontSize: '14px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.5 }}>Keep Nom open until this finishes. It usually takes a minute or two.</div>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: '8px', borderRadius: 'var(--radius-pill)', background: 'var(--parchment)', overflow: 'hidden', marginBottom: '10px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--clay)', transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...body, fontSize: '13px', color: 'var(--charcoal)', marginBottom: '20px' }}>
        <span>{progress.done} of {progress.total}</span>
        {progress.needsLook > 0 && <span style={{ color: 'var(--muted)' }}>{progress.needsLook} need a look so far</span>}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        {progress.recent.length === 0 && <div style={{ padding: '14px 16px', ...body, fontSize: '14px', color: 'var(--muted)' }}>Starting...</div>}
        {progress.recent.map((r, i) => (
          <div key={`${r.title}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderTop: i ? '1px solid var(--parchment)' : 'none', ...body, fontSize: '14px', color: r.ok ? 'var(--charcoal)' : 'var(--muted)' }}>
            <span style={{ color: r.ok ? 'var(--sage)' : 'var(--muted)', display: 'inline-flex' }}>{r.ok ? <IconCheck size={16} strokeWidth={2.4} /> : <IconX size={14} strokeWidth={2.4} />}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.ok ? r.title : `Couldn't read ${r.title}`}</span>
          </div>
        ))}
      </div>
      <button onClick={() => { stopRef.current = true }} style={{ ...quietBtn, marginTop: '16px' }}>Stop after these</button>
    </>)
  }

  // ── Done ──
  const r = result || { added: 0, needsLook: 0, failed: [], waiting: 0 }
  const failedLinks = r.failed.filter(f => f.url)
  return frame(<>
    <div style={{ height: '44px' }} />
    <div style={{ ...display, fontSize: '28px', fontWeight: '600', marginBottom: '6px' }}>
      {r.added ? `${r.added} ${r.added === 1 ? 'recipe' : 'recipes'} added` : 'Nothing came in this time'}
    </div>
    <div style={{ ...body, fontSize: '14px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.5 }}>
      {r.added ? "They're in your Cookbook as Want to Make. Your friends' Feeds stay quiet." : 'Check your connection and try again.'}
    </div>

    {r.needsLook > 0 && (
      <div style={{ ...card, background: 'var(--parchment)', border: 'none', padding: '16px', marginBottom: '12px' }}>
        <div style={{ ...body, fontSize: '15px', fontWeight: '700', color: 'var(--ink)', marginBottom: '4px' }}>{r.needsLook} {r.needsLook === 1 ? 'needs' : 'need'} a look</div>
        <div style={{ ...body, fontSize: '13px', color: 'var(--charcoal)', lineHeight: 1.5, marginBottom: '12px' }}>Some steps or ingredients might be missing. Fix them now, or find them anytime under Needs a look in your Cookbook.</div>
        <button onClick={() => onFinish({ needsLook: true })} style={{ ...primaryBtn(false), minHeight: '44px', padding: '11px', fontSize: '14px', background: 'var(--warm-white)', color: 'var(--clay)', border: '1.5px solid var(--clay)' }}>Fix them now</button>
      </div>
    )}

    {r.waiting > 0 && (
      <div style={{ ...card, padding: '14px 16px', marginBottom: '12px', ...body, fontSize: '14px', color: 'var(--charcoal)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--ink)' }}>{r.waiting} {r.waiting === 1 ? 'link' : 'links'} saved for tomorrow.</strong> You'll find them at the top of your Cookbook.
      </div>
    )}

    {r.failed.length > 0 && (
      <div style={{ ...card, padding: '14px 16px', marginBottom: '12px' }}>
        <div style={{ ...body, fontSize: '14px', fontWeight: '700', color: 'var(--ink)', marginBottom: '4px' }}>{r.failed.length} couldn't be read</div>
        <div style={{ ...body, fontSize: '13px', color: 'var(--charcoal)', lineHeight: 1.5, marginBottom: failedLinks.length ? '10px' : 0 }}>
          {failedLinks.length ? 'Some sites block apps from reading recipes. Try a screenshot with From photo instead.' : 'Try exporting the file again.'}
        </div>
        {failedLinks.slice(0, 6).map(f => (
          <div key={f.url} style={{ ...body, fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.7 }}>{f.url}</div>
        ))}
        {failedLinks.length > 0 && (
          <button onClick={async () => { try { await navigator.clipboard.writeText(failedLinks.map(f => f.url).join('\n')); toast('Links copied') } catch { toast("Couldn't copy") } }} style={{ ...quietBtn, color: 'var(--clay)', minHeight: '40px', padding: '8px 0 0', textAlign: 'left' }}>
            Copy {failedLinks.length === 1 ? 'link' : 'links'}
          </button>
        )}
      </div>
    )}

    <div style={{ marginTop: '12px' }}>
      {/* The Cookbook sorts newest first, so the new recipes are right at the top */}
      <button onClick={() => onFinish({ needsLook: false })} style={r.added > 0 ? primaryBtn(false) : { ...quietBtn, color: 'var(--charcoal)' }}>
        {r.added > 0 ? `See your new ${r.added === 1 ? 'recipe' : 'recipes'}` : 'Go to my Cookbook'}
      </button>
    </div>
  </>)
}
