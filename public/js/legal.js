// ============================================================
// K - legal.js
// Legal pages: Terms of Service + Terms of Use
// ============================================================

const sec = (title, body) => `
  <section class="legal-sec">
    <h2>${title}</h2>
    ${body}
  </section>
`;

const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

const today = () => new Date().toISOString().slice(0, 10);

const shell = (title, updated, intro, sections) => `
  <div class="legal-page layout-container">
    <h1 class="legal-title heading-trail">${title}</h1>
    <p class="legal-updated">Last updated: ${updated}</p>
    <div class="legal-intro">${intro}</div>
    ${sections.join('')}
    <div class="legal-foot">
      Questions, abuse reports, or DMCA notices: <a href="mailto:abuse@potato-ashy.vercel.app">abuse@potato-ashy.vercel.app</a>
    </div>
  </div>
`;

export function renderTerms(root) {
  const sections = [
    sec(
      '1. Acceptance of These Terms',
      `<p>By accessing, browsing, or using K in any way — including through any application, device, or embedded player — you agree to be bound by these Terms of Service and all terms referenced herein. If you do not agree, you must stop using K immediately. Continued use of K after any change to these Terms constitutes full acceptance.</p>`
    ),
    sec(
      '2. Nature of the Service',
      `<p>K is an informational directory and discovery interface. K does not host, store, upload, stream, distribute, or transmit any motion picture, television program, or other audiovisual content. All metadata and imagery are provided by The Movie Database (TMDB). All playback is delivered by independent third-party embedding services over which K has no control. K does not warrant that any title will be playable, and playback may be interrupted, restricted, or removed at any time by those third parties without notice.</p>`
    ),
    sec(
      '3. Limited, Revocable License',
      `<p>Subject to these Terms, K grants you a personal, non-exclusive, non-transferable, non-sublicensable, and <strong>revocable at any time</strong> license to access and use K solely for your own personal, non-commercial entertainment. You may not use K for any commercial purpose, and any commercial use is an immediate material breach of these Terms.</p>`
    ),
    sec(
      '4. Prohibited Conduct',
      `<p>You agree not to, and not to attempt to:</p>` +
      ul([
        'Scrape, crawl, spider, harvest, or programmatically collect any data, content, identifiers, or metadata from K by any automated means whatsoever, including without limitation scripts, bots, or agents, regardless of volume.',
        'Circumvent, disable, interfere with, or bypass any access control, rate limit, cache, or technical restriction on K or on any third-party service it references.',
        'Rebroadcast, redistribute, reframe, mirror, embed, or publicly perform any content accessed through K, including in part.',
        'Reverse engineer, decompile, or disassemble any portion of K or probe, scan, or test its infrastructure.',
        'Use K for any unlawful, infringing, or fraudulent purpose, or to facilitate any such activity.',
        'Impersonate any person, misrepresent your identity, or attempt to avoid an existing block or restriction.',
        'Attempt to interfere with the proper functioning of K, including via denial-of-service, flooding, or excessive automated requests.'
      ])
    ),
    sec(
      '5. No Warranties',
      `<p>K IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT K WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF HARMFUL COMPONENTS, THAT ANY TITLE WILL BE AVAILABLE, OR THAT ANY CONTENT, METADATA, OR THIRD-PARTY EMBED WILL BE ACCURATE OR LEGAL IN YOUR JURISDICTION. YOU USE K ENTIRELY AT YOUR OWN RISK. IT IS YOUR RESPONSIBILITY TO ENSURE THAT YOUR USE IS LAWFUL WHERE YOU LIVE.</p>`
    ),
    sec(
      '6. Limitation of Liability',
      `<p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, K, ITS OPERATORS, AFFILIATES, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF DATA, REVENUE, PROFITS, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE K, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. TO THE EXTENT ANY LIABILITY CANNOT BE EXCLUDED, THE AGGREGATE LIABILITY OF K AND ITS OPERATORS SHALL NOT EXCEED ZERO (US $0.00).</p>`
    ),
    sec(
      '7. Indemnification',
      `<p>You agree to indemnify, defend, and hold harmless K, its operators, affiliates, and licensors from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys\u2019 fees) arising out of or related to your use of K, your violation of these Terms, your violation of any third-party right, or your unlawful or infringing activity, whether occurring through K or otherwise.</p>`
    ),
    sec(
      '8. Termination and Blocking',
      `<p>We may terminate, suspend, or restrict your access to K — or any part of it — at any time, for any reason or no reason, with or without notice, and without liability. This includes, without limitation, conduct we determine, in our sole discretion, to be harmful, abusive, suspicious, or in violation of these Terms. We may also block any user, device, IP address, or region at our sole discretion and without explanation. All provisions of these Terms that by their nature should survive termination shall survive it.</p>`
    ),
    sec(
      '9. Copyright and DMCA',
      `<p>K respects intellectual property rights and expects you to do the same. If you believe that material appearing on or linked through K infringes your copyright, submit a notice to the address in the footer containing: (i) identification of the copyrighted work and of the allegedly infringing material, with enough detail to locate it; (ii) a statement that you have a good-faith belief the use is unauthorized; (iii) a statement, under penalty of perjury, that the information is accurate and that you own the right or are authorized to act on the owner\u2019s behalf; and (iv) your contact information and signature. K will act on valid notices, including disabling or removing referenced third-party content where within its control, and may bar repeat infringers. Copyright holders may also direct takedown requests to the third-party streaming services that actually host and transmit the content, as K does not control those services.</p>`
    ),
    sec(
      '10. Third-Party Services',
      `<p>K relies on third-party services, including but not limited to TMDB and independent embed players, each governed by its own terms and privacy policies. K is not responsible for the availability, content, legality, or data practices of any third-party service, and your use of such services is solely at your own risk.</p>`
    ),
    sec(
      '11. Changes to These Terms',
      `<p>We may revise these Terms at any time by posting a revised version on K. The revised terms are effective immediately upon posting. Your continued use of K after posting constitutes acceptance of the revised Terms. If you object to any revision, your only remedy is to stop using K.</p>`
    ),
    sec(
      '12. Governing Law, Severability, Entire Agreement',
      `<p>These Terms are governed by the laws of the jurisdiction in which the operator is established, without regard to conflict-of-law principles. If any provision is held invalid or unenforceable, the remaining provisions shall remain in full force and effect. These Terms constitute the entire agreement between you and K and supersede all prior agreements and understandings.</p>`
    ),
  ];

  root.innerHTML = shell(
    'Terms of Service',
    today(),
    '<p>These Terms of Service ("Terms") are a binding agreement between you and K. They are strict, they are enforceable, and they are applied. Read them before you use K.</p>',
    sections
  );
}

