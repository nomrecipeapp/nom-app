import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'hello@nomrecipeapp.com'

serve(async (req) => {
  try {
    const payload = await req.json()
    const user = payload.record

    const email = user.email
    if (!email) return new Response('No email', { status: 400 })

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nom — Welcome!</title>
</head>
<body style="margin:0;padding:0;background-color:#F0E8D8;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1C1A17;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0E8D8;">
  <tr>
    <td align="center" style="padding:40px 20px;">

      <p style="font-size:12px;color:#8A8070;text-align:center;margin:0 0 24px 0;letter-spacing:0.04em;">Your personal cookbook is ready. Let's get you set up.</p>

      <table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background-color:#FAF6EF;border-radius:24px;border:1px solid #D9C9B0;overflow:hidden;">

        <!-- HEADER -->
        <tr>
          <td style="background-color:#C4713A;padding:40px 48px 36px;">
            <p style="font-family:Georgia,serif;font-size:42px;font-weight:700;color:#FAF6EF;letter-spacing:-1.5px;line-height:1;margin:0 0 10px 0;">nom</p>
            <span style="display:inline-block;background-color:rgba(255,255,255,0.18);color:#FAF6EF;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;padding:5px 14px;border-radius:100px;">✦ Welcome to the kitchen</span>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:48px;">

            <!-- Intro -->
            <p style="font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#C4713A;margin:0 0 12px 0;">You made it!</p>
            <p style="font-family:Georgia,serif;font-size:32px;font-weight:700;color:#1C1A17;line-height:1.2;letter-spacing:-0.5px;margin:0 0 24px 0;">Welcome to <span style="font-style:italic;color:#C4713A;">Nom.</span><br>Your cookbook awaits.</p>

            <p style="font-size:15px;color:#3A3630;line-height:1.75;margin:0 0 18px 0;">Hey there! 👋</p>
            <p style="font-size:15px;color:#3A3630;line-height:1.75;margin:0 0 18px 0;">Nom is your personal cookbook — built around how you actually cook. Log recipes, rate them honestly, and see what your friends are making. No algorithms. No strangers. Just your people and your food.</p>
            <p style="font-size:15px;color:#3A3630;line-height:1.75;margin:0 0 32px 0;">Here's everything you need to get started.</p>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 32px 0;">
              <tr><td style="border-top:1px solid #D9C9B0;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- SECTION 1 — The Essentials -->
            <p style="font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#8A8070;margin:0 0 6px 0;">01 — The essentials</p>
            <p style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1C1A17;margin:0 0 20px 0;">What Nom does</p>

            <!-- Phone mockups — 3 screens -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
              <tr valign="top">

                <!-- Log a Cook -->
                <td width="33%" align="center" style="padding:0 5px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FAF6EF;border-radius:16px;border:2px solid #D9C9B0;overflow:hidden;max-width:130px;margin:0 auto;">
                    <tr><td style="background-color:#F0E8D8;padding:5px 8px;text-align:right;">
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                    </td></tr>
                    <tr><td style="padding:10px 8px;">
                      <p style="font-family:Georgia,serif;font-size:11px;font-weight:700;color:#1C1A17;margin:0 0 6px 0;">Log a Cook</p>
                      <div style="width:100%;height:36px;background-color:#F0E8D8;border-radius:6px;margin-bottom:6px;text-align:center;font-size:16px;padding-top:8px;">📷</div>
                      <p style="font-size:6px;color:#8A8070;margin:0 0 4px 0;">Your verdict</p>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:6px;">
                        <tr>
                          <td style="padding-right:2px;"><div style="background-color:#7A8C6E;color:#FAF6EF;font-size:5px;font-weight:600;padding:3px 2px;border-radius:4px;text-align:center;">Make Again</div></td>
                          <td style="padding:0 1px;"><div style="border:1px solid #D9C9B0;color:#8A8070;font-size:5px;padding:3px 2px;border-radius:4px;text-align:center;">It Was Fine</div></td>
                          <td style="padding-left:2px;"><div style="border:1px solid #D9C9B0;color:#8A8070;font-size:5px;padding:3px 2px;border-radius:4px;text-align:center;">Never Again</div></td>
                        </tr>
                      </table>
                      <p style="font-size:6px;color:#8A8070;margin:0 0 3px 0;">Rate it</p>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr><td style="font-size:6px;color:#8A8070;">Flavor</td><td align="right">
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:1px;"></span>
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:1px;"></span>
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:1px;"></span>
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:1px;"></span>
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#F0E8D8;margin-left:1px;"></span>
                        </td></tr>
                        <tr><td style="font-size:6px;color:#8A8070;padding-top:2px;">Effort</td><td align="right">
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:1px;"></span>
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:1px;"></span>
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:1px;"></span>
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#F0E8D8;margin-left:1px;"></span>
                          <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#F0E8D8;margin-left:1px;"></span>
                        </td></tr>
                      </table>
                    </td></tr>
                    <tr><td style="background-color:#FAF6EF;border-top:1px solid #F0E8D8;padding:6px 8px;text-align:center;">
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F0E8D8;margin:0 2px;"></span>
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F0E8D8;margin:0 2px;"></span>
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#C4713A;margin:0 2px;"></span>
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F0E8D8;margin:0 2px;"></span>
                    </td></tr>
                  </table>
                  <p style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8A8070;text-align:center;margin:8px 0 0 0;">Log a Cook</p>
                </td>

                <!-- My Cookbook -->
                <td width="33%" align="center" style="padding:0 5px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FAF6EF;border-radius:16px;border:2px solid #D9C9B0;overflow:hidden;max-width:130px;margin:0 auto;">
                    <tr><td style="background-color:#F0E8D8;padding:5px 8px;text-align:right;">
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                    </td></tr>
                    <tr><td style="padding:10px 8px;">
                      <p style="font-family:Georgia,serif;font-size:11px;font-weight:700;color:#1C1A17;margin:0 0 6px 0;">My Cookbook</p>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="48%" style="padding-right:3px;padding-bottom:3px;vertical-align:top;">
                            <div style="background-color:#F0E8D8;border-radius:5px;overflow:hidden;">
                              <div style="height:26px;background-color:#D9C9B0;"></div>
                              <div style="padding:3px 4px;"><p style="font-size:6px;font-weight:600;color:#1C1A17;margin:0 0 1px 0;">Miso Salmon</p><p style="font-size:6px;color:#7A8C6E;margin:0;">✓ Make Again</p></div>
                            </div>
                          </td>
                          <td width="48%" style="padding-left:3px;padding-bottom:3px;vertical-align:top;">
                            <div style="background-color:#F0E8D8;border-radius:5px;overflow:hidden;">
                              <div style="height:26px;background-color:#C4C9B0;"></div>
                              <div style="padding:3px 4px;"><p style="font-size:6px;font-weight:600;color:#1C1A17;margin:0 0 1px 0;">Peanut Noodles</p><p style="font-size:6px;color:#C4713A;margin:0;">~ It Was Fine</p></div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td width="48%" style="padding-right:3px;vertical-align:top;">
                            <div style="background-color:#F0E8D8;border-radius:5px;overflow:hidden;">
                              <div style="height:26px;background-color:#E8C9A0;"></div>
                              <div style="padding:3px 4px;"><p style="font-size:6px;font-weight:600;color:#1C1A17;margin:0 0 1px 0;">Shakshuka</p><p style="font-size:6px;color:#7A8C6E;margin:0;">✓ Make Again</p></div>
                            </div>
                          </td>
                          <td width="48%" style="padding-left:3px;vertical-align:middle;">
                            <div style="background-color:#F0E8D8;border-radius:5px;border:1.5px dashed #D9C9B0;height:42px;text-align:center;padding-top:12px;font-size:14px;color:#D9C9B0;">+</div>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                    <tr><td style="background-color:#FAF6EF;border-top:1px solid #F0E8D8;padding:6px 8px;text-align:center;">
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F0E8D8;margin:0 2px;"></span>
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F0E8D8;margin:0 2px;"></span>
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F0E8D8;margin:0 2px;"></span>
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#C4713A;margin:0 2px;"></span>
                    </td></tr>
                  </table>
                  <p style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8A8070;text-align:center;margin:8px 0 0 0;">My Cookbook</p>
                </td>

                <!-- Feed -->
                <td width="33%" align="center" style="padding:0 5px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FAF6EF;border-radius:16px;border:2px solid #D9C9B0;overflow:hidden;max-width:130px;margin:0 auto;">
                    <tr><td style="background-color:#F0E8D8;padding:5px 8px;text-align:right;">
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                    </td></tr>
                    <tr><td style="padding:10px 8px;">
                      <p style="font-family:Georgia,serif;font-size:11px;font-weight:700;color:#1C1A17;margin:0 0 6px 0;">Friends' Feed</p>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0E8D8;border-radius:6px;margin-bottom:5px;">
                        <tr><td style="padding:6px;">
                          <div style="width:100%;height:28px;background-color:#D9C9B0;border-radius:4px;margin-bottom:4px;"></div>
                          <span style="display:inline-block;background-color:#7A8C6E22;color:#4A5E42;font-size:6px;font-weight:600;padding:2px 4px;border-radius:8px;margin-bottom:2px;">Would Make Again</span><br>
                          <span style="font-size:7px;font-weight:600;color:#1C1A17;">Miso Butter Salmon</span><br>
                          <span style="font-size:6px;color:#8A8070;">Jamie M. · 2h ago</span>
                        </td></tr>
                      </table>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0E8D8;border-radius:6px;opacity:0.55;">
                        <tr><td style="padding:6px;">
                          <div style="width:100%;height:20px;background-color:#D9C9B0;border-radius:4px;margin-bottom:4px;"></div>
                          <span style="display:inline-block;background-color:#C4713A22;color:#C4713A;font-size:6px;font-weight:600;padding:2px 4px;border-radius:8px;margin-bottom:2px;">It Was Fine</span><br>
                          <span style="font-size:7px;font-weight:600;color:#1C1A17;">Peanut Noodles</span>
                        </td></tr>
                      </table>
                    </td></tr>
                    <tr><td style="background-color:#FAF6EF;border-top:1px solid #F0E8D8;padding:6px 8px;text-align:center;">
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#C4713A;margin:0 2px;"></span>
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F0E8D8;margin:0 2px;"></span>
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F0E8D8;margin:0 2px;"></span>
                      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#F0E8D8;margin:0 2px;"></span>
                    </td></tr>
                  </table>
                  <p style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8A8070;text-align:center;margin:8px 0 0 0;">Friends' Feed</p>
                </td>

              </tr>
            </table>

            <!-- Feature list -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0E8D8;border-radius:12px;margin-bottom:8px;">
              <tr><td style="padding:20px 24px;">
                <p style="font-size:13px;font-weight:600;color:#1C1A17;margin:0 0 12px 0;">The essentials to get started:</p>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr valign="top"><td width="20" style="padding-top:1px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#C4713A;margin-top:5px;"></span></td><td style="padding-bottom:8px;"><p style="font-size:13px;color:#3A3630;margin:0;"><span style="font-weight:600;">Add recipes</span> — paste a link, upload a photo, or add one manually. TikTok &amp; Instagram import coming soon.</p></td></tr><tr valign="top"><td width="20" style="padding-top:1px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#C4713A;margin-top:5px;"></span></td><td style="padding-bottom:8px;"><p style="font-size:13px;color:#3A3630;margin:0;"><span style="font-weight:600;">Log a cook</span> — add any recipe, set your verdict and rate it</p></td></tr>
                  <tr valign="top"><td width="20" style="padding-top:1px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#C4713A;margin-top:5px;"></span></td><td style="padding-bottom:8px;"><p style="font-size:13px;color:#3A3630;margin:0;"><span style="font-weight:600;">Browse your cookbook</span> — everything you've cooked, all in one place</p></td></tr>
                  <tr valign="top"><td width="20" style="padding-top:1px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#C4713A;margin-top:5px;"></span></td><td style="padding-bottom:8px;"><p style="font-size:13px;color:#3A3630;margin:0;"><span style="font-weight:600;">Follow friends</span> — see what they're cooking in your feed</p></td></tr>
                  <tr valign="top"><td width="20" style="padding-top:1px;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:#C4713A;margin-top:5px;"></span></td><td><p style="font-size:13px;color:#3A3630;margin:0;"><span style="font-weight:600;">Explore</span> — search for friends and browse their cookbooks</p></td></tr>
                </table>
                <p style="font-size:12px;color:#8A8070;margin:12px 0 0 0;">There's plenty more to discover — tags, comments, notifications, referrals — but start here and it'll all make sense.</p>
              </td></tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0;">
              <tr><td style="border-top:1px solid #D9C9B0;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- SECTION 2 — Save to Home Screen -->
            <p style="font-size:11px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#8A8070;margin:0 0 6px 0;">02 — Get the app</p>
            <p style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1C1A17;margin:0 0 12px 0;">Save Nom to your iPhone 📱</p>
            <p style="font-size:15px;color:#3A3630;line-height:1.75;margin:0 0 24px 0;">Nom works right in your browser — but you can save it to your home screen so it feels just like a real app. Here's how:</p>

            <!-- Save to home screen steps -->

            <!-- Step 1 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
              <tr valign="top">
                <td width="200" style="padding-right:16px;">
                  <!-- Phone mockup -->
                  <table cellpadding="0" cellspacing="0" border="0" width="160" style="background-color:#FAF6EF;border-radius:20px;border:2px solid #D9C9B0;overflow:hidden;margin:0 auto;">
                    <tr><td style="background-color:#F0E8D8;padding:6px 10px;text-align:right;">
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                    </td></tr>
                    <tr><td style="padding:10px;">
                      <!-- Browser bar -->
                      <div style="background-color:#F0E8D8;border-radius:6px;padding:5px 8px;margin-bottom:8px;font-size:8px;color:#8A8070;">nom.app · Safari</div>
                      <!-- App content preview -->
                      <div style="background-color:#C4713A;border-radius:8px;padding:10px;margin-bottom:6px;text-align:center;">
                        <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#FAF6EF;margin:0;">nom</p>
                      </div>
                      <p style="font-size:8px;color:#8A8070;text-align:center;margin:0;">Nom is open in Safari</p>
                    </td></tr>
                    <!-- Bottom Safari bar -->
                    <tr><td style="background-color:#F0E8D8;padding:8px 10px;text-align:center;border-top:1px solid #D9C9B0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center"><span style="font-size:14px;">←</span></td>
                          <td align="center"><span style="font-size:14px;">→</span></td>
                          <td align="center"><span style="font-size:16px;color:#C4713A;">⬆</span></td>
                          <td align="center"><span style="font-size:14px;">⧉</span></td>
                          <td align="center"><span style="font-size:14px;">📚</span></td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </td>
                <td style="vertical-align:middle;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0E8D8;border-radius:12px;">
                    <tr valign="top">
                      <td width="36" style="padding:14px 0 14px 16px;"><span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#C4713A;">1</span></td>
                      <td style="padding:14px 16px 14px 8px;">
                        <p style="font-size:13px;font-weight:600;color:#1C1A17;margin:0 0 3px 0;">Open Nom in Safari</p>
                        <p style="font-size:12px;color:#8A8070;line-height:1.5;margin:0;">Make sure you're using Safari — it won't work in Chrome. Go to your Nom link.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Step 2 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
              <tr valign="top">
                <td width="200" style="padding-right:16px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="160" style="background-color:#FAF6EF;border-radius:20px;border:2px solid #D9C9B0;overflow:hidden;margin:0 auto;">
                    <tr><td style="background-color:#F0E8D8;padding:6px 10px;text-align:right;">
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                    </td></tr>
                    <tr><td style="padding:10px;">
                      <div style="background-color:#C4713A;border-radius:8px;padding:10px;margin-bottom:8px;text-align:center;">
                        <p style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#FAF6EF;margin:0;">nom</p>
                      </div>
                      <!-- Share sheet -->
                      <div style="background-color:#F0E8D8;border-radius:8px;padding:8px;text-align:center;">
                        <p style="font-size:8px;color:#8A8070;margin:0 0 4px 0;">Share Sheet open</p>
                        <div style="display:inline-block;background-color:#C4713A;border-radius:6px;padding:4px 10px;">
                          <p style="font-size:8px;font-weight:600;color:#FAF6EF;margin:0;">⬆ Share</p>
                        </div>
                      </div>
                    </td></tr>
                    <tr><td style="background-color:#F0E8D8;padding:8px 10px;text-align:center;border-top:1px solid #D9C9B0;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center"><span style="font-size:14px;">←</span></td>
                          <td align="center"><span style="font-size:14px;">→</span></td>
                          <td align="center"><span style="font-size:16px;color:#C4713A;">⬆</span></td>
                          <td align="center"><span style="font-size:14px;">⧉</span></td>
                          <td align="center"><span style="font-size:14px;">📚</span></td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </td>
                <td style="vertical-align:middle;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0E8D8;border-radius:12px;">
                    <tr valign="top">
                      <td width="36" style="padding:14px 0 14px 16px;"><span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#C4713A;">2</span></td>
                      <td style="padding:14px 16px 14px 8px;">
                        <p style="font-size:13px;font-weight:600;color:#1C1A17;margin:0 0 3px 0;">Tap the Share button</p>
                        <p style="font-size:12px;color:#8A8070;line-height:1.5;margin:0;">It's the box with an arrow pointing up at the bottom of your screen.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Step 3 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
              <tr valign="top">
                <td width="200" style="padding-right:16px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="160" style="background-color:#FAF6EF;border-radius:20px;border:2px solid #D9C9B0;overflow:hidden;margin:0 auto;">
                    <tr><td style="background-color:#F0E8D8;padding:6px 10px;text-align:right;">
                      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#C4713A;margin-left:3px;"></span>
                    </td></tr>
                    <tr><td style="padding:10px;">
                      <p style="font-size:8px;color:#8A8070;margin:0 0 6px 0;">Scroll down in share sheet...</p>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr valign="middle" style="opacity:0.4;">
                          <td width="24" style="padding-bottom:6px;"><div style="width:18px;height:18px;border-radius:4px;background-color:#D9C9B0;"></div></td>
                          <td style="padding-bottom:6px;font-size:8px;color:#3A3630;padding-left:6px;">Copy Link</td>
                        </tr>
                        <tr valign="middle" style="opacity:0.4;">
                          <td width="24" style="padding-bottom:6px;"><div style="width:18px;height:18px;border-radius:4px;background-color:#D9C9B0;"></div></td>
                          <td style="padding-bottom:6px;font-size:8px;color:#3A3630;padding-left:6px;">Add Bookmark</td>
                        </tr>
                        <tr valign="middle">
                          <td width="24" style="padding-bottom:6px;"><div style="width:18px;height:18px;border-radius:4px;background-color:#C4713A;text-align:center;padding-top:2px;"><span style="font-size:10px;">+</span></div></td>
                          <td style="padding-bottom:6px;font-size:8px;font-weight:700;color:#C4713A;padding-left:6px;">Add to Home Screen</td>
                        </tr>
                      </table>
                    </td></tr>
                    <tr><td style="background-color:#F0E8D8;padding:8px;text-align:center;border-top:1px solid #D9C9B0;">
                      <span style="font-size:8px;color:#8A8070;">Tap "Add to Home Screen"</span>
                    </td></tr>
                  </table>
                </td>
                <td style="vertical-align:middle;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0E8D8;border-radius:12px;">
                    <tr valign="top">
                      <td width="36" style="padding:14px 0 14px 16px;"><span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#C4713A;">3</span></td>
                      <td style="padding:14px 16px 14px 8px;">
                        <p style="font-size:13px;font-weight:600;color:#1C1A17;margin:0 0 3px 0;">Tap "Add to Home Screen"</p>
                        <p style="font-size:12px;color:#8A8070;line-height:1.5;margin:0;">Scroll down in the share sheet until you see it. Tap it, then tap <strong style="color:#1C1A17;">Add</strong> in the top right.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Step 4 -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr valign="top">
                <td width="200" style="padding-right:16px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="160" style="background-color:#FAF6EF;border-radius:20px;border:2px solid #D9C9B0;overflow:hidden;margin:0 auto;">
                    <tr><td style="background-color:#1C1A17;padding:6px 10px;text-align:center;">
                      <span style="font-size:8px;color:#8A8070;">12:00</span>
                    </td></tr>
                    <tr><td style="padding:10px;background-color:#E8D5C0;">
                      <p style="font-size:8px;color:#8A8070;margin:0 0 8px 0;">Your home screen</p>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="33%" align="center" style="padding-bottom:8px;">
                            <div style="width:36px;height:36px;border-radius:8px;background-color:#D9C9B0;margin:0 auto 3px;"></div>
                            <p style="font-size:7px;color:#3A3630;margin:0;">Photos</p>
                          </td>
                          <td width="33%" align="center" style="padding-bottom:8px;">
                            <div style="width:36px;height:36px;border-radius:8px;background-color:#C4713A;margin:0 auto 3px;text-align:center;padding-top:6px;"><span style="font-family:Georgia,serif;font-size:14px;font-weight:700;color:#FAF6EF;">n</span></div>
                            <p style="font-size:7px;color:#3A3630;margin:0;font-weight:600;">Nom</p>
                          </td>
                          <td width="33%" align="center" style="padding-bottom:8px;">
                            <div style="width:36px;height:36px;border-radius:8px;background-color:#D9C9B0;margin:0 auto 3px;"></div>
                            <p style="font-size:7px;color:#3A3630;margin:0;">Messages</p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                    <tr><td style="background-color:#1C1A17;padding:8px;text-align:center;">
                      <span style="font-size:10px;">—</span>
                    </td></tr>
                  </table>
                </td>
                <td style="vertical-align:middle;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0E8D8;border-radius:12px;">
                    <tr valign="top">
                      <td width="36" style="padding:14px 0 14px 16px;"><span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#C4713A;">4</span></td>
                      <td style="padding:14px 16px 14px 8px;">
                        <p style="font-size:13px;font-weight:600;color:#1C1A17;margin:0 0 3px 0;">Nom is on your home screen!</p>
                        <p style="font-size:12px;color:#8A8070;line-height:1.5;margin:0;">Tap it anytime to open Nom just like an app — no browser bar, no fuss.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 32px 0;">
              <tr><td style="border-top:1px solid #D9C9B0;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- Share with friends card -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#C4713A;border-radius:16px;margin-bottom:32px;">
              <tr>
                <td style="padding:28px;">
                  <p style="font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(250,246,239,0.65);margin:0 0 8px 0;">One more thing</p>
                  <p style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#FAF6EF;line-height:1.2;margin:0 0 10px 0;">Don't forget to bring your people in. 🍽</p>
                  <p style="font-size:13px;color:rgba(250,246,239,0.9);line-height:1.65;margin:0 0 16px 0;">Nom gets better with more friends on it. Head to <strong style="color:#FAF6EF;">Settings</strong> to find your personal referral code and tap <strong style="color:#FAF6EF;">Share</strong> — then send it to the home chefs in your life.</p>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr valign="top">
                      <td width="20"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:rgba(250,246,239,0.5);margin-top:5px;"></span></td>
                      <td style="padding-bottom:6px;"><p style="font-size:13px;color:rgba(250,246,239,0.9);margin:0;">Open Nom and tap your profile</p></td>
                    </tr>
                    <tr valign="top">
                      <td width="20"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:rgba(250,246,239,0.5);margin-top:5px;"></span></td>
                      <td style="padding-bottom:6px;"><p style="font-size:13px;color:rgba(250,246,239,0.9);margin:0;">Go to <strong style="color:#FAF6EF;">Settings</strong></p></td>
                    </tr>
                    <tr valign="top">
                      <td width="20"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background-color:rgba(250,246,239,0.5);margin-top:5px;"></span></td>
                      <td><p style="font-size:13px;color:rgba(250,246,239,0.9);margin:0;">Find your referral code and tap <strong style="color:#FAF6EF;">Share</strong></p></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Sign off -->
            <p style="font-size:15px;color:#3A3630;line-height:1.75;margin:0 0 18px 0;">That's it — you're all set. If anything feels confusing or broken, reply here or email <a href="/cdn-cgi/l/email-protection#a0cecfcd8ed2c5c3c9d0c5c1d0d0e0c7cdc1c9cc8ec3cfcd" style="color:#C4713A;text-decoration:none;"><span class="__cf_email__" data-cfemail="741a1b195a0611171d0411150404341319151d185a171b19">[email&#160;protected]</span></a> and we'll sort it out.</p>
            <p style="font-size:15px;color:#3A3630;line-height:1.75;margin:0 0 18px 0;">We always welcome feedback and new ideas — reply to this email anytime.</p>
            <p style="font-size:15px;color:#3A3630;line-height:1.75;margin:0 0 28px 0;">Now go log something delicious. 🍽</p>

            <p style="font-size:14px;color:#3A3630;margin:0 0 4px 0;">Happy cooking,</p>
            <p style="font-family:Georgia,serif;font-size:22px;color:#C4713A;font-weight:500;margin:0 0 2px 0;">Syd</p>
            <p style="font-size:12px;color:#8A8070;margin:0;">Creator of Nom</p>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:#F0E8D8;border-top:1px solid #D9C9B0;padding:24px 48px;text-align:center;">
            <p style="font-size:11px;color:#8A8070;line-height:1.7;margin:0;">Questions or feedback? <a href="/cdn-cgi/l/email-protection#244a4b490a5641474d5441455454644349454d480a474b49" style="color:#C4713A;text-decoration:none;"><span class="__cf_email__" data-cfemail="b2dcdddf9cc0d7d1dbc2d7d3c2c2f2d5dfd3dbde9cd1dddf">[email&#160;protected]</span></a> &middot; Follow us on Instagram <a href="https://instagram.com/nom.recipeapp" style=`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Nom <${FROM_EMAIL}>`,
        to: [email],
        subject: 'Welcome to Nom 🍽',
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Resend error:', err)
      return new Response(JSON.stringify(err), { status: 500 })
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Function error:', err)
    return new Response(err.message, { status: 500 })
  }
})