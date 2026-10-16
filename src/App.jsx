import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, ShieldCheck, Sparkles, PackageSearch, Plus, Bell, LayoutDashboard,
  HeartHandshake, MapPin, Clock3, ArrowRight, Menu, X, UserRound, LogOut,
  Smartphone, Wallet, Backpack, CreditCard, Headphones, CheckCircle2, AlertTriangle,
  ChevronRight, LockKeyhole, SlidersHorizontal, FileCheck2, ScanSearch, Handshake,
  Mail, Github, Info, Upload, Image as ImageIcon
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import { scoreMatch } from './lib/matching.js';

const sampleItems = [
  { id:'LL-104', kind:'found', name:'Black leather wallet', category:'Wallet', description:'Black leather wallet with a small silver mark near the zipper.', color:'Black', brand:'', location:'Library, Building A', date:'2026-10-07', status:'open', image:'wallet', finder:'Campus security' },
  { id:'LL-103', kind:'found', name:'Blue backpack', category:'Bag', description:'Navy blue backpack found near the cafeteria.', color:'Blue', brand:'', location:'Cafeteria', date:'2026-10-06', status:'open', image:'bag', finder:'Student' },
  { id:'LL-102', kind:'found', name:'Smartphone', category:'Electronics', description:'Dark smartphone in a clear case found near the library entrance.', color:'Black', brand:'', location:'Library entrance', date:'2026-10-05', status:'open', image:'phone', finder:'Campus security' },
  { id:'LL-101', kind:'found', name:'Student ID card', category:'ID Card', description:'Student identification card found outside Block B.', color:'White', brand:'', location:'Block B', date:'2026-10-04', status:'open', image:'id', finder:'Student' },
  { id:'LL-100', kind:'found', name:'Wireless earbuds case', category:'Electronics', description:'White wireless earbuds charging case near the sports ground.', color:'White', brand:'', location:'Sports ground', date:'2026-10-03', status:'open', image:'earbuds', finder:'Student' },
  { id:'LL-099', kind:'lost', name:'Black wallet', category:'Wallet', description:'Black wallet lost near the library.', color:'Black', brand:'', location:'Library, Building A', date:'2026-10-07', status:'open', image:'wallet', finder:'You' }
];

const categories = ['Wallet','Bag','Electronics','ID Card','Keys','Books','Clothing','Other'];
const iconFor = (name) => name?.toLowerCase().includes('wallet') ? Wallet : name?.toLowerCase().includes('backpack') || name?.toLowerCase().includes('bag') ? Backpack : name?.toLowerCase().includes('id') ? CreditCard : name?.toLowerCase().includes('earbud') ? Headphones : Smartphone;

function Brand({ onClick }) {
  return <button className="brand" onClick={onClick} aria-label="LostLink home"><span className="brand-icon"><HeartHandshake size={20}/></span><span>Lost<span>Link</span></span></button>;
}
function Badge({ children, type='blue' }) { return <span className={`badge badge-${type}`}>{children}</span>; }
function ItemImage({ item, large=false }) {
  const Icon = iconFor(item?.name);
  return <div className={`item-visual ${large ? 'item-visual-large' : ''} visual-${item?.image || 'default'}`} aria-label={`${item?.name || 'Item'} illustration`}><Icon size={large ? 48 : 30} strokeWidth={1.5}/><span className="visual-glow"/></div>;
}
function Button({ children, variant='primary', onClick, type='button', disabled=false }) {
  return <button type={type} disabled={disabled} onClick={onClick} className={`btn btn-${variant}`}>{children}</button>;
}