export function renderTermsOfUse(root) {
  const sections = [
    sec(
      '1. Hard Rules',
      `<p>These Terms of Use are not a suggestion. By using K you agree, without reservation, to the following. Breaking any rule here may result in immediate, permanent blocking — without notice and without appeal.</p>`
    ),
    sec(
      '2. What You May Not Do',
      `<p>You may not, under any circumstances:</p>` +
      ul([
        'Use bots, scripts, scrapers, or any automated process to access, copy, or monitor K or any part of it.',
        'Hotlink, mirror, reframe, or re-embed K or any of its content on any other site or app.',
        'Resell, lease, sublicense, or commercially exploit access to K or its content, in whole or in part.',
        'Access K through any VPN, proxy, or anonymizer for the purpose of evading a block, restriction, or rate limit.',
        'Use K to distribute or amplify any unlawful, defamatory, or infringing material.',
        'Probe, test, or attack K\u2019s infrastructure, APIs, or any connected service.',
        'Attempt to conceal, alter, or spoof your device, browser, or identity to bypass any limitation we impose.'
      ])
    ),
    sec(
      '3. Abuse, Monitoring, and Blocking',
      `<p>K reserves the right to monitor usage and traffic. We do not have to warn you, and we will not negotiate. We may block any user, IP address, device, user agent, or region — permanently or temporarily — in our sole discretion, for any reason we deem fit, with no obligation to explain, reinstate, or refund (there is nothing to refund). Attempting to evade a block is itself a violation and will be treated with maximum severity.</p>`
    ),
    sec(
      '4. Playback and Third-Party Content',
      `<p>Playback on K is executed by independent third-party embedding services. K is not the broadcaster, publisher, or distributor of any stream and cannot guarantee that a title will play, how long it will remain available, or whether it is lawful for you to view in your jurisdiction. You accept full responsibility for anything you choose to watch, download, or otherwise access through K.</p>`
    ),
    sec(
      '5. Age and Consent',
      `<p>If you are under the age of majority in your jurisdiction, you may use K only under the supervision of a parent or guardian who agrees to these Terms on your behalf. K is not intended for unsupervised use by minors, and we reserve the right to require proof of age or block access at any time.</p>`
    ),
    sec(
      '6. Zero-Tolerance Enforcement',
      `<p>K operates a zero-tolerance policy. Suspicious traffic, repeated automated access, bulk requests, or behavior resembling scraping will trigger automated countermeasures, including blocks that cannot be appealed. These measures are final.</p>`
    ),
    sec(
      '7. Disclaimer and Liability',
      `<p>K is provided "as is" and "as available", without warranty of any kind. To the maximum extent permitted by law, K and its operators are not liable for any damages arising from your use of K, including but not limited to any third-party playback failure, data loss, or legal consequences arising from your viewing of third-party content. Our aggregate liability, if any, shall not exceed zero (US $0.00). Full terms are set out in the Terms of Service.</p>`
    ),
    sec(
      '8. Contact',
      `<p>For abuse reports, copyright complaints, or anything else, contact the address in the footer. We do not guarantee a response.</p>`
    ),
  ];

  root.innerHTML = shell(
    'Terms of Use',
    today(),
    '<p>You are using K on our terms, not yours. If you cannot accept that, leave now.</p>',
    sections
  );
}
