#!/usr/bin/env python3
"""Prepare a validated static NOTALEX release once the real domain is purchased.

Usage:
  python tools/publish.py --domain https://example.ru --out ./public
  python tools/publish.py --domain https://example.ru --gtm GTM-ABC1234 --metrika 12345678 \
       --enable-consent-ui --out ./public

Account creation, GTM tag setup and legal approval are NOT automated by this script.
"""
import argparse
import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


def main():
    p = argparse.ArgumentParser(description='Build published NOTALEX files with real domain and service IDs')
    p.add_argument('--domain', required=True, help='Canonical https:// host, for example https://notalex.ru')
    p.add_argument('--out', default='public', help='Output directory (will replace if it already exists)')
    p.add_argument('--gtm', default='', help='Google Tag Manager container ID GTM-XXXXXXX')
    p.add_argument('--metrika', type=int, default=0, help='Yandex Metrika counter ID')
    p.add_argument('--enable-consent-ui', action='store_true', help='Enable tracking only with visitor opt-in UI, after legal/privacy review')
    p.add_argument('--privacy-policy-url', default='', help='Real published policy link; required when enabling tracking')
    p.add_argument('--google-verification', default='', help='Exact Search Console meta token if using URL-prefix method')
    p.add_argument('--yandex-verification', default='', help='Exact Yandex Webmaster meta token')
    args=p.parse_args()
    domain=args.domain.rstrip('/')
    u=urlsplit(domain)
    if u.scheme != 'https' or not u.hostname or u.path not in ('','/') or u.query or u.fragment or u.username:
        p.error('--domain must be a real https://hostname with no path/query')
    if u.hostname.endswith(('.invalid','.example','.test','.localhost')) or u.hostname in ('example.com','example.ru','your-domain.ru'):
        p.error('Use the real purchased domain, not a placeholder')
    if args.gtm and not re.fullmatch(r'GTM-[A-Z0-9]+',args.gtm): p.error('Invalid GTM container ID')
    if args.metrika < 0: p.error('Metrika ID must be non-negative')
    if (args.gtm or args.metrika) and not args.enable_consent_ui:
        p.error('To activate tags, explicitly pass --enable-consent-ui only after privacy/legal review')
    if (args.gtm or args.metrika) and not args.privacy_policy_url:
        p.error('Add an actual privacy policy URL with --privacy-policy-url when enabling tags')
    if args.privacy_policy_url:
        pu=urlsplit(args.privacy_policy_url)
        if pu.scheme != 'https' or not pu.hostname: p.error('Privacy policy must have a real absolute HTTPS URL')
    for token in (args.google_verification, args.yandex_verification):
        if token and not re.fullmatch(r'[a-zA-Z0-9_\-\.:]+',token): p.error('Invalid verification token')
    out=Path(args.out).resolve()
    if out == ROOT.resolve() or str(ROOT.resolve()).startswith(str(out)+'/'): p.error('Output cannot contain source tree')
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True)
    public=['index.html','style.css','hero-reference.css','navigation.css','script.js','tracking-config.js','tracking.js','robots.txt','favicon.ico','favicon.png','og-preview.jpg']
    for f in public: shutil.copy2(ROOT/f,out/f)
    shutil.copytree(ROOT/'assets',out/'assets')

    (out/'robots.txt').write_text('User-agent: *\nAllow: /\n\nSitemap: '+domain+'/sitemap.xml\n',encoding='utf-8')
    sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>'+html.escape(domain+'/')+'</loc></url>\n</urlset>\n'
    (out/'sitemap.xml').write_text(sitemap,encoding='utf-8')
    cfg='''/* Production config: requires explicit visitor consent; tags otherwise remain off. */\nwindow.NOTALEX_TRACKING_CONFIG = Object.freeze({\n  enabled: %(enabled)s,\n  googleTagManagerId: %(gtm)s,\n  yandexMetrikaId: %(metrika)s,\n  consentPromptEnabled: %(enabled)s,\n  privacyPolicyUrl: %(privacy)s\n});\n''' % {
       'enabled':'true' if args.enable_consent_ui and (args.gtm or args.metrika) else 'false',
       'gtm':json.dumps(args.gtm), 'metrika':str(args.metrika or 'null'), 'privacy':json.dumps(args.privacy_policy_url)
    }
    (out/'tracking-config.js').write_text(cfg,encoding='utf-8')
    index=(out/'index.html').read_text(encoding='utf-8')
    tags='\n<link rel="canonical" href="'+html.escape(domain+'/',quote=True)+'">\n'
    tags+='<meta property="og:url" content="'+html.escape(domain+'/',quote=True)+'">\n'
    tags+='<meta property="og:image" content="'+html.escape(domain+'/og-preview.jpg',quote=True)+'">\n'
    tags+='<meta property="og:image:alt" content="НОТАЛЕКС — юридические услуги в Санкт-Петербурге">\n'
    tags+='<meta name="twitter:image" content="'+html.escape(domain+'/og-preview.jpg',quote=True)+'">\n'
    if args.google_verification:
        tags+='<meta name="google-site-verification" content="'+html.escape(args.google_verification,quote=True)+'">\n'
    if args.yandex_verification:
        tags+='<meta name="yandex-verification" content="'+html.escape(args.yandex_verification,quote=True)+'">\n'
    schema={
      '@context':'https://schema.org','@type':'LegalService',
      'name':'НОТАЛЕКС','url':domain+'/',
      'description':'Юридическая помощь в Санкт-Петербурге и Ленинградской области',
      'areaServed':['Санкт-Петербург','Ленинградская область'],
      'address':{'@type':'PostalAddress','streetAddress':'ул. Мира, 36','addressLocality':'Санкт-Петербург','addressCountry':'RU'},
      'telephone':'+79219582481','image':domain+'/og-preview.jpg'
    }
    # This is intentionally only grounded fields from the site; owner must verify office/registration details.
    tags+='<script type="application/ld+json">'+json.dumps(schema,ensure_ascii=False,separators=(',',':'))+'</script>\n'
    if '</head>' not in index: raise RuntimeError('Unexpected HTML: missing head')
    index=index.replace('</head>',tags+'</head>',1)
    (out/'index.html').write_text(index,encoding='utf-8')
    print('Ready for HTTPS upload:',out)
    print('Domain:',domain)
    print('Third-party tags:', 'consent gated' if args.gtm or args.metrika else 'off')

if __name__ == '__main__': main()