export default function App() {
  const [page, setPage] = useState('home');
  const [user, setUser] = useState(null);
  const [items, setItems] = useState(sampleItems);
  const [activeItem, setActiveItem] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [formKind, setFormKind] = useState('lost');
  const [form, setForm] = useState({ name:'', category:'Wallet', description:'', location:'', date:new Date().toISOString().slice(0,10), color:'', brand:'', privateMark:'', privateContents:'' });
  const [claim, setClaim] = useState({ mark:'', contents:'' });
  const [notifications, setNotifications] = useState([
    { id:1, title:'Welcome to LostLink', detail:'Browse reports or submit a lost/found item.', time:'Just now', unread:true }
  ]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const notify = (message) => { setNotice(message); window.setTimeout(() => setNotice(''), 4200); };
  const go = (next) => { setPage(next); setMenuOpen(false); window.scrollTo({ top:0, behavior:'smooth' }); };
  const foundItems = useMemo(() => items.filter(i => i.kind === 'found' && i.status !== 'returned').filter(i => {
    const q = search.toLowerCase();
    const textMatch = !q || `${i.name} ${i.description} ${i.location} ${i.category}`.toLowerCase().includes(q);
    return textMatch && (category === 'All categories' || i.category === category);
  }), [items, search, category]);
  const myItems = items.filter(i => i.ownerId && user?.id === i.ownerId);
  const activeMatches = items.filter(i => i.kind === 'match');

  async function authSubmit(e) {
    e.preventDefault();
    if (!supabase) { notify('Connect Supabase in .env to enable real authentication.'); return; }
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email'), password = fd.get('password');
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) {
  if (result.error.status === 429) {
    notify('Too many attempts. Please wait a few minutes before trying again.');
  } else {
    notify(result.error.message);
  }
  return;
}
    if (authMode === 'signup') notify('Check your email to confirm your account.');
    else { setUser(result.data.user); go('dashboard'); }
  }

  async function submitReport(e, selectedPhoto = null) {
  e.preventDefault();

  if (
    !form.name.trim() ||
    !form.description.trim() ||
    !form.location.trim()
  ) {
    return notify('Please complete the item name, description and location.');
  }

  if (isSupabaseConfigured && !user) {
    notify('Please sign in before submitting a report.');
    go('auth');
    return;
  }

  setLoading(true);
  let uploadedPath = null;

  try {
    const row = {
      kind: formKind,
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      location: form.location.trim(),
      date: form.date,
      color: form.color,
      brand: form.brand,
      status: 'open',
      image: formKind === 'lost' ? 'wallet' : 'bag',
      image_path: null,
      ownerId: user?.id || null,
      privateMark: formKind === 'lost' ? form.privateMark : undefined,
      privateContents: formKind === 'lost' ? form.privateContents : undefined
    };

    if (supabase && user) {
      if (selectedPhoto) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedTypes.includes(selectedPhoto.type)) {
          throw new Error('Choose a JPG, PNG, or WebP image.');
        }

        if (selectedPhoto.size > 5 * 1024 * 1024) {
          throw new Error('The image must be 5 MB or smaller.');
        }

        const extension = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp'
        }[selectedPhoto.type];

        const filePath =
          `${user.id}/${crypto.randomUUID()}.${extension}`;

        const { data: uploadData, error: uploadError } =
          await supabase.storage
            .from('item-photos')
            .upload(filePath, selectedPhoto, {
              contentType: selectedPhoto.type,
              upsert: false
            });

        if (uploadError) {
          throw new Error(`Photo upload failed: ${uploadError.message}`);
        }

        uploadedPath = uploadData.path;
        row.image_path = uploadedPath;
      }

      const table =
        formKind === 'lost' ? 'lost_items' : 'found_items';

      const { data, error } = await supabase
        .from(table)
        .insert({
          user_id: user.id,
          name: row.name,
          category: row.category,
          description: row.description,
          location: row.location,
          item_date: row.date || null,
          color: row.color || null,
          brand: row.brand || null,
          status: 'open',
          image_path: uploadedPath,
          private_mark: row.privateMark || null,
          private_contents: row.privateContents || null
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Report not saved: ${error.message}`);
      }

      row.id = data.id;
    } else {
      row.id = `DEMO-${Date.now().toString().slice(-6)}`;
    }

    setItems(prev => [row, ...prev]);

    setNotifications(prev => [
      {
        id: Date.now(),
        title: `${formKind === 'lost' ? 'Lost' : 'Found'} report submitted`,
        detail: row.name,
        time: 'Just now',
        unread: true
      },
      ...prev
    ]);

    setForm({
      name: '',
      category: 'Wallet',
      description: '',
      location: '',
      date: new Date().toISOString().slice(0, 10),
      time: '',
      color: '',
      brand: '',
      privateMark: '',
      privateContents: ''
    });

    notify('Report submitted. Matching can suggest candidates, but never proves ownership.');
    go('dashboard');
  } catch (error) {
    // Clean up the uploaded file if the database insert failed.
    if (uploadedPath && supabase) {
      const { error: cleanupError } = await supabase.storage
        .from('item-photos')
        .remove([uploadedPath]);

      if (cleanupError) {
        console.error('Photo cleanup failed:', cleanupError.message);
      }
    }

    notify(error.message || 'Unable to submit the report.');
  } finally {
    setLoading(false);
  }
}

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null); go('home'); notify('You have been signed out.');
  }

  function openReport(kind) {
    setFormKind(kind); setForm(prev => ({ ...prev, name:'', description:'', location:'', privateMark:'', privateContents:'' })); go('report');
  }

  function requestClaim(item) {
    setActiveItem(item); setClaim({ mark:'', contents:'' }); go('verify');
  }

  async function submitClaim(e) {
    e.preventDefault();
    if (!activeItem) return;
    if (!claim.mark.trim() && !claim.contents.trim()) return notify('Add at least one ownership detail.');
    // Demo verification only: real production verification must run server-side and must not expose stored answers.
    const score = (claim.mark.trim() ? 25 : 0) + (claim.contents.trim() ? 25 : 0);
    if (supabase && user) {
      const { error } = await supabase.from('claims').insert({
        item_id:activeItem.id, claimant_id:user.id, evidence_note:'Claim submitted; admin verification required.',
        status:'pending_review', verification_confidence:score
      });
      if (error) return notify(`Claim not saved: ${error.message}`);
    }
    setNotifications(prev => [{ id:Date.now(), title:'Claim sent for review', detail:`${activeItem.name} · Admin review required`, time:'Just now', unread:true }, ...prev]);
    notify('Claim submitted for review. No automatic ownership approval was made.');
    go('dashboard');
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-inner">
        <Brand onClick={() => go('home')}/>
        <nav className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
          <button className={page==='home'?'nav-active':''} onClick={() => go('home')}>Home</button>
          <button className={page==='search'?'nav-active':''} onClick={() => go('search')}>Browse items</button>
          <button onClick={() => go('how')}>How it works</button>
          {user && <button onClick={() => go('dashboard')}>Dashboard</button>}
        </nav>
        <div className="top-actions">
          <button className="icon-btn notification-btn" aria-label="Notifications" onClick={() => go('notifications')}><Bell size={19}/>{notifications.some(n=>n.unread) && <i/>}</button>
          {user ? <Button variant="outline" onClick={signOut}><LogOut size={16}/> Sign out</Button> : <><Button variant="ghost" onClick={() => {setAuthMode('login');go('auth')}}>Log in</Button><Button onClick={() => {setAuthMode('signup');go('auth')}}>Sign up <ArrowRight size={15}/></Button></>}
          <button className="mobile-menu icon-btn" aria-label="Toggle navigation" onClick={() => setMenuOpen(v=>!v)}>{menuOpen?<X/>:<Menu/>}</button>
        </div>
      </div>
    </header>

    <main>
      {page==='home' && <Home go={go} openReport={openReport} foundItems={foundItems}/>}
      {page==='auth' && <section className="auth-layout page-wrap"><div className="auth-card"><div className="auth-icon"><HeartHandshake/></div><p className="eyebrow">WELCOME TO LOSTLINK</p><h1>{authMode==='signup'?'Create your account':'Welcome back'}</h1><p className="muted">A safer, smarter way to reunite people with their belongings.</p><form onSubmit={authSubmit} className="form-stack"><label>Email address<input name="email" type="email" required placeholder="you@example.com" autoComplete="email"/></label><label>Password<input name="password" type="password" required minLength="6" placeholder="At least 6 characters" autoComplete={authMode==='signup'?'new-password':'current-password'}/></label><Button type="submit" disabled={loading}>{loading?'Please wait…':authMode==='signup'?'Create account':'Log in'} <ArrowRight size={16}/></Button></form><p className="auth-switch">{authMode==='signup'?'Already have an account?':'New to LostLink?'} <button onClick={() => setAuthMode(authMode==='signup'?'login':'signup')}>{authMode==='signup'?'Log in':'Create an account'}</button></p>{!isSupabaseConfigured&&<div className="inline-note"><Info size={16}/> Demo mode: configure Supabase to enable real accounts.</div>}</div><div className="auth-side"><div className="floating-icon float-one"><Wallet/></div><div className="auth-illustration"><div className="ai-orb"><Sparkles size={30}/></div><div className="orbit orbit-a"/><div className="orbit orbit-b"/></div><h2>Reuniting people<br/>with their belongings.</h2><p>Match thoughtfully. Verify privately. Return safely.</p></div></section>}
      {page==='dashboard' && <Dashboard user={user} items={myItems} notifications={notifications} go={go} openReport={openReport} foundItems={foundItems} signOut={signOut}/>}
      {page==='report' && <ReportPage kind={formKind} setKind={setFormKind} form={form} setForm={setForm} submitReport={submitReport} loading={loading} go={go}/>}
      {page==='search' && <SearchPage foundItems={foundItems} search={search} setSearch={setSearch} category={category} setCategory={setCategory} requestClaim={requestClaim} go={go}/>}
      {page==='verify' && <VerifyPage item={activeItem} claim={claim} setClaim={setClaim} submitClaim={submitClaim} go={go}/>}
      {page==='notifications' && <NotificationsPage notifications={notifications} setNotifications={setNotifications} go={go}/>}
      {page==='how' && <HowPage openReport={openReport} go={go}/>}
      {page==='admin' && <AdminPage items={items} go={go} notify={notify}/>}
    </main>

    <Footer go={go}/>
    {notice && <div role="status" className="toast"><CheckCircle2 size={19}/>{notice}<button aria-label="Dismiss" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    <div className="mobile-bottom">
      <button onClick={()=>go('home')}><LayoutDashboard size={19}/><span>Home</span></button>
      <button onClick={()=>go('search')}><Search size={19}/><span>Search</span></button>
      <button onClick={()=>openReport('lost')}><Plus size={19}/><span>Report</span></button>
      <button onClick={()=>go(user?'dashboard':'auth')}><UserRound size={19}/><span>Account</span></button>
    </div>
  </div>;
}

function Home({ go, openReport, foundItems }) {
  return <>
    <section className="hero page-wrap">
      <div className="hero-copy"><div className="eyebrow-pill"><Sparkles size={14}/> A smarter way to find what matters</div><h1>Lost something?<br/><span>Let's bring it back.</span></h1><p className="hero-sub">A trusted lost-and-found community powered by thoughtful AI matching and private ownership verification.</p><div className="hero-actions"><Button onClick={()=>openReport('lost')}> <Search size={17}/> Report lost item</Button><Button variant="outline" onClick={()=>openReport('found')}><HeartHandshake size={17}/> Report found item</Button></div><div className="trust-row"><span><ShieldCheck size={17}/> Privacy-first</span><span><Sparkles size={17}/> AI-assisted matching</span><span><CheckCircle2 size={17}/> Safe handover</span></div></div>
      <div className="hero-art"><div className="art-grid"/><div className="connection connection-one"/><div className="connection connection-two"/><div className="hero-item hero-wallet"><Wallet size={36}/><span>Wallet</span></div><div className="hero-item hero-phone"><Smartphone size={35}/><span>Phone</span></div><div className="hero-item hero-bag"><Backpack size={34}/><span>Backpack</span></div><div className="hero-ai"><Sparkles size={31}/><b>AI</b><small>smart match</small></div><div className="match-float"><span className="match-dot"><CheckCircle2 size={17}/></span><div><b>Potential match</b><small>Ownership verification required</small></div><Badge type="green">82%</Badge></div><div className="art-caption"><ShieldCheck size={15}/> Matching is not proof of ownership</div></div>
      <div className="hero-bottom"><div><span className="feature-icon"><ScanSearch/></span><div><b>AI-assisted matching</b><p>Find potential matches faster.</p></div></div><div><span className="feature-icon"><LockKeyhole/></span><div><b>Private verification</b><p>Keep unique details protected.</p></div></div><div><span className="feature-icon"><AlertTriangle/></span><div><b>Fraud-aware claims</b><p>Suspicious claims get reviewed.</p></div></div><div><span className="feature-icon"><Handshake/></span><div><b>Safe handover</b><p>Return through trusted locations.</p></div></div></div>
    </section>
    <section className="section page-wrap"><div className="section-heading"><div><p className="eyebrow">A SIMPLE, SAFER PROCESS</p><h2>Four steps. One less worry.</h2><p className="muted">Designed to make returning belongings easier without compromising safety.</p></div><button className="text-link" onClick={()=>go('how')}>See how it works <ArrowRight size={16}/></button></div><div className="steps-grid">{[{n:'01',icon:FileCheck2,title:'Report it',desc:'Share the basics of a lost or found item.'},{n:'02',icon:Sparkles,title:'Find a match',desc:'Our matching engine highlights similar reports.'},{n:'03',icon:ShieldCheck,title:'Verify privately',desc:'Review private details and supporting evidence.'},{n:'04',icon:HeartHandshake,title:'Return safely',desc:'Arrange a handover at an official safe location.'}].map(s=><div className="step-card" key={s.n}><div className="step-top"><span>{s.n}</span><s.icon size={22}/></div><h3>{s.title}</h3><p>{s.desc}</p></div>)}</div></section>
    <section className="section soft-section"><div className="page-wrap"><div className="section-heading"><div><p className="eyebrow">COMMUNITY FINDS</p><h2>Recently found items</h2><p className="muted">Browse public reports. Sensitive ownership details stay private.</p></div><Button variant="outline" onClick={()=>go('search')}>Browse all items <ArrowRight size={16}/></Button></div><div className="item-grid">{foundItems.slice(0,3).map(item=><ItemCard key={item.id} item={item} onClick={()=>go('search')}/>)}</div></div></section>
    <section className="cta-wrap page-wrap"><div className="cta-panel"><div><p className="eyebrow">SMALL ACTION. BIG RELIEF.</p><h2>Found something that isn't yours?</h2><p>One quick report could help someone get back something important.</p></div><Button onClick={()=>openReport('found')}>Help return an item <ArrowRight size={16}/></Button><div className="cta-decoration"><HeartHandshake size={80}/></div></div></section>
  </>;
}

function ItemCard({ item, onClick }) {
  return <article className="item-card"><div className="item-card-top"><ItemImage item={item}/><Badge type="green">Found</Badge></div><div className="item-card-body"><div className="item-id">{item.id}</div><h3>{item.name}</h3><p>{item.description}</p><div className="item-meta"><span><MapPin size={14}/>{item.location}</span><span><Clock3 size={14}/>{item.date}</span></div><button className="card-link" onClick={onClick}>View details <ChevronRight size={16}/></button></div></article>;
}

function Dashboard({ user, items, notifications, go, openReport, foundItems, signOut }) {
  const allItems = items.length ? items : sampleItems.filter(i=>i.kind==='lost').slice(0,1);
  return <section className="page-wrap page-content"><div className="page-title-row"><div><p className="eyebrow">YOUR SPACE</p><h1>Dashboard</h1><p className="muted">Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}. Here's what's happening.</p></div><Button onClick={()=>openReport('lost')}><Plus size={17}/> Report item</Button></div>
    <div className="stats-grid"><Stat icon={Wallet} label="My lost items" value={items.filter(i=>i.kind==='lost').length} tint="red"/><Stat icon={Backpack} label="My found items" value={items.filter(i=>i.kind==='found').length} tint="green"/><Stat icon={Sparkles} label="Potential matches" value={activeMatchesCount(items)} tint="blue"/><Stat icon={Clock3} label="Pending claims" value="—" tint="amber"/></div>
    <div className="dashboard-columns"><div className="panel"><div className="panel-heading"><div><h2>My reports</h2><p>Track your lost and found items.</p></div><button className="text-link" onClick={()=>go('search')}>Browse <ArrowRight size={15}/></button></div>{allItems.map(i=><div className="report-row" key={i.id}><ItemImage item={i}/><div className="report-info"><b>{i.name}</b><small>{i.location} · {i.date}</small></div><Badge type={i.status==='returned'?'green':'blue'}>{i.status || 'open'}</Badge></div>)}</div><div className="panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Updates about your reports.</p></div><Bell size={19} className="muted-icon"/></div>{notifications.slice(0,4).map(n=><div className="activity-row" key={n.id}><span className="activity-icon"><Bell size={16}/></span><div><b>{n.title}</b><p>{n.detail}</p><small>{n.time}</small></div></div>)}<Button variant="outline" onClick={()=>go('notifications')}>All notifications</Button></div></div>
    <div className="help-banner"><ShieldCheck size={24}/><div><b>Keep ownership details private</b><p>Never publish serial numbers, hidden marks, or unique contents in public descriptions.</p></div><button className="text-link" onClick={()=>go('how')}>Safety guide <ArrowRight size={15}/></button></div>
  </section>;
}
function activeMatchesCount(items) { return items.filter(i=>i.kind==='match').length; }
function Stat({ icon:Icon, label, value, tint }) { return <div className="stat-card"><span className={`stat-icon tint-${tint}`}><Icon size={19}/></span><div><span>{label}</span><b>{value}</b></div></div>; }

function ReportPage({ kind, setKind, form, setForm, submitReport, loading, go }) {
  const [photo, setPhoto] = useState(null);
const [photoPreview, setPhotoPreview] = useState('');
  const update = (e) => setForm(prev=>({...prev,[e.target.name]:e.target.value}));
  return <section className="page-wrap page-content narrow-content"><button className="back-link" onClick={()=>go('dashboard')}>← Back to dashboard</button><div className="page-title-row"><div><p className="eyebrow">COMMUNITY REPORT</p><h1>Report an item</h1><p className="muted">Help LostLink connect the right item with the right person.</p></div></div>
    <div className="segmented"><button className={kind==='lost'?'selected':''} onClick={()=>setKind('lost')} type="button"><Search size={16}/> I lost an item</button><button className={kind==='found'?'selected':''} onClick={()=>setKind('found')} type="button"><HeartHandshake size={16}/> I found an item</button></div>
    <form
  className="panel report-form"
  onSubmit={(e) => submitReport(e, photo)}
>
  <div className="form-section"><h2>Item details</h2><p>Share enough detail to help identify the item, but keep unique identifying facts private.</p><div className="form-grid"><label>Item name *<input name="name" value={form.name} onChange={update} placeholder="e.g. Black leather wallet" required maxLength="100"/></label><label>Category *<select name="category" value={form.category} onChange={update}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Color<input name="color" value={form.color} onChange={update} placeholder="e.g. Black"/></label><label>Brand (optional)<input name="brand" value={form.brand} onChange={update} placeholder="e.g. Samsung"/></label><label className="full-field">General description *<textarea name="description" value={form.description} onChange={update} placeholder="Describe visible features. Do not include secret ownership details." rows="4" required maxLength="1000"/></label></div></div>
    <div className="form-section"><h2>When & where</h2><div className="form-grid"><label>Date {kind==='lost'?'lost':'found'} *<input type="date" name="date" value={form.date} onChange={update} required/></label><label>Approximate time<input type="time" name="time" value={form.time||''} onChange={update}/></label><label className="full-field">Location *<input name="location" value={form.location} onChange={update} placeholder="e.g. Library, Building A" required maxLength="200"/></label></div></div>
       <div className="upload-box">
      <Upload size={22} />
      <b>Upload item photo (optional)</b>
      <p>Choose a JPG, PNG, or WebP image up to 5 MB.</p>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          if (file.size > 5 * 1024 * 1024) {
            alert('Please choose an image smaller than 5 MB.');
            e.target.value = '';
            setPhoto(null);
            setPhotoPreview('');
            return;
          }

          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            alert('Please choose a JPG, PNG, or WebP image.');
            e.target.value = '';
            setPhoto(null);
            setPhotoPreview('');
            return;
          }

          setPhoto(file);
          setPhotoPreview(URL.createObjectURL(file));
        }}
      />

      {photoPreview && (
        <div className="photo-preview">
          <img
            src={photoPreview}
            alt="Selected item preview"
            style={{
              maxWidth: '220px',
              maxHeight: '180px',
              objectFit: 'contain',
              marginTop: '12px',
              borderRadius: '8px'
            }}
          />
          <p>{photo?.name}</p>
          <button
            type="button"
            onClick={() => {
              setPhoto(null);
              setPhotoPreview('');
            }}
          >
            Remove photo
          </button>
        </div>
      )}
    </div>
    {kind==='lost'&&<div className="private-box"><div className="private-title"><LockKeyhole size={19}/><div><h3>Private ownership details</h3><p>These details must never appear in public search results.</p></div></div><div className="form-grid"><label>Unique mark (optional)<input name="privateMark" value={form.privateMark} onChange={update} placeholder="A scratch, sticker or hidden mark" maxLength="300"/></label><label>Specific contents (optional)<input name="privateContents" value={form.privateContents} onChange={update} placeholder="A non-public item inside" maxLength="300"/></label></div><p className="privacy-note"><ShieldCheck size={15}/> Private details in this starter are demo-only unless the protected schema and server-side verification are configured.</p></div>}
    <label className="checkbox-line"><input type="checkbox" required/> I confirm the information is accurate and understand that matching does not prove ownership.</label><div className="form-actions"><Button variant="outline" onClick={()=>go('home')}>Cancel</Button><Button type="submit" disabled={loading}>{loading?'Submitting…':'Submit report'} <ArrowRight size={16}/></Button></div></form>
  </section>;
}

function SearchPage({ foundItems, search, setSearch, category, setCategory, requestClaim, go }) {
  return <section className="page-wrap page-content"><div className="page-title-row"><div><p className="eyebrow">PUBLIC LISTINGS</p><h1>Search found items</h1><p className="muted">Browse public details only. Ownership information stays private.</p></div><Button onClick={()=>go('report')}><Plus size={17}/> Report item</Button></div>
    <div className="search-panel"><div className="search-input"><Search size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by item, keyword or location…" aria-label="Search items"/></div><div className="filter-select"><SlidersHorizontal size={17}/><select value={category} onChange={e=>setCategory(e.target.value)}><option>All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div></div>
    <div className="results-heading"><b>{foundItems.length} public {foundItems.length===1?'report':'reports'}</b><span>Sorted by recent reports</span></div>
    {foundItems.length ? <div className="item-grid">{foundItems.map(item=><article className="item-card" key={item.id}><div className="item-card-top"><ItemImage item={item}/><Badge type="green">Found</Badge></div><div className="item-card-body"><div className="item-id">{item.id}</div><h3>{item.name}</h3><p>{item.description}</p><div className="item-meta"><span><MapPin size={14}/>{item.location}</span><span><Clock3 size={14}/>{item.date}</span></div><Button variant="outline" onClick={()=>requestClaim(item)}>This may be mine <ArrowRight size={15}/></Button></div></article>)}</div> : <div className="empty-state"><PackageSearch size={36}/><h3>No matching reports</h3><p>Try another keyword or category, or submit a new report.</p></div>}
  </section>;
}

function VerifyPage({ item, claim, setClaim, submitClaim, go }) {
  if (!item) return <section className="page-wrap page-content"><div className="empty-state"><PackageSearch/><h2>Select a found item first</h2><Button onClick={()=>go('search')}>Browse items</Button></div></section>;
  return <section className="page-wrap page-content narrow-content"><button className="back-link" onClick={()=>go('search')}>← Back to search</button><div className="page-title-row"><div><p className="eyebrow">CLAIM REVIEW</p><h1>Ownership verification</h1><p className="muted">Submit evidence for a human review. This form does not automatically prove ownership.</p></div></div><div className="verification-layout"><div className="panel"><div className="verify-item"><ItemImage item={item} large/><div><Badge type="green">Found item</Badge><h2>{item.name}</h2><p>{item.location} · {item.date}</p><small>Report {item.id}</small></div></div><div className="inline-note"><LockKeyhole size={17}/><span>Do not share passwords, bank details, or government ID numbers. Provide only non-sensitive identifying evidence.</span></div><form className="form-stack" onSubmit={submitClaim}><label>Describe a unique identifying feature<textarea rows="3" value={claim.mark} onChange={e=>setClaim(p=>({...p,mark:e.target.value}))} placeholder="A detail not visible in the public listing"/></label><label>Other supporting details<textarea rows="3" value={claim.contents} onChange={e=>setClaim(p=>({...p,contents:e.target.value}))} placeholder="Additional evidence that can help an admin review your claim"/></label><label className="checkbox-line"><input type="checkbox" required/> I confirm this claim is genuine and agree to an admin review.</label><Button type="submit">Submit for review <ArrowRight size={16}/></Button></form></div><aside className="panel safety-panel"><span className="feature-icon"><ShieldCheck/></span><h3>What happens next?</h3><ul><li>Your claim is marked pending review.</li><li>Private evidence is not shown in public listings.</li><li>Multiple claims require manual review.</li><li>Items should be handed over at an official desk.</li></ul><Badge type="amber">No automatic approval</Badge></aside></div></section>;
}

function NotificationsPage({ notifications, setNotifications, go }) {
  return <section className="page-wrap page-content narrow-content"><div className="page-title-row"><div><p className="eyebrow">UPDATES</p><h1>Notifications</h1><p className="muted">Stay informed about matches, claims and handovers.</p></div><Button variant="outline" onClick={()=>setNotifications(n=>n.map(x=>({...x,unread:false})))}>Mark all read</Button></div><div className="panel notification-list">{notifications.map(n=><div className="notification-row" key={n.id}><span className="notification-icon"><Bell size={18}/></span><div><b>{n.title}</b><p>{n.detail}</p><small>{n.time}</small></div>{n.unread&&<i/>}</div>)}{!notifications.length&&<div className="empty-state"><Bell/><h3>You're all caught up</h3><p>New updates will appear here.</p><Button onClick={()=>go('search')}>Browse items</Button></div>}</div></section>;
}

function HowPage({ openReport, go }) {
  return <section className="page-wrap page-content"><div className="center-heading"><p className="eyebrow">HOW LOSTLINK WORKS</p><h1>Find a match. Verify carefully. Return safely.</h1><p className="muted">LostLink helps people reconnect with belongings without making public descriptions the only proof of ownership.</p></div><div className="steps-grid how-steps">{[{n:'01',icon:FileCheck2,title:'Report',desc:'Add public details such as category, date and approximate location. Owners can store private identifying details separately.'},{n:'02',icon:ScanSearch,title:'Match',desc:'A rule-based engine compares category, keywords, place and date to suggest possible matches.'},{n:'03',icon:ShieldCheck,title:'Review',desc:'A claimant provides additional evidence. Sensitive details are kept private and suspicious or competing claims go to an admin.'},{n:'04',icon:Handshake,title:'Handover',desc:'Coordinate through a college security office or authorized Lost & Found desk. Both parties confirm the return.'}].map(s=><div className="step-card" key={s.n}><div className="step-top"><span>{s.n}</span><s.icon size={22}/></div><h3>{s.title}</h3><p>{s.desc}</p></div>)}</div><div className="safety-callout"><ShieldCheck size={25}/><div><h3>Matching is not proof of ownership</h3><p>Never automatically release an item based on an AI score. Human review is essential for valuable items or multiple claims.</p></div></div><div className="center-actions"><Button onClick={()=>openReport('lost')}>Report lost item</Button><Button variant="outline" onClick={()=>go('search')}>Browse found items</Button></div></section>;
}

function AdminPage({ items, go, notify }) {
  return <section className="page-wrap page-content"><div className="page-title-row"><div><p className="eyebrow">RESTRICTED AREA</p><h1>Admin review dashboard</h1><p className="muted">Demo interface only. Production admin access must be enforced by Supabase roles and server-side policies.</p></div><Badge type="amber">Demo view</Badge></div><div className="stats-grid"><Stat icon={UserRound} label="Users" value="—" tint="blue"/><Stat icon={Search} label="Reports" value={items.length} tint="green"/><Stat icon={Clock3} label="Pending review" value="—" tint="amber"/><Stat icon={CheckCircle2} label="Returns" value={items.filter(i=>i.status==='returned').length} tint="green"/></div><div className="panel"><div className="panel-heading"><div><h2>Recent reports</h2><p>Sample records for the prototype.</p></div></div>{items.map(i=><div className="report-row" key={i.id}><ItemImage item={i}/><div className="report-info"><b>{i.name}</b><small>{i.kind} · {i.location} · {i.id}</small></div><Badge type={i.status==='returned'?'green':'amber'}>{i.status || 'open'}</Badge><Button variant="outline" onClick={()=>notify('Demo only: connect admin role policies and claim review endpoints before using this action.')}>Review</Button></div>)}</div><div className="inline-note"><AlertTriangle size={17}/> Do not deploy this admin page as a security boundary until role-based authorization is implemented.</div><Button variant="outline" onClick={()=>go('dashboard')}>Back to dashboard</Button></section>;
}

function Footer({ go }) {
  return <footer className="footer">
    <div className="page-wrap footer-inner">
      <div>
        <Brand onClick={() => go('home')} />
        <p>A thoughtful way to return what matters.</p>
      </div>

      <div className="footer-links">
        <button onClick={() => go('how')}>How it works</button>
        <button onClick={() => go('search')}>Browse items</button>
        <button onClick={() => go('admin')}>Admin demo</button>
      </div>

      <div className="footer-note">
        <ShieldCheck size={15} /> Privacy-first by design
      </div>
    </div>

    <div className="page-wrap" style={{ textAlign: 'center', padding: '20px 0' }}>
      <p style={{ marginBottom: '8px' }}>
        Designed &amp; Developed by <strong>N. Siva</strong>
      </p>
      <p style={{ marginBottom: '8px' }}>
        Project Helper: <strong>Naveen</strong>
      </p>
      <p style={{ fontSize: '13px', opacity: 0.7 }}>
        BCA Students | Aspiring Software Developers
      </p>
    </div>

    <div className="page-wrap copyright">
      © {new Date().getFullYear()} LostLink. AI-assisted matching; ownership requires verification.
    </div>
  </footer>;
}
