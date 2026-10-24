/* NOTALEX: consent-gated event collection for Google Tag Manager + Yandex Metrika.
   No third-party scripts are loaded without a real ID and explicit consent.
   GTM is the sole installation point for Google Analytics 4 and Google Ads tags. */
(function () {
  'use strict';
  var config = window.NOTALEX_TRACKING_CONFIG || {};
  var gtmId = String(config.googleTagManagerId || '');
  var metrikaId = Number(config.yandexMetrikaId);
  var validGtm = /^GTM-[A-Z0-9]+$/.test(gtmId);
  var validMetrika = Number.isSafeInteger(metrikaId) && metrikaId > 0;
  if (!config.enabled || !config.consentPromptEnabled || (!validGtm && !validMetrika)) return;

  var storageKey = 'notalex-consent-v1';
  var consent = null;
  var loadedGtm = false;
  var loadedMetrika = false;
  var notice = null;
  function readChoice() {
    try {
      var x = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return x && typeof x.analytics === 'boolean' && typeof x.ads === 'boolean' ? x : null;
    } catch (e) { return null; }
  }
  function saveChoice(v) {
    try { localStorage.setItem(storageKey, JSON.stringify({analytics:v.analytics,ads:v.ads,updatedAt:new Date().toISOString()})); } catch (e) {}
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent','default',{
    analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied',
    ad_personalization:'denied', functionality_storage:'granted', security_storage:'granted'
  });

  function updateConsent(v) {
    consent = {analytics:!!v.analytics, ads:!!v.ads};
    window.gtag('consent','update',{
      analytics_storage:consent.analytics ? 'granted' : 'denied',
      ad_storage:consent.ads ? 'granted' : 'denied',
      ad_user_data:consent.ads ? 'granted' : 'denied',
      ad_personalization:consent.ads ? 'granted' : 'denied'
    });
    window.dataLayer.push({event:'notalex_consent_update', notalex_analytics_consent:consent.analytics, notalex_ads_consent:consent.ads});
    if (consent.analytics || consent.ads) startGoogle();
    if (consent.analytics) startMetrika();
    if (notice) notice.remove();
    notice = null;
  }
  function startGoogle() {
    if (!validGtm || loadedGtm) return;
    loadedGtm = true;
    window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});
    var el = document.createElement('script');
    el.async = true;
    el.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(gtmId);
    document.head.appendChild(el);
  }
  function startMetrika() {
    if (!validMetrika || loadedMetrika) return;
    loadedMetrika = true;
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://mc.yandex.ru/metrika/tag.js'; document.head.appendChild(s);
    window.ym(metrikaId,'init',{
      clickmap:false, trackLinks:false, accurateTrackBounce:true, webvisor:false
    });
  }
  function choose(analytics,ads) {
    var v={analytics:!!analytics,ads:!!ads};
    saveChoice(v);
    // On changes after tags loaded, a reload prevents subsequent navigation from reusing old tags.
    var wasActive=consent && (consent.analytics || consent.ads);
    updateConsent(v);
    if(wasActive && !v.analytics && !v.ads) window.location.reload();
  }
  function consentButton(label,analytics,ads,className) {
    var button = document.createElement('button');
    button.type = 'button';button.textContent = label;button.className=className;
    button.addEventListener('click',function(){choose(analytics,ads);});
    return button;
  }
  function showPrompt() {
    if (notice) return;
    notice = document.createElement('section');
    notice.setAttribute('role','region');notice.setAttribute('aria-label','Настройки аналитики');
    notice.className = 'notalex-consent-panel';
    var message=document.createElement('p');
    message.textContent='Разрешить аналитику посещений и рекламные измерения? Вы можете отказаться. Без согласия счётчики не загружаются.';
    var buttons=document.createElement('div');buttons.className='notalex-consent-actions';
    buttons.appendChild(consentButton('Не разрешать',false,false,'notalex-consent-reject'));
    buttons.appendChild(consentButton('Только аналитика',true,false,'notalex-consent-analytics'));
    buttons.appendChild(consentButton('Аналитика и реклама',true,true,'notalex-consent-accept'));
    notice.appendChild(message);
    if (config.privacyPolicyUrl) {
      var policy = document.createElement('a');
      policy.href = String(config.privacyPolicyUrl);policy.textContent='Политика обработки данных';
      policy.className='notalex-consent-policy';policy.target='_blank';policy.rel='noopener noreferrer';
      notice.appendChild(policy);
    }
    notice.appendChild(buttons);document.body.appendChild(notice);
  }
  // A minimal, separate consent UI only becomes visible after the owner enables tags.
  var style=document.createElement('style');
  style.textContent='.notalex-consent-panel{position:fixed;z-index:9999;bottom:12px;left:12px;right:12px;max-width:690px;margin:auto;padding:17px 20px;background:#f7f5f0;color:#102234;border:1px solid #c9aa77;box-shadow:0 9px 25px rgba(0,0,0,.24);font:14px/1.5 Arial,sans-serif}.notalex-consent-panel p{margin:0 0 12px}.notalex-consent-policy{display:inline-block;margin:0 0 12px;color:#163d62;text-decoration:underline}.notalex-consent-actions{display:flex;gap:8px;flex-wrap:wrap}.notalex-consent-actions button{min-height:40px;padding:8px 12px;border:1px solid #9b8058;background:transparent;color:#102234;cursor:pointer}.notalex-consent-actions .notalex-consent-accept{background:#c9aa77}.notalex-consent-actions button:focus-visible{outline:3px solid #175c91;outline-offset:2px}';
  document.head.appendChild(style);
  function addPreferencesControl() {
    var footer=document.querySelector('.footer-inner');if (!footer || footer.querySelector('.notalex-consent-settings')) return;
    var link=document.createElement('button');link.type='button';
    link.className='notalex-consent-settings';link.textContent='Настройки аналитики';
    link.style.cssText='font:inherit;font-size:12px;cursor:pointer;border:0;padding:4px;background:transparent;color:inherit;text-decoration:underline;';
    link.addEventListener('click',showPrompt);footer.appendChild(link);
  }
  if (document.readyState==='loading')document.addEventListener('DOMContentLoaded',addPreferencesControl,{once:true});else addPreferencesControl();
  window.NOTALEX_PRIVACY = {
    openSettings: function () { showPrompt(); },
    revoke: function () { choose(false,false); },
    getStatus: function () { return consent ? {analytics:consent.analytics,ads:consent.ads} : null; }
  };

  // Contact interactions are interest signals, not confirmed legal-client leads.
  document.addEventListener('click',function(event){
    if (!consent || (!consent.analytics && !consent.ads)) return;
    var target=event.target;
    if (!target || !target.closest) return;
    var link=target.closest('a[href]');if (!link) return;
    var href=link.getAttribute('href')||'';
    var goal = '', method = '';
    if (/^tel:/i.test(href)) {goal='click_phone';method='phone';}
    else if (/^https?:\/\/(?:www\.)?wa\.me\//i.test(href)) {goal='click_whatsapp';method='whatsapp';}
    else if (/^https?:\/\/(?:www\.)?t\.me\//i.test(href)) {goal='click_telegram';method='telegram';}
    else if (link.matches('a[href="#consultation"]')) {goal='contact_primary';method='consultation_anchor';}
    else if (/^https?:\/\/yandex\.(?:ru|com)\/maps/i.test(href)) {goal='open_map';method='map_link';}
    if (!goal) return;
    if (loadedGtm) window.dataLayer.push({event:'notalex_contact', contact_method:method, contact_goal:goal});
    if (consent.analytics && loadedMetrika && typeof window.ym==='function') window.ym(metrikaId,'reachGoal',goal);
  },{passive:true});

  var prior=readChoice();
  if (prior) updateConsent(prior); else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showPrompt,{once:true});else showPrompt();
})();
