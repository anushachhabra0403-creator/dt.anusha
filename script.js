// Mobile nav toggle
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');
navToggle?.addEventListener('click', ()=>{
  mainNav.classList.toggle('show');
});

// Smooth scroll for internal links
document.querySelectorAll('a[href^="#"]').forEach(a =>{
  a.addEventListener('click', function(e){
    const target = document.querySelector(this.getAttribute('href'));
    if(target){
      e.preventDefault();
      target.scrollIntoView({behavior:'smooth',block:'start'});
      // close mobile nav if open
      mainNav.classList.remove('show');
    }
  })
});

// Enhanced contact form handler: send to endpoint or fallback to mailto
const form = document.getElementById('contact-form');
const formMsg = document.getElementById('form-msg');
// Initialize EmailJS early if SDK and public key are present so sendForm can be used later.
(function initEmailJSIfAvailable(){
  const ejPub = document.querySelector('meta[name="emailjs-public-key"]')?.getAttribute('content')?.trim();
  const sdkUrls = [
    // try reliable CDNs and a local vendor copy as a last resort
    'https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js',
    'https://unpkg.com/emailjs-com@3/dist/email.min.js',
    'https://cdn.emailjs.com/sdk/3.2.0/email.min.js',
    'https://cdn.emailjs.com/sdk/2.4.1/email.min.js',
    './vendor/email.min.js'
  ];

  function loadSdk(url){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => resolve(url);
      s.onerror = (err) => reject(err || new Error('Failed to load ' + url));
      document.head.appendChild(s);
    });
  }

  (async ()=>{
    try{
      if(!ejPub){
        console.log('EmailJS public key meta tag empty — will not initialize EmailJS.');
        return;
      }
      if(window.emailjs && typeof emailjs.init === 'function'){
        emailjs.init(ejPub);
        console.log('EmailJS already present; initialized with public key.');
        return;
      }

      // Try loading SDK from known URLs until one succeeds
      let loaded = false;
      for(const url of sdkUrls){
        try{
          console.log('Attempting to load EmailJS SDK from', url);
          await loadSdk(url);
          if(window.emailjs && typeof emailjs.init === 'function'){
            emailjs.init(ejPub);
            console.log('EmailJS SDK loaded and initialized from', url);
            loaded = true;
            break;
          }
        }catch(err){
          console.warn('Failed to load EmailJS SDK from', url, err);
        }
      }

      if(!loaded){
        console.warn('Could not load EmailJS SDK from CDN. Check network, adblockers, or use a local copy.');
      }
    }catch(e){
      console.warn('EmailJS init sequence error', e);
    }
  })();
})();
if(form){
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = {};
    new FormData(form).forEach((v,k)=> data[k]=v);
    // Basic validation: consent
    if(form.querySelector('[name="consent"]') && !form.querySelector('[name="consent"]').checked){
      formMsg.textContent = 'Please consent to be contacted.';
      return;
    }

    // Provide feedback to user
    formMsg.textContent = 'Sending...';

    // --- EmailJS attempt (client-side) ---
    // If you add your EmailJS public key, service ID and template ID as meta tags in the <head>,
    // the script will try to send via EmailJS directly (useful to forward to Gmail without running a server).
    try{
      const ejPub = document.querySelector('meta[name="emailjs-public-key"]')?.getAttribute('content')?.trim();
      const ejService = document.querySelector('meta[name="emailjs-service-id"]')?.getAttribute('content')?.trim();
      const ejTemplate = document.querySelector('meta[name="emailjs-template-id"]')?.getAttribute('content')?.trim();
      console.log('EmailJS creds', { ejPub, ejService, ejTemplate, hasEmailJSSDK: !!window.emailjs });
      if(ejPub && ejService && ejTemplate && window.emailjs){
        try{
          // initialize EmailJS (idempotent)
          if(typeof emailjs.init === 'function') emailjs.init(ejPub);
          // send the form using EmailJS (sends fields by name)
          const resp = await emailjs.sendForm(ejService, ejTemplate, form);
          console.log('EmailJS sendForm response', resp);
          // success
          formMsg.textContent = 'Message sent — thank you!';
          try{ if(typeof showShareMsg === 'function') showShareMsg('Message sent — thank you!'); }catch(_){}
          form.reset();
          return;
        }catch(ejErr){
          console.warn('EmailJS send failed', ejErr);
          // show a helpful message to the user and fall through
          formMsg.textContent = 'Sending with EmailJS failed; falling back to other options.';
        }
      } else {
        console.log('EmailJS not configured or SDK not present; skipping EmailJS.');
      }
    }catch(e){
      console.warn('EmailJS attempt failed', e);
      formMsg.textContent = 'EmailJS attempt failed; falling back.';
    }

    // Configurable endpoint (add a meta[name="form-endpoint"] to the head to enable server-side handling)
    const endpointMeta = document.querySelector('meta[name="form-endpoint"]');
    const endpoint = endpointMeta ? endpointMeta.getAttribute('content').trim() : '';

    // Construct plain text message for mailto fallback
    const lines = [];
    lines.push('New contact request from website');
    ['name','email','phone','age','clientType','sport','package','contactMethod','preferredTime','location','message'].forEach(k=>{
      if(data[k]) lines.push(`${k}: ${data[k]}`);
    });
    lines.push('\nPage: ' + location.href);
    const body = lines.join("\n");

    // If an endpoint is configured, POST JSON (server should accept CORS & JSON)
    if(endpoint){
      try{
        const res = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        if(res.ok){
          formMsg.textContent = 'Message sent — thank you!';
          try{ if(typeof showShareMsg === 'function') showShareMsg('Message sent — thank you!'); }catch(_){}
          form.reset();
          return;
        } else {
          console.warn('Form endpoint returned', res.status);
          // fallthrough to mailto fallback
        }
      }catch(err){
        console.warn('Form POST failed', err);
        // fallthrough to mailto fallback
      }
    }

    // Fallback: open the user's email client with a prefilled message to the clinic email
    const clinicEmail = 'info@example.com'; // replace with your real receiving email
    const subject = encodeURIComponent('Website enquiry — ' + (data.name || 'New lead'));
    // mailto has length limits; keep body reasonable
    const mailtoBody = encodeURIComponent(body);
    const mailto = `mailto:${clinicEmail}?subject=${subject}&body=${mailtoBody}`;
    // open mail client
    try{ if(typeof showShareMsg === 'function') showShareMsg('Opening your mail app — complete and send the email to submit.'); }catch(_){}
    window.location.href = mailto;
    formMsg.textContent = 'Please complete the email in your mail app to send (fallback).';
  });
}

// Reveal on scroll (staggered) using IntersectionObserver
document.addEventListener('DOMContentLoaded', ()=>{
  const reveals = Array.from(document.querySelectorAll('.reveal'));
  if(!reveals.length) return;
  const observer = new IntersectionObserver((entries, obs)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        const el = entry.target;
        // stagger for group of siblings if inside .packages
        if(el.parentElement && el.parentElement.classList.contains('packages')){
          // find index among siblings
          const siblings = Array.from(el.parentElement.querySelectorAll('.reveal'));
          const idx = siblings.indexOf(el);
          el.style.transitionDelay = (idx * 120) + 'ms';
        }
        el.classList.add('in-view');
        obs.unobserve(el);
      }
    });
  },{threshold:0.12});

  reveals.forEach(r=>observer.observe(r));
});
