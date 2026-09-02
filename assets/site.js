// ===== Traders Academy - საერთო JS (ყველა გვერდზე იტვირთება) =====
// იგივე Supabase პროექტი, რასაც Trade Journal იყენებს - ერთი ანგარიში
// მუშაობს ორივეგან (კომენტარებზეც და ჟურნალზეც).

const SUPABASE_URL = 'https://wodwjidgyztutjmopjga.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rcMEGjuzhrugF4UiMmfr8g_5ciBAbu-';

window.TA = (function(){
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function fmtDate(iso){
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('ka-GE', { year:'numeric', month:'long', day:'numeric' });
  }

  const CATEGORY_LABELS = {
    market_analysis: 'ბაზრის ანალიზი',
    price_action_tips: 'Price Action Tips',
    psychology: 'ფსიქოლოგია'
  };

  const NAV_LINKS = [
    ['/', 'მთავარი'],
    ['/about.html', 'აკადემია'],
    ['/course.html', 'კურსი'],
    ['/blog/', 'სტატიები'],
    ['/referrals.html', 'რესურსები']
  ];

  function mountNav(activePath){
    const el = document.getElementById('ta-nav');
    if (!el) return;
    el.innerHTML = `
      <div class="nav-inner">
        <a href="/" class="nav-logo">Traders Academy</a>
        <button class="nav-burger" id="ta-burger" aria-label="მენიუ">☰</button>
        <div class="nav-links" id="ta-nav-links">
          ${NAV_LINKS.map(([href, label]) => `<a href="${href}" ${activePath===href?'class="active"':''}>${label}</a>`).join('')}
          <a href="/journal/" class="nav-cta">Trade Journal</a>
        </div>
      </div>
    `;
    const burger = document.getElementById('ta-burger');
    const links = document.getElementById('ta-nav-links');
    if (burger) burger.onclick = () => links.classList.toggle('open');
  }

  function mountFooter(){
    const el = document.getElementById('ta-footer');
    if (!el) return;
    el.innerHTML = `
      <div class="wrap">
        <span>© ${new Date().getFullYear()} Traders Academy · ყველა უფლება დაცულია</span>
        <div class="footer-links">
          <a href="/about.html">აკადემია</a>
          <a href="/course.html">კურსი</a>
          <a href="/blog/">სტატიები</a>
          <a href="/referrals.html">რესურსები</a>
        </div>
      </div>
    `;
  }

  async function getUser(){
    const { data: { session } } = await sb.auth.getSession();
    return session && session.user ? session.user : null;
  }

  async function isAdmin(userId){
    if (!userId) return false;
    try {
      const { data, error } = await sb.from('profiles').select('is_admin').eq('id', userId).single();
      if (error) return false;
      return !!(data && data.is_admin);
    } catch(e){ return false; }
  }

  async function ensureProfile(user){
    if (!user) return;
    try {
      await sb.from('profiles').upsert({ id: user.id, display_name: user.email }, { onConflict: 'id', ignoreDuplicates: true });
    } catch(e){ /* profile უკვე არსებობს ან RLS არ უშვებს - უსაფრთხოდ იგნორირდება */ }
  }

  // კომპაქტური ავტორიზაციის ვიჯეტი - გამოიყენება კომენტარებზე და Admin გვერდზე.
  // container-ში რენდერავს login/register ფორმას; წარმატებული შესვლის შემდეგ
  // იძახებს onAuthChange(user)-ს.
  function renderAuthWidget(container, onAuthChange){
    let mode = 'login'; // 'login' | 'register' | 'verify'
    let pendingEmail = '';

    function render(){
      if (mode === 'login'){
        container.innerHTML = `
          <form id="ta-login-form" class="card" style="max-width:380px;">
            <div class="serif" style="font-size:16px; font-weight:600; margin-bottom:14px;">შესვლა კომენტარისთვის</div>
            <div style="margin-bottom:10px;"><label class="field-label">Email</label><input class="input" type="email" name="email" required/></div>
            <div style="margin-bottom:14px;"><label class="field-label">პაროლი</label><input class="input" type="password" name="password" required/></div>
            <div id="ta-auth-msg"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;">შესვლა</button>
            <div style="margin-top:12px; font-size:13px; color:var(--text3);">არ გაქვთ ანგარიში? <a href="#" id="ta-to-register" style="color:var(--accent);">დარეგისტრირდით</a></div>
          </form>
        `;
        container.querySelector('#ta-login-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const msg = container.querySelector('#ta-auth-msg');
          msg.innerHTML = '';
          const { data, error } = await sb.auth.signInWithPassword({ email: fd.get('email'), password: fd.get('password') });
          if (error){ msg.innerHTML = `<div class="status-msg status-error">${escapeHtml(error.message)}</div>`; return; }
          await ensureProfile(data.user);
          onAuthChange(data.user);
        });
        container.querySelector('#ta-to-register').onclick = (e) => { e.preventDefault(); mode = 'register'; render(); };
      } else if (mode === 'register'){
        container.innerHTML = `
          <form id="ta-register-form" class="card" style="max-width:380px;">
            <div class="serif" style="font-size:16px; font-weight:600; margin-bottom:14px;">რეგისტრაცია</div>
            <div style="margin-bottom:10px;"><label class="field-label">სახელი</label><input class="input" type="text" name="name" required/></div>
            <div style="margin-bottom:10px;"><label class="field-label">Email</label><input class="input" type="email" name="email" required/></div>
            <div style="margin-bottom:14px;"><label class="field-label">პაროლი</label><input class="input" type="password" name="password" minlength="6" required/></div>
            <div id="ta-auth-msg"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;">რეგისტრაცია</button>
            <div style="margin-top:12px; font-size:13px; color:var(--text3);">უკვე გაქვთ ანგარიში? <a href="#" id="ta-to-login" style="color:var(--accent);">შედით</a></div>
          </form>
        `;
        container.querySelector('#ta-register-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const msg = container.querySelector('#ta-auth-msg');
          msg.innerHTML = '';
          const { data, error } = await sb.auth.signUp({ email: fd.get('email'), password: fd.get('password'), options: { data: { display_name: fd.get('name') } } });
          if (error){ msg.innerHTML = `<div class="status-msg status-error">${escapeHtml(error.message)}</div>`; return; }
          pendingEmail = fd.get('email');
          mode = 'verify'; render();
        });
        container.querySelector('#ta-to-login').onclick = (e) => { e.preventDefault(); mode = 'login'; render(); };
      } else if (mode === 'verify'){
        container.innerHTML = `
          <form id="ta-verify-form" class="card" style="max-width:380px;">
            <div class="serif" style="font-size:16px; font-weight:600; margin-bottom:10px;">დაადასტურეთ Email</div>
            <div style="font-size:13px; color:var(--text2); margin-bottom:14px;">კოდი გამოგზავნილია მისამართზე ${escapeHtml(pendingEmail)}</div>
            <input class="input" type="text" name="token" placeholder="დამადასტურებელი კოდი" required style="margin-bottom:14px;"/>
            <div id="ta-auth-msg"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;">დადასტურება</button>
          </form>
        `;
        container.querySelector('#ta-verify-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const msg = container.querySelector('#ta-auth-msg');
          const { data, error } = await sb.auth.verifyOtp({ email: pendingEmail, token: fd.get('token'), type: 'signup' });
          if (error){ msg.innerHTML = `<div class="status-msg status-error">${escapeHtml(error.message)}</div>`; return; }
          await ensureProfile(data.user);
          onAuthChange(data.user);
        });
      }
    }
    render();
  }

  return { sb, escapeHtml, fmtDate, CATEGORY_LABELS, mountNav, mountFooter, getUser, isAdmin, ensureProfile, renderAuthWidget };
})();
